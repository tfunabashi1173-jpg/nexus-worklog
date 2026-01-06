"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

export async function createWorker(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "").trim();

  if (!name || !contractorId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("workers")
    .select("id, id_deleted")
    .eq("name", name)
    .eq("contractor_id", contractorId)
    .limit(1)
    .maybeSingle();
  if (existingError) {
    console.error("Lookup worker error", existingError);
    redirect(`/masters/workers?error=${encodeURIComponent(existingError.message)}`);
  }
  if (existing) {
    if (existing.id_deleted) {
      const { error: restoreError } = await supabase
        .from("workers")
        .update({ id_deleted: false, deleted_at: null })
        .eq("id", existing.id);
      revalidatePath("/masters/workers");
      if (restoreError) {
        console.error("Restore worker error", restoreError);
        redirect(
          `/masters/workers?error=${encodeURIComponent(restoreError.message)}`
        );
      }
      redirect("/masters/workers?success=restored");
    }
    redirect(
      `/masters/workers?error=${encodeURIComponent(
        "同じ作業員が既に登録されています。"
      )}`
    );
  }

  const { error } = await supabase
    .from("workers")
    .insert({ name, contractor_id: contractorId, id_deleted: false });

  revalidatePath("/masters/workers");
  if (error) {
    console.error("Create worker error", error);
    redirect(
      `/masters/workers?error=${encodeURIComponent(error.message)}`
    );
  }
  redirect("/masters/workers?success=created");
}

export async function updateWorker(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const workerId = String(formData.get("workerId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const contractorId = String(formData.get("contractorId") ?? "").trim();

  if (!workerId || !name || !contractorId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("workers")
    .update({ name, contractor_id: contractorId })
    .eq("id", workerId);

  revalidatePath("/masters/workers");
  if (error) {
    console.error("Update worker error", error);
    redirect(
      `/masters/workers?error=${encodeURIComponent(error.message)}`
    );
  }
  redirect("/masters/workers?success=updated");
}

export async function deleteWorker(formData: FormData) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return;
  }

  const workerId = String(formData.get("workerId") ?? "");
  if (!workerId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("workers")
    .update({ id_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", workerId);

  revalidatePath("/masters/workers");
  if (error) {
    console.error("Delete worker error", error);
    redirect(
      `/masters/workers?error=${encodeURIComponent(error.message)}`
    );
  }
  redirect("/masters/workers?success=deleted");
}
