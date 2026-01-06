"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";

type ContractorOption = {
  partner_id: string;
  name: string;
};

export default function WorkersFilterForm({
  contractors,
  contractorFilter,
}: {
  contractors: ContractorOption[];
  contractorFilter: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(contractorFilter);

  useEffect(() => {
    setValue(contractorFilter);
  }, [contractorFilter]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue) {
      params.set("contractor", nextValue);
    } else {
      params.delete("contractor");
    }
    params.delete("error");
    params.delete("success");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <div>
        <label className="text-sm font-medium">協力業者</label>
        <select
          name="contractor"
          value={value}
          onChange={handleChange}
          className="mt-1 min-w-[240px] rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">全て表示</option>
          {contractors.map((contractor) => (
            <option key={contractor.partner_id} value={contractor.partner_id}>
              {contractor.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
