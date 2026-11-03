import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerFromKey } from "@/lib/inbox/text-auth";
import { normalizeHandle } from "@/lib/inbox/texts";
import { recordSuggestion } from "@/lib/inbox/text-suggestions";

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

  const recorded = await recordSuggestion(auth.ownerId, handle);
  return NextResponse.json({ ok: true, recorded });
}
