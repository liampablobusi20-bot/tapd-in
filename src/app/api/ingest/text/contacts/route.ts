import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerFromBearer } from "@/lib/inbox/text-auth";

// The helper on a person's Mac asks which contacts it may read. Anyone not on
// this list is never read or uploaded.
export async function GET(request: Request) {
  const auth = await ownerFromBearer(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await createAdminClient()
    .from("inbox_text_contacts")
    .select("name, handle")
    .eq("owner_id", auth.ownerId)
    .order("name", { ascending: true });
  return NextResponse.json({ contacts: data ?? [] });
}
