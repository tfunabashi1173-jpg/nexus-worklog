export async function GET() {
  const csv = "\uFEFFカテゴリ名,作業内容\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"work-types-template.csv\"",
    },
  });
}
