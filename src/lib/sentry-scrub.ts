import type { Breadcrumb, Event } from "@sentry/nextjs";

// Error reports must never carry what people wrote or the keys that let a phone
// send texts. Everything that could hold either is removed or masked before an
// event leaves the server.

const MASKS: [RegExp, string][] = [
  [/(\/ingest\/t\/)[^/?\s"'\\]+/g, "$1[key]"],
  [/\btt_[A-Za-z0-9_-]{6,}/g, "[key]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/\+?\d[\d\s().-]{8,}\d/g, "[number]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "[secret]"],
];

export function maskText(text: string): string {
  return MASKS.reduce((out, [pattern, to]) => out.replace(pattern, to), text);
}

// The query string of a URL often holds who or what was looked up.
function maskUrl(url: string): string {
  return maskText(url.replace(/[?#].*$/, ""));
}

function maskDescription(text: string): string {
  return maskText(text.replace(/\?\S*/g, "?[query]"));
}

type Loose = Record<string, unknown>;

function scrubRequest(request: Loose | undefined) {
  if (!request) return;
  delete request.data;
  delete request.cookies;
  delete request.headers;
  delete request.query_string;
  delete request.env;
  if (typeof request.url === "string") request.url = maskUrl(request.url);
}

function scrubBreadcrumbData(data: Loose | undefined): Loose | undefined {
  if (!data) return undefined;
  const kept: Loose = {};
  if (typeof data.method === "string") kept.method = data.method;
  if (typeof data.status_code === "number") kept.status_code = data.status_code;
  if (typeof data.url === "string") kept.url = maskUrl(data.url);
  return kept;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const out: Breadcrumb = { ...crumb };
  if (typeof out.message === "string") out.message = maskText(out.message);
  out.data = scrubBreadcrumbData(out.data as Loose | undefined);
  return out;
}

export function scrubEvent<T extends Event>(event: T): T {
  const e = event as unknown as Loose;
  scrubRequest(e.request as Loose | undefined);
  delete e.user;
  delete e.extra;
  if (typeof e.message === "string") e.message = maskText(e.message);
  if (typeof e.transaction === "string") e.transaction = maskUrl(e.transaction);

  const exceptions = (e.exception as { values?: Loose[] } | undefined)?.values;
  for (const value of exceptions ?? []) {
    if (typeof value.value === "string") value.value = maskText(value.value);
  }

  const crumbs = e.breadcrumbs as Breadcrumb[] | undefined;
  if (Array.isArray(crumbs)) e.breadcrumbs = crumbs.map(scrubBreadcrumb);

  const spans = e.spans as Loose[] | undefined;
  for (const span of spans ?? []) {
    if (typeof span.description === "string") span.description = maskDescription(span.description);
    delete span.data;
  }
  return event;
}
