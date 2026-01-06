import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

type UpdatePayload = {
  partnerId?: string;
  defaultWorkCategoryId?: string | null;
  showInAttendance?: boolean;
};

export async function POST(request: Request) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const partnerId = String(payload.partnerId ?? "").trim();
  if (!partnerId) {
    return NextResponse.json({ error: "Missing partnerId" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("partners")
    .update({
      default_work_category_id: payload.defaultWorkCategoryId || null,
      show_in_attendance:
        typeof payload.showInAttendance === "boolean"
          ? payload.showInAttendance
          : true,
    })
    .eq("partner_id", partnerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
