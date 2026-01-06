"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSessionCookie } from "@/lib/session";

export type LoginState = {
  error: string | null;
};

export async function login(
  _: LoginState,
  formData: FormData
): Promise<LoginState> {
  const loginId = String(formData.get("loginId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const guestToken = String(formData.get("guestToken") ?? "").trim();

  if (!loginId || !password) {
    return { error: "ログインIDとパスワードを入力してください。" };
  }

  if (loginId === "guest" && password === "guest") {
    if (!guestToken) {
      return { error: "ゲスト用URLからログインしてください。" };
    }
    const supabase = createSupabaseServerClient();
    const { data: guestLink, error: guestError } = await supabase
      .from("guest_links")
      .select("project_id, is_deleted")
      .eq("token", guestToken)
      .maybeSingle();

    if (guestError || !guestLink || guestLink.is_deleted) {
      return { error: "ゲスト用URLが無効です。" };
    }

    await createSessionCookie({
      userId: "guest",
      username: "ゲスト",
      role: "guest",
      guestProjectId: guestLink.project_id,
    });
    redirect("/");
  }

  let user:
      | {
        user_id: string;
        username: string | null;
        password: string;
        role: string | null;
        is_deleted: boolean | null;
      }
    | null = null;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("user_id, username, password, role, is_deleted")
      .eq("user_id", loginId)
      .maybeSingle();

    if (error) {
      console.error("Login query error", error);
      return { error: "DB接続に失敗しました。管理者に連絡してください。" };
    }

    user = data;
  } catch (err) {
    console.error("Login query exception", err);
    return { error: "DB接続に失敗しました。管理者に連絡してください。" };
  }

  if (!user || user.is_deleted) {
    return { error: "ログインに失敗しました。" };
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    return { error: "ログインに失敗しました。" };
  }

  await createSessionCookie({
    userId: user.user_id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
  });

  redirect("/");
}
