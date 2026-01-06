import { redirect } from "next/navigation";

export default async function WorkersBulkPage() {
  redirect("/masters/workers?tab=bulk");
}
