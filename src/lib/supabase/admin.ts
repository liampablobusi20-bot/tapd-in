import { createClient } from "@supabase/supabase-js";

// Service-role client for guest (token-based) access — guests never have a
// Supabase Auth session, so RLS (which is keyed on auth.uid()) can't scope
// their access. This client bypasses RLS entirely, so every function that
// uses it must explicitly re-validate the guest's token and permission
// before touching any data. Never import this into client components or
// anything reachable from the browser bundle.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
