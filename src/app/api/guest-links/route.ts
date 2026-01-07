import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionCookie } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const getTodayString = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

export async function POST(request: Request) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { projectId, expiresAt, canEditAttendance } = (await request.json()) as {
    projectId?: string;
    expiresAt?: string | null;
    canEditAttendance?: boolean;
  };
  if (!projectId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const normalizedExpiresAt =
    expiresAt && expiresAt.trim() ? expiresAt.trim() : null;
  if (normalizedExpiresAt && Number.isNaN(Date.parse(normalizedExpiresAt))) {
    return NextResponse.json({ error: "invalid_expires" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const today = getTodayString();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("guest_links")
    .delete()
    .eq("is_deleted", true)
    .lte("deleted_at", cutoff);
  await supabase.from("guest_links").delete().lt("expires_at", today);

  const { data: existingLink } = await supabase
    .from("guest_links")
    .select("token, expires_at, can_edit_attendance")
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? (host ? `${protocol}://${host}` : "");

  if (existingLink?.token) {
    if (existingLink.expires_at && existingLink.expires_at < today) {
      await supabase.from("guest_links").delete().eq("token", existingLink.token);
    } else {
      const existingUrl = baseUrl
        ? `${baseUrl}/login?guest=${existingLink.token}`
        : `/login?guest=${existingLink.token}`;
      return NextResponse.json({
        url: existingUrl,
        token: existingLink.token,
        existing: true,
      });
    }
  }

  const { data: deletedLink } = await supabase
    .from("guest_links")
    .select("token")
    .eq("project_id", projectId)
    .eq("is_deleted", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deletedLink?.token) {
    const { error: reviveError } = await supabase
      .from("guest_links")
      .update({ is_deleted: false, deleted_at: null })
      .eq("token", deletedLink.token);

    if (reviveError) {
      console.error("Guest link revive error", reviveError);
      return NextResponse.json(
        { error: "failed", details: reviveError.message },
        { status: 500 }
      );
    }

    const revivedUrl = baseUrl
      ? `${baseUrl}/login?guest=${deletedLink.token}`
      : `/login?guest=${deletedLink.token}`;
    return NextResponse.json({
      url: revivedUrl,
      token: deletedLink.token,
      existing: true,
    });
  }

  const token = randomBytes(16).toString("base64url");
  const { error } = await supabase
    .from("guest_links")
    .insert({
      token,
      project_id: projectId,
      expires_at: normalizedExpiresAt,
      can_edit_attendance: Boolean(canEditAttendance),
    });

  if (error) {
    console.error("Guest link insert error", error);
    return NextResponse.json(
      { error: "failed", details: error.message },
      { status: 500 }
    );
  }

  const url = baseUrl ? `${baseUrl}/login?guest=${token}` : `/login?guest=${token}`;

  return NextResponse.json({ url, token, existing: false });
}
