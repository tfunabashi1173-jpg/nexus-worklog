import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import ContractorDefaultsTable from "@/components/ContractorDefaultsTable";

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

function stripLegalSuffix(name: string) {
  let trimmed = name.trim();
  CORPORATE_TOKENS.forEach((token) => {
    if (trimmed.startsWith(token)) {
      trimmed = trimmed.slice(token.length).trim();
    }
    if (trimmed.endsWith(token)) {
      trimmed = trimmed.slice(0, -token.length).trim();
    }
  });
  return trimmed || name;
}

export default async function ContractorsPage() {
  const session = await getSession();
  if (!session || session.role === "guest") {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">協力業者</h1>
        <p className="mt-2 text-sm text-zinc-600">
          ゲストユーザーは閲覧できません。
        </p>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [{ data: contractors }, { data: workCategories }] = await Promise.all([
    supabase
      .from("partners")
      .select("partner_id, name, default_work_category_id, show_in_attendance")
      .eq("category", "協力業者")
      .or("is_deleted.is.false,is_deleted.is.null")
      .order("partner_id"),
    supabase
      .from("work_categories")
      .select("id, name")
      .or("id_deleted.is.false,id_deleted.is.null")
      .order("name"),
  ]);
  const sortedContractors = (contractors ?? [])
    .map((contractor) => ({
      ...contractor,
      display_name: stripLegalSuffix(contractor.name),
    }))
    .toSorted((a, b) => a.display_name.localeCompare(b.display_name, "ja"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">協力業者</h1>
        <p className="text-sm text-zinc-600">
          協力業者のデフォルトカテゴリを管理します。
        </p>
      </div>

      <ContractorDefaultsTable
        contractors={sortedContractors}
        workCategories={workCategories ?? []}
      />
    </div>
  );
}
