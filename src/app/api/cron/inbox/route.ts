import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPending } from "@/lib/inbox/process";
import { syncAllMicrosoft } from "@/lib/inbox/microsoft-sync";
import { lastFullWeek } from "@/lib/inbox/digest";
import { sendDigest } from "@/lib/inbox/send-digest";

export const maxDuration = 300;

// Called by Vercel Cron (see vercel.json). Vercel sends the CRON_SECRET as a
// bearer token; anything else is refused.
//   ?job=sync     read new mail from connected Microsoft mailboxes, then sort it
//   ?job=process  safety net: sort anything still waiting
//   ?job=digest   Monday morning: send last week's update to every inbox owner
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = new URL(request.url).searchParams.get("job");

  if (job === "sync") {
    const synced = await syncAllMicrosoft();
    const sorted = await processPending(50);
    return NextResponse.json({ synced, sorted });
  }

  if (job === "process") {
    return NextResponse.json(await processPending(50));
  }

  if (job === "digest") {
    await syncAllMicrosoft();
    await processPending(50);
    const week = lastFullWeek(Date.now());
    const supabase = createAdminClient();
    const { data: owners } = await supabase.from("users").select("id").eq("inbox_enabled", true);
    const results: Record<string, number> = { sent: 0, "already-sent": 0, failed: 0 };
    for (const owner of owners ?? []) {
      results[await sendDigest(owner.id, week, week.weekStart)]++;
    }
    return NextResponse.json(results);
  }

  return NextResponse.json({ error: "Unknown job" }, { status: 400 });
}
