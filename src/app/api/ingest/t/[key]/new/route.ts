import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerFromKey } from "@/lib/inbox/text-auth";
import { normalizeHandle } from "@/lib/inbox/texts";

// Receives only a phone number (never a message) when someone not on the list
// texts the owner, and only if the owner has turned suggestions on.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const auth = await ownerFromKey(key);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: owner } = await supabase
    .from("users")
    .select("text_suggestions")
    .eq("id", auth.ownerId)
    .maybeSingle();
  if (!owner?.text_suggestions) return NextResponse.json({ ok: true, recorded: false });

  let from = "";
  try {
    const type = request.headers.get("content-type") ?? "";
    from = type.includes("application/json")
      ? String(((await request.json()) as Record<string, unknown>).from ?? "")
      : String((await request.formData()).get("from") ?? "");
  } catch {
    return NextResponse.json({ error: "Couldn't read that." }, { status: 400 });
  }
  const handle = normalizeHandle(from);
  if (!handle) return NextResponse.json({ ok: true, recorded: false });

  // Already on the list, or already dismissed, means nothing to suggest.
  const { data: contact } = await supabase
    .from("inbox_text_contacts")
    .select("id")
    .eq("owner_id", auth.ownerId)
    .eq("handle", handle)
    .maybeSingle();
  if (contact) return NextResponse.json({ ok: true, recorded: false });

  const { data: existing } = await supabase
    .from("inbox_text_suggestions")
    .select("id, seen_count, status")
    .eq("owner_id", auth.ownerId)
    .eq("handle", handle)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("inbox_text_suggestions")
      .update({ seen_count: existing.seen_count + 1, last_seen: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    const { count } = await supabase
      .from("inbox_text_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", auth.ownerId);
    if ((count ?? 0) >= 200) return NextResponse.json({ ok: true, recorded: false });
    await supabase.from("inbox_text_suggestions").insert({ owner_id: auth.ownerId, handle });
  }
  return NextResponse.json({ ok: true, recorded: true });
}
