// Microsoft 365 / Outlook: read-only sign-in and mail fetching through Microsoft
// Graph. Everything here is plain functions that take `fetchFn`, so it can be
// tested without talking to Microsoft.

import type { IncomingMessage } from "@/lib/inbox/triage";
import { mailHeaders } from "@/lib/inbox/webhook";

const AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
// Read-only access to mail, plus the refresh token that keeps it working.
export const SCOPES = "offline_access User.Read Mail.Read";

type FetchFn = typeof fetch;

export function authorizeUrl({ clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });
  return `${AUTH}/authorize?${params}`;
}

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

async function tokenRequest(body: Record<string, string>, fetchFn: FetchFn, nowMs: number): Promise<Tokens> {
  const response = await fetchFn(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new MicrosoftAuthError(data.error ?? `status ${response.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: nowMs + (data.expires_in ?? 3600) * 1000,
  };
}

export class MicrosoftAuthError extends Error {}

type Creds = { clientId: string; clientSecret: string };

export function exchangeCode(code: string, redirectUri: string, creds: Creds, fetchFn: FetchFn = fetch, nowMs = Date.now()) {
  return tokenRequest(
    { client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri, scope: SCOPES },
    fetchFn,
    nowMs
  );
}

export function refreshTokens(refreshToken: string, creds: Creds, fetchFn: FetchFn = fetch, nowMs = Date.now()) {
  return tokenRequest(
    { client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken, scope: SCOPES },
    fetchFn,
    nowMs
  );
}

export async function fetchAccountEmail(accessToken: string, fetchFn: FetchFn = fetch): Promise<string | null> {
  const response = await fetchFn(`${GRAPH}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { mail?: string | null; userPrincipalName?: string | null };
  return (data.mail || data.userPrincipalName || "").toLowerCase() || null;
}

type GraphMessage = {
  id: string;
  internetMessageId?: string | null;
  subject?: string | null;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string | null; address?: string | null } } | null;
  body?: { content?: string | null } | null;
  bodyPreview?: string | null;
  internetMessageHeaders?: { name: string; value: string }[] | null;
};

export function toIncoming(m: GraphMessage): { externalId: string; message: IncomingMessage } {
  const headers: Record<string, string> = {};
  for (const h of m.internetMessageHeaders ?? []) headers[h.name] = h.value;
  const body = (m.body?.content ?? "").trim() || (m.bodyPreview ?? "").trim();
  return {
    externalId: m.internetMessageId || m.id,
    message: {
      source: "microsoft",
      senderName: m.from?.emailAddress?.name?.trim() || null,
      senderAddress: m.from?.emailAddress?.address?.trim().toLowerCase() || null,
      subject: m.subject ?? null,
      body: body.slice(0, 20_000),
      receivedAt: m.receivedDateTime,
      headers: mailHeaders(headers),
    },
  };
}

const MAX_PAGES = 4;
const PAGE_SIZE = 50;

// New inbox mail since a moment in time, oldest first. Plain-text bodies are
// requested so there is no HTML to clean up.
export async function fetchInboxSince(
  accessToken: string,
  sinceIso: string,
  fetchFn: FetchFn = fetch
): Promise<GraphMessage[]> {
  const select = "id,internetMessageId,subject,from,receivedDateTime,body,bodyPreview,internetMessageHeaders";
  let url: string | null =
    `${GRAPH}/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
    `&$orderby=${encodeURIComponent("receivedDateTime asc")}&$top=${PAGE_SIZE}&$select=${select}`;
  const all: GraphMessage[] = [];
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const response: Response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
    });
    if (!response.ok) throw new Error(`Graph returned ${response.status}`);
    const data = (await response.json()) as { value?: GraphMessage[]; "@odata.nextLink"?: string };
    all.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? null;
  }
  return all;
}
