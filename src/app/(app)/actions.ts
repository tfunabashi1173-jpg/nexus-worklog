"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/session";

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
