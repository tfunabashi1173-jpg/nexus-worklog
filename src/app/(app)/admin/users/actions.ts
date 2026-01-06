"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

async function isAdminUser() {
  const session = await getSessionCookie();
  return session?.role === "admin";
}

export async function createUser(formData: FormData) {
  if (!(await isAdminUser())) {
    return;
  }

  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "user").trim();

  if (!loginId || !password) {
    return;
  }

  const admin = createSupabaseServerClient();
  const hashed = await bcrypt.hash(password, 10);
  await admin.from("users").insert({
    user_id: loginId,
    username: displayName,
    password: hashed,
    role: role === "admin" ? "admin" : "user",
    is_deleted: false,
    created_at: new Date().toISOString(),
  });

  revalidatePath("/admin/users");
}

export async function updateUser(formData: FormData) {
  if (!(await isAdminUser())) {
    return;
  }

  const userId = String(formData.get("userId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "user").trim();

  if (!userId) {
    return;
  }

  const admin = createSupabaseServerClient();
  await admin
    .from("users")
    .update({
      username: displayName,
      role: role === "admin" ? "admin" : "user",
    })
    .eq("user_id", userId);

  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  if (!(await isAdminUser())) {
    return;
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    return;
  }

  const admin = createSupabaseServerClient();
  await admin
    .from("users")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("user_id", userId);

  revalidatePath("/admin/users");
}
