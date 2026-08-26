"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function MilestoneVendorFilter({
  vendors,
  selectedVendorId,
}: {
  vendors: { id: string; vendor_name: string }[];
  selectedVendorId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("vendor", value);
    else params.delete("vendor");
    router.push(`/payment-milestones${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <label className="block min-w-[300px]">
      <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
        Supplier / Contractor
      </span>
      <select
        className="input bg-white font-semibold dark:bg-slate-900"
        value={selectedVendorId || ""}
        onChange={(e) => change(e.target.value)}
      >
        <option value="">All suppliers / contractors</option>
        {vendors.map((vendor) => (
          <option key={vendor.id} value={vendor.id}>
            {vendor.vendor_name}
          </option>
        ))}
      </select>
    </label>
  );
}
