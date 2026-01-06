import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionCookie } from "@/lib/session";

const CORPORATE_TOKENS = [
  "株式会社",
  "有限会社",
  "合同会社",
  "合名会社",
  "合資会社",
  "（株）",
  "(株)",
  "㈱",
  "（有）",
  "(有)",
  "㈲",
  "（同）",
  "(同)",
];

const normalizeName = (value: string) => {
  const trimmed = value.replace(/\u3000/g, " ").trim();
  let normalized = trimmed;
  CORPORATE_TOKENS.forEach((token) => {
    if (normalized.startsWith(token)) {
      normalized = normalized.slice(token.length).trim();
    }
    if (normalized.endsWith(token)) {
      normalized = normalized.slice(0, -token.length).trim();
    }
  });
  return normalized.replace(/\s+/g, "").toLowerCase();
};

const stripLegalSuffix = (value: string) => {
  let trimmed = value.replace(/\u3000/g, " ").trim();
  CORPORATE_TOKENS.forEach((token) => {
    if (trimmed.startsWith(token)) {
      trimmed = trimmed.slice(token.length).trim();
    }
    if (trimmed.endsWith(token)) {
      trimmed = trimmed.slice(0, -token.length).trim();
    }
  });
  return trimmed || value;
};

type BulkRow = {
  id?: string;
  contractorName: string;
  workerName: string;
};

export async function POST(request: Request) {
  const session = await getSessionCookie();
  if (!session || session.role === "guest") {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as { rows?: BulkRow[] };
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) {
    return Response.json({ inserted: 0, updated: 0, restored: 0, skipped: 0, errors: [] });
  }

  const supabase = createSupabaseServerClient();
  const { data: contractors, error: contractorsError } = await supabase
    .from("partners")
    .select("partner_id, name")
    .eq("category", "協力業者")
    .or("is_deleted.is.false,is_deleted.is.null");

  if (contractorsError) {
    console.error("Bulk workers: contractors error", contractorsError);
    return new Response("Failed to load contractors", { status: 500 });
  }

  const contractorByName = new Map<string, string>();
  (contractors ?? []).forEach((contractor) => {
    contractorByName.set(normalizeName(contractor.name), contractor.partner_id);
    contractorByName.set(
      normalizeName(stripLegalSuffix(contractor.name)),
      contractor.partner_id
    );
  });

  const errors: string[] = [];
  const resolvedRows = rows
    .map((row, index) => {
      const contractorKey = normalizeName(row.contractorName);
      const contractorId = contractorByName.get(contractorKey);
      if (!contractorId) {
        errors.push(`行${index + 1}: 協力業者名が見つかりません (${row.contractorName})`);
        return null;
      }
      return {
        id: row.id,
        contractorId,
        workerName: row.workerName.trim(),
      };
    })
    .filter((row): row is { id?: string; contractorId: string; workerName: string } =>
      Boolean(row && row.workerName)
    );

  if (!resolvedRows.length) {
    return Response.json({ inserted: 0, updated: 0, restored: 0, skipped: 0, errors });
  }

  const contractorIds = Array.from(
    new Set(resolvedRows.map((row) => row.contractorId))
  );
  const { data: existingWorkers, error: workersError } = await supabase
    .from("workers")
    .select("id, name, contractor_id, id_deleted")
    .in("contractor_id", contractorIds);

  if (workersError) {
    console.error("Bulk workers: existing lookup error", workersError);
    return new Response("Failed to load workers", { status: 500 });
  }

  const existingMap = new Map<string, { id: string; id_deleted: boolean | null }>();
  (existingWorkers ?? []).forEach((worker) => {
    existingMap.set(`${worker.contractor_id}::${worker.name}`, {
      id: worker.id,
      id_deleted: worker.id_deleted,
    });
  });

  let inserted = 0;
  let updated = 0;
  let restored = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const row of resolvedRows) {
    const key = `${row.contractorId}::${row.workerName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (row.id) {
      const { error } = await supabase
        .from("workers")
        .update({
          name: row.workerName,
          contractor_id: row.contractorId,
          id_deleted: false,
          deleted_at: null,
        })
        .eq("id", row.id);
      if (error) {
        errors.push(`更新失敗: ${row.workerName}`);
      } else {
        updated += 1;
      }
      continue;
    }

    const existing = existingMap.get(key);
    if (existing) {
      if (existing.id_deleted) {
        const { error } = await supabase
          .from("workers")
          .update({ id_deleted: false, deleted_at: null })
          .eq("id", existing.id);
        if (error) {
          errors.push(`復活失敗: ${row.workerName}`);
        } else {
          restored += 1;
        }
      } else {
        skipped += 1;
      }
      continue;
    }

    const { error } = await supabase.from("workers").insert({
      name: row.workerName,
      contractor_id: row.contractorId,
      id_deleted: false,
    });
    if (error) {
      errors.push(`追加失敗: ${row.workerName}`);
    } else {
      inserted += 1;
    }
  }

  return Response.json({ inserted, updated, restored, skipped, errors });
}
