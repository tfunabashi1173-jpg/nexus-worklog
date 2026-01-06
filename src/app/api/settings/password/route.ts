import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionCookie } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSessionCookie();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role === "guest") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { password } = (await request.json()) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ password: hashed })
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
