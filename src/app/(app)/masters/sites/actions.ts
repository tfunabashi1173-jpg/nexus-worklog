"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

function buildProjectIdPrefix(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

function computeStatusFromDates(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return "受注";
  }
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) {
    return "受注";
  }
  if (now > end) {
    return "完工";
  }
  return "着工中";
}

async function generateProjectId() {
  const now = new Date();
  const prefix = buildProjectIdPrefix(now);
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("project_id")
    .like("project_id", `${prefix}%`)
    .order("project_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latest = data?.project_id ?? `${prefix}000`;
  const seq = Number(latest.slice(-3)) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export async function createSite(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const managerId = String(formData.get("managerId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();

  if (!name) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const projectId = await generateProjectId();
  const status = computeStatusFromDates(startDate || null, endDate || null);
  await supabase.from("projects").insert({
    project_id: projectId,
    site_name: name,
    status,
    contract_amount: 0,
    manager_id: managerId || session?.userId || null,
    customer_id: customerId || null,
    start_date: startDate || null,
    end_date: endDate || null,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/masters/sites");
}

export async function updateSite(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const siteId = String(formData.get("siteId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();

  if (!siteId || !name) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("status")
    .eq("project_id", siteId)
    .maybeSingle();

  const nextStatus =
    data?.status === "精算完了"
      ? data.status
      : computeStatusFromDates(startDate || null, endDate || null);

  await supabase
    .from("projects")
    .update({
      site_name: name,
      customer_id: customerId || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", siteId);

  revalidatePath("/masters/sites");
}

export async function deleteSite(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const siteId = String(formData.get("siteId") ?? "");
  if (!siteId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  await supabase
    .from("projects")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("project_id", siteId);

  revalidatePath("/masters/sites");
}
