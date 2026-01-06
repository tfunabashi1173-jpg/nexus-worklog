"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

export async function updateContractor(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const partnerId = String(formData.get("partnerId") ?? "");
  const defaultWorkCategoryId = String(
    formData.get("defaultWorkCategoryId") ?? ""
  ).trim();
  const showInAttendance = String(formData.get("showInAttendance") ?? "");

  if (!partnerId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("partners")
    .update({
      default_work_category_id: defaultWorkCategoryId || null,
      show_in_attendance: showInAttendance === "on",
    })
    .eq("partner_id", partnerId);

  revalidatePath("/masters/contractors");
  redirect("/masters/contractors");
}

export async function deleteContractor(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const partnerId = String(formData.get("partnerId") ?? "");
  if (!partnerId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("partners")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("partner_id", partnerId);

  revalidatePath("/masters/contractors");
  redirect("/masters/contractors");
}
