import { NextResponse } from "next/server";
import { getSessionCookie } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const getTodayString = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

type EntryPayload = {
  entry_date: string;
  project_id: string;
  contractor_id: string | null;
  worker_id: string | null;
  nexus_user_id: string | null;
  work_type_id: string | null;
  work_type_text: string | null;
};

export async function POST(request: Request) {
  const session = await getSessionCookie();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { entries, deletedIds } = (await request.json()) as {
    entries: EntryPayload[];
    deletedIds?: string[];
  };
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalidWorkerIds = entries
    .map((entry) => entry.worker_id)
    .filter((value) => value && !uuidRegex.test(value));
  if (invalidWorkerIds.length) {
    return NextResponse.json(
      {
        error: "invalid_worker_id",
        details: `worker_id が不正です: ${[...new Set(invalidWorkerIds)].join(", ")}`,
      },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  if (session.role === "guest") {
    const token = session.guestToken;
    if (!token) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const today = getTodayString();
    const { data: guestLink, error: guestError } = await supabase
      .from("guest_links")
      .select("project_id, is_deleted, expires_at, can_edit_attendance")
      .eq("token", token)
      .maybeSingle();
    if (
      guestError ||
      !guestLink ||
      guestLink.is_deleted ||
      (guestLink.expires_at && guestLink.expires_at < today) ||
      !guestLink.can_edit_attendance ||
      (session.guestProjectId && guestLink.project_id !== session.guestProjectId)
    ) {
      if (guestLink?.expires_at && guestLink.expires_at < today) {
        await supabase.from("guest_links").delete().eq("token", token);
      }
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const uniqueMap = new Map<string, EntryPayload>();
  for (const entry of entries) {
    if (entry.worker_id) {
      uniqueMap.set(
        `worker:${entry.entry_date}:${entry.project_id}:${entry.worker_id}`,
        entry
      );
      continue;
    }
    if (entry.nexus_user_id) {
      uniqueMap.set(
        `nexus:${entry.entry_date}:${entry.project_id}:${entry.nexus_user_id}`,
        entry
      );
    }
  }
  const uniqueEntries = Array.from(uniqueMap.values());

  const filteredEntries = uniqueEntries;

  if (deletedIds && deletedIds.length) {
    const { error: deleteError } = await supabase
      .from("attendance_entries")
      .delete()
      .in("id", deletedIds);
    if (deleteError) {
      console.error("Attendance delete error", deleteError);
      return NextResponse.json(
        { error: "failed", details: deleteError.message },
        { status: 500 }
      );
    }
  }

  const payload = filteredEntries.map((entry) => ({
    ...entry,
    created_by: session.userId,
  }));

  const nexusPayload = payload.filter((entry) => entry.nexus_user_id);
  const workerPayload = payload.filter((entry) => !entry.nexus_user_id);
  if (workerPayload.length) {
    const { error } = await supabase
      .from("attendance_entries")
      .upsert(workerPayload, {
        onConflict: "entry_date,project_id,worker_id",
      });
    if (error) {
      console.error("Attendance upsert error", error);
      return NextResponse.json(
        { error: "failed", details: error.message },
        { status: 500 }
      );
    }
  }
  if (nexusPayload.length) {
    const { error } = await supabase
      .from("attendance_entries")
      .upsert(nexusPayload, {
        onConflict: "entry_date,project_id,nexus_user_id",
      });
    if (error) {
      console.error("Attendance upsert error", error);
      return NextResponse.json(
        { error: "failed", details: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const session = await getSessionCookie();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entryDate = searchParams.get("date") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  if (!entryDate || !projectId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance_entries")
    .select(
      "id, entry_date, project_id, contractor_id, worker_id, nexus_user_id, work_type_id, work_type_text, workers(id,name), partners(partner_id,name), users(user_id,username)"
    )
    .eq("entry_date", entryDate)
    .eq("project_id", projectId)
    .order("created_at");

  if (error) {
    console.error("Attendance fetch error", error);
    return NextResponse.json(
      { error: "failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function DELETE(request: Request) {
  const session = await getSessionCookie();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entryDate = searchParams.get("date") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  if (!entryDate || !projectId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (session.role === "guest") {
    const token = session.guestToken;
    if (!token) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const today = getTodayString();
    const { data: guestLink, error: guestError } = await supabase
      .from("guest_links")
      .select("project_id, is_deleted, expires_at, can_edit_attendance")
      .eq("token", token)
      .maybeSingle();
    if (
      guestError ||
      !guestLink ||
      guestLink.is_deleted ||
      (guestLink.expires_at && guestLink.expires_at < today) ||
      !guestLink.can_edit_attendance ||
      (session.guestProjectId && guestLink.project_id !== session.guestProjectId)
    ) {
      if (guestLink?.expires_at && guestLink.expires_at < today) {
        await supabase.from("guest_links").delete().eq("token", token);
      }
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const { error } = await supabase
    .from("attendance_entries")
    .delete()
    .eq("entry_date", entryDate)
    .eq("project_id", projectId);

  if (error) {
    console.error("Attendance delete error", error);
    return NextResponse.json(
      { error: "failed", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
