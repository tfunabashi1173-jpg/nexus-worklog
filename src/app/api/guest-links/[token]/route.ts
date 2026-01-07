import { NextResponse } from "next/server";
import { getSessionCookie } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const getTodayString = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("guest_links")
    .delete()
    .eq("is_deleted", true)
    .lte("deleted_at", cutoff);

  const { error } = await supabase
    .from("guest_links")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { expiresAt } = (await request.json()) as {
    expiresAt?: string | null;
  };
  const normalizedExpiresAt =
    expiresAt && expiresAt.trim() ? expiresAt.trim() : null;
  if (normalizedExpiresAt && Number.isNaN(Date.parse(normalizedExpiresAt))) {
    return NextResponse.json({ error: "invalid_expires" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const today = getTodayString();
  const { data: existing } = await supabase
    .from("guest_links")
    .select("expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.expires_at && existing.expires_at < today) {
    await supabase.from("guest_links").delete().eq("token", token);
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const { error } = await supabase
    .from("guest_links")
    .update({ expires_at: normalizedExpiresAt })
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
