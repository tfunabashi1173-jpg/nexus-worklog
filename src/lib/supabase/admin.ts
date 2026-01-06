import { createSupabaseServerClient } from "@/lib/supabase/server";

export function createSupabaseAdminClient() {
  return createSupabaseServerClient();
}
