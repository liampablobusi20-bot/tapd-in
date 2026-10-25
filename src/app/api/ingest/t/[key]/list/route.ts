import { createAdminClient } from "@/lib/supabase/admin";
import { ownerFromKey } from "@/lib/inbox/text-auth";
import { listBody } from "@/lib/inbox/texts";

// The phone downloads this to decide which texts to send. It only ever receives
// the list; nothing about incoming texts is sent here.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const auth = await ownerFromKey(key);
  if (!auth) return new Response("unauthorized", { status: 401 });

  const supabase = createAdminClient();
  const [{ data: contacts }, { data: owner }] = await Promise.all([
    supabase.from("inbox_text_contacts").select("handle").eq("owner_id", auth.ownerId),
    supabase.from("users").select("text_suggestions").eq("id", auth.ownerId).maybeSingle(),
  ]);
  return new Response(listBody(Boolean(owner?.text_suggestions), (contacts ?? []).map((c) => c.handle)), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
