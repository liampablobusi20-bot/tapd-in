// Per-account settings. Everything an account manager can tailor for one person lives here,
// validated in one place, so a change for one account can never leak into another's and a
// typo is caught instead of silently ignored. No imports from the app, so the command-line
// tool can use it too.

// The same name matching People uses (a test keeps the two identical), kept here so this
// file has no imports and the command-line tool can load it directly.
export function nameKey(name: string | null | undefined): string {
  const cleaned = (name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return /[a-z]/.test(cleaned) ? cleaned : "";
}

export type Features = {
  people: boolean;
  meetingBriefs: boolean;
  urgentAlerts: boolean;
  texts: boolean;
  waitingOnYou: boolean;
  owedToYou: boolean;
};

export type AccountConfig = {
  // Extra guidance for how this person's messages are judged, in plain words.
  triageNotes: string;
  // Senders (a name, an email address, or @domain) whose messages are always urgent.
  alwaysUrgent: string[];
  // Senders whose messages are never shown or summarized.
  ignoreSenders: string[];
  summaryStyle: "short" | "normal";
  // Send urgent-alert emails only for the alwaysUrgent senders.
  urgentVipOnly: boolean;
  // Hours (0 to 23, Arizona time) between which no alert is emailed.
  quietFromHour: number;
  quietUntilHour: number;
  features: Features;
};

export const DEFAULT_FEATURES: Features = {
  people: true,
  meetingBriefs: true,
  urgentAlerts: true,
  texts: true,
  waitingOnYou: true,
  owedToYou: true,
};

export const DEFAULT_CONFIG: AccountConfig = {
  triageNotes: "",
  alwaysUrgent: [],
  ignoreSenders: [],
  summaryStyle: "normal",
  urgentVipOnly: false,
  quietFromHour: 22,
  quietUntilHour: 6,
  features: DEFAULT_FEATURES,
};

export const LIMITS = { triageNotes: 1200, listItems: 50, itemLength: 120 };

const FEATURE_KEYS = Object.keys(DEFAULT_FEATURES) as (keyof Features)[];
const TOP_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof AccountConfig)[];

const isHour = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23;
const cleanList = (v: unknown): string[] | null => {
  if (!Array.isArray(v) || v.length > LIMITS.listItems) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    const t = item.replace(/\s+/g, " ").trim();
    if (t.length > LIMITS.itemLength) return null;
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
};

export type Patch = Partial<Omit<AccountConfig, "features">> & { features?: Partial<Features> };
export type Validated = { ok: true; patch: Patch } | { ok: false; errors: string[] };

// Strict: used when someone is making a change. Unknown settings and bad values are refused
// with a clear message, never quietly dropped.
export function validatePatch(input: unknown): Validated {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["The change must be an object."] };
  const errors: string[] = [];
  const patch: Patch = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(TOP_KEYS as string[]).includes(key)) {
      errors.push(`Unknown setting "${key}". Known settings: ${TOP_KEYS.join(", ")}.`);
      continue;
    }
    switch (key as keyof AccountConfig) {
      case "triageNotes":
        if (typeof value !== "string") errors.push("triageNotes must be text.");
        else if (value.length > LIMITS.triageNotes) errors.push(`triageNotes is too long (maximum ${LIMITS.triageNotes} characters).`);
        else patch.triageNotes = value.trim();
        break;
      case "alwaysUrgent":
      case "ignoreSenders": {
        const list = cleanList(value);
        if (!list) errors.push(`${key} must be a list of up to ${LIMITS.listItems} short names, addresses, or @domains.`);
        else patch[key as "alwaysUrgent" | "ignoreSenders"] = list;
        break;
      }
      case "summaryStyle":
        if (value !== "short" && value !== "normal") errors.push('summaryStyle must be "short" or "normal".');
        else patch.summaryStyle = value;
        break;
      case "urgentVipOnly":
        if (typeof value !== "boolean") errors.push("urgentVipOnly must be true or false.");
        else patch.urgentVipOnly = value;
        break;
      case "quietFromHour":
      case "quietUntilHour":
        if (!isHour(value)) errors.push(`${key} must be a whole hour from 0 to 23.`);
        else patch[key as "quietFromHour" | "quietUntilHour"] = value;
        break;
      case "features": {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          errors.push("features must be an object.");
          break;
        }
        const feats: Partial<Features> = {};
        for (const [fk, fv] of Object.entries(value as Record<string, unknown>)) {
          if (!(FEATURE_KEYS as string[]).includes(fk)) errors.push(`Unknown feature "${fk}". Known: ${FEATURE_KEYS.join(", ")}.`);
          else if (typeof fv !== "boolean") errors.push(`features.${fk} must be true or false.`);
          else feats[fk as keyof Features] = fv;
        }
        patch.features = feats;
        break;
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, patch };
}

// Lenient: used when reading what is stored. Anything invalid falls back to the default,
// so a bad record can never break an account.
export function resolveConfig(stored: unknown): AccountConfig {
  const base: AccountConfig = { ...DEFAULT_CONFIG, alwaysUrgent: [], ignoreSenders: [], features: { ...DEFAULT_FEATURES } };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return base;
  const s = stored as Record<string, unknown>;
  if (typeof s.triageNotes === "string") base.triageNotes = s.triageNotes.slice(0, LIMITS.triageNotes);
  const urgent = cleanList(s.alwaysUrgent);
  if (urgent) base.alwaysUrgent = urgent;
  const ignore = cleanList(s.ignoreSenders);
  if (ignore) base.ignoreSenders = ignore;
  if (s.summaryStyle === "short") base.summaryStyle = "short";
  if (typeof s.urgentVipOnly === "boolean") base.urgentVipOnly = s.urgentVipOnly;
  if (isHour(s.quietFromHour)) base.quietFromHour = s.quietFromHour;
  if (isHour(s.quietUntilHour)) base.quietUntilHour = s.quietUntilHour;
  if (s.features && typeof s.features === "object" && !Array.isArray(s.features)) {
    for (const k of FEATURE_KEYS) {
      const v = (s.features as Record<string, unknown>)[k];
      if (typeof v === "boolean") base.features[k] = v;
    }
  }
  return base;
}

// What is stored is only what differs from the defaults, so new defaults reach everyone who
// hasn't chosen otherwise.
export function mergePatch(stored: unknown, patch: Patch): AccountConfig {
  const current = resolveConfig(stored);
  return { ...current, ...patch, features: { ...current.features, ...(patch.features ?? {}) } } as AccountConfig;
}

export function toStored(config: AccountConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const d = DEFAULT_CONFIG;
  if (config.triageNotes !== d.triageNotes) out.triageNotes = config.triageNotes;
  if (config.alwaysUrgent.length) out.alwaysUrgent = config.alwaysUrgent;
  if (config.ignoreSenders.length) out.ignoreSenders = config.ignoreSenders;
  if (config.summaryStyle !== d.summaryStyle) out.summaryStyle = config.summaryStyle;
  if (config.urgentVipOnly !== d.urgentVipOnly) out.urgentVipOnly = config.urgentVipOnly;
  if (config.quietFromHour !== d.quietFromHour) out.quietFromHour = config.quietFromHour;
  if (config.quietUntilHour !== d.quietUntilHour) out.quietUntilHour = config.quietUntilHour;
  const features: Record<string, boolean> = {};
  for (const k of FEATURE_KEYS) if (config.features[k] !== DEFAULT_FEATURES[k]) features[k] = config.features[k];
  if (Object.keys(features).length) out.features = features;
  return out;
}

// Plain-language lines describing what changed, for the history and the account's own log.
export function describeChange(before: AccountConfig, after: AccountConfig): string[] {
  const lines: string[] = [];
  if (before.triageNotes !== after.triageNotes) lines.push(after.triageNotes ? "Custom guidance for judging messages updated" : "Custom guidance removed");
  const listDiff = (name: string, a: string[], b: string[]) => {
    const added = b.filter((x) => !a.some((y) => y.toLowerCase() === x.toLowerCase()));
    const removed = a.filter((x) => !b.some((y) => y.toLowerCase() === x.toLowerCase()));
    if (added.length) lines.push(`${name}: added ${added.join(", ")}`);
    if (removed.length) lines.push(`${name}: removed ${removed.join(", ")}`);
  };
  listDiff("Always urgent", before.alwaysUrgent, after.alwaysUrgent);
  listDiff("Ignored senders", before.ignoreSenders, after.ignoreSenders);
  if (before.summaryStyle !== after.summaryStyle) lines.push(`Summary style: ${after.summaryStyle}`);
  if (before.urgentVipOnly !== after.urgentVipOnly) lines.push(`Urgent alerts only for always-urgent senders: ${after.urgentVipOnly ? "on" : "off"}`);
  if (before.quietFromHour !== after.quietFromHour || before.quietUntilHour !== after.quietUntilHour)
    lines.push(`Quiet hours: ${after.quietFromHour}:00 to ${after.quietUntilHour}:00`);
  for (const k of FEATURE_KEYS) if (before.features[k] !== after.features[k]) lines.push(`${k}: ${after.features[k] ? "on" : "off"}`);
  return lines;
}

// Does a list entry cover this sender? An entry is an email address, an @domain (or bare
// domain), or a person's name (matched the way People groups names).
export function senderMatches(entries: string[], sender: { name?: string | null; address?: string | null }): boolean {
  const address = (sender.address ?? "").trim().toLowerCase();
  const senderKey = nameKey(sender.name);
  for (const raw of entries) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;
    if (entry.startsWith("@") || (!entry.includes("@") && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(entry))) {
      const domain = entry.replace(/^@/, "");
      if (address.includes("@") && (address.endsWith(`@${domain}`) || address.endsWith(`.${domain}`))) return true;
      continue;
    }
    if (entry.includes("@")) {
      if (address === entry) return true;
      continue;
    }
    if (senderKey && nameKey(raw) === senderKey) return true;
  }
  return false;
}
