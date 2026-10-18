import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only work that has no signed-in user: the
// inbound-email webhook, the scheduled jobs, and writes to tables owners can
// only read. It bypasses RLS entirely, so every function that uses it must
// work out whose data it is touching and check that first. Never import this
// into client components or anything reachable from the browser bundle.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
