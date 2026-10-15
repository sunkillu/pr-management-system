"use client";

import { INFLUENCER_TYPE_OPTIONS, platformLabels } from "@/lib/labels";

export default function DashboardFilters({
  brands,
  current,
}: {
  brands: { id: string; name: string }[];
  current: { brandId?: string; influencerType?: string; platform?: string };
}) {
  return (
    <form
      method="get"
      action="/"
      className="mb-6 flex flex-wrap items-end gap-3 rounded-[22px] bg-white p-4 shadow-[0_4px_24px_rgba(124,58,237,0.08)]"
      onChange={(e) => {
        const form = (e.target as HTMLElement).closest("form");
        form?.requestSubmit();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-muted-foreground">品牌</span>
        <select
          name="brandId"
          defaultValue={current.brandId ?? ""}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-muted-foreground">达人类型</span>
        <select
          name="influencerType"
          defaultValue={current.influencerType ?? ""}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部类型</option>
          {INFLUENCER_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs text-muted-foreground">平台</span>
        <select
          name="platform"
          defaultValue={current.platform ?? ""}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部平台</option>
          <option value="XIAOHONGSHU">{platformLabels.XIAOHONGSHU}</option>
          <option value="DOUYIN">{platformLabels.DOUYIN}</option>
        </select>
      </label>
      <a
        href="/"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
      >
        重置
      </a>
    </form>
  );
}
