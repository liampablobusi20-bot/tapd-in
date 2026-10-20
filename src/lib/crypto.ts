import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Secrets at rest (sign-in tokens) are encrypted with AES-256-GCM. The key is a
// 64-character hex string in TOKEN_ENCRYPTION_KEY, never stored in the database.
export function encryptionKeyFromEnv(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex characters.");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string, key: Buffer = encryptionKeyFromEnv()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(token: string, key: Buffer = encryptionKeyFromEnv()): string {
  const [version, iv, tag, data] = token.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognized secret format.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// A short-lived, tamper-proof value that ties a sign-in round trip to the person
// who started it, so a link can't be replayed for someone else's account.
function stateKey(key: Buffer): Buffer {
  return createHmac("sha256", key).update("oauth-state").digest();
}

export function signState(ownerId: string, nowMs = Date.now(), key: Buffer = encryptionKeyFromEnv()): string {
  const payload = Buffer.from(JSON.stringify({ o: ownerId, n: randomBytes(8).toString("hex"), e: nowMs + 10 * 60_000 })).toString("base64url");
  const sig = createHmac("sha256", stateKey(key)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string, nowMs = Date.now(), key: Buffer = encryptionKeyFromEnv()): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", stateKey(key)).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { o, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { o?: string; e?: number };
    return typeof o === "string" && typeof e === "number" && e > nowMs ? o : null;
  } catch {
    return null;
  }
}
