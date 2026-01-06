import { NextResponse } from "next/server";
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

  const { defaultProjectId } = (await request.json()) as {
    defaultProjectId?: string;
  };

  if (!defaultProjectId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: session.userId,
    default_project_id: defaultProjectId,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
