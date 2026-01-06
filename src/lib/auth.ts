import { cache } from "react";
import { getSessionCookie } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getSession = cache(async () => getSessionCookie());

export const getUserSettings = cache(async () => {
  const session = await getSessionCookie();
  if (!session) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("user_settings")
    .select("user_id, default_project_id")
    .eq("user_id", session.userId)
    .single();

  return data ?? null;
});

export async function requireAdmin() {
  const session = await getSessionCookie();
  if (!session || session.role !== "admin") {
    return null;
  }

  return session;
}
