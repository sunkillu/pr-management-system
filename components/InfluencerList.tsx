import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thCls, tdCls, btnPrimary } from "@/components/ui";
import {
  influencerStatusLabels,
  influencerTypeLabels,
  INFLUENCER_TYPE_OPTIONS,
  platformTagLabels,
  PLATFORM_TAG_OPTIONS,
  badgeClass,
  formatFee,
} from "@/lib/labels";
import Link from "next/link";
import InfluencerForm from "@/components/InfluencerForm";
import InfluencerHoverCard from "@/components/InfluencerHoverCard";

export type InfluencerSearchParams = {
  q?: string;
  platform?: string;
  status?: string;
  type?: string;
  coop?: string;
  tag?: string | string[];
  prefill?: string;
  ptype?: string;
  pplatforms?: string;
};

// 达人列表（查询+筛选+表格），用于 /partners 的"达人" tab
export default async function InfluencerList({
  searchParams,
}: {
  searchParams: InfluencerSearchParams;
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);

  const where: Record<string, unknown> = {};
  // 数据权限：PR 只能看自己登记的；ADMIN / FINANCE / PR_MANAGER 可看全部
  if (role === "PR") where.registeredById = me.id;
  if (searchParams.q) where.name = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.platform) where.platforms = { has: searchParams.platform };
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.type) where.influencerType = searchParams.type;
  if (searchParams.coop === "none") where.coopCount = 0;
  if (searchParams.coop === "active") where.coopCount = { gt: 0 };
  // 标签多选筛选：命中任一标签即可
  const selectedTags = Array.isArray(searchParams.tag)
    ? searchParams.tag.filter(Boolean)
    : searchParams.tag
      ? [searchParams.tag]
      : [];
  if (selectedTags.length > 0) where.tags = { hasSome: selectedTags };

  const [list, allTags] = await Promise.all([
    prisma.influencer.findMany({
      where,
      include: {
        registeredBy: { select: { name: true } },
        cooperationRecords: { orderBy: { coopDate: "desc" }, take: 1, select: { fee: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // 标签筛选下拉：取库内所有已用标签（同样受数据权限约束）
    prisma.influencer.findMany({
      where: role === "PR" ? { registeredById: me.id } : {},
      select: { tags: true },
    }),
  ]);
  const tagOptions = Array.from(new Set(allTags.flatMap((r) => r.tags))).sort();

  // 从合作需求一键加入时的预填参数（ptype/pplatforms，与筛选参数区分）
  const prefill = searchParams.prefill === "1";
  const prefillType = searchParams.ptype ?? "";
  const prefillPlatforms = (searchParams.pplatforms ?? "").split(",").filter(Boolean);

  return (
    <div>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <InfluencerForm initial={{ influencerType: prefillType, platforms: prefillPlatforms }} autoOpen={prefill} />
        </div>
      )}

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="influencer" />
        <input
          name="q"
          placeholder="按姓名搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={searchParams.type ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {INFLUENCER_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select name="platform" defaultValue={searchParams.platform ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部平台</option>
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 [&::-webkit-details-marker]:hidden">
            {selectedTags.length > 0 ? `标签（${selectedTags.length}）` : "全部标签"}
          </summary>
          <div className="absolute z-10 mt-1 max-h-56 w-48 overflow-auto rounded-lg border border-[#e5e5e5] bg-white p-2 shadow-lg">
            {tagOptions.length === 0 && <p className="px-2 py-1 text-xs text-gray-400">暂无标签</p>}
            {tagOptions.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#f5f5f7]">
                <input
                  type="checkbox"
                  name="tag"
                  value={t}
                  defaultChecked={selectedTags.includes(t)}
                  className="h-4 w-4 accent-[#0071e3]"
                />
                {t}
              </label>
            ))}
          </div>
        </details>
        <select name="coop" defaultValue={searchParams.coop ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部合作状态</option>
          <option value="none">未合作</option>
          <option value="active">合作中</option>
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部审核状态</option>
          {Object.entries(influencerStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>姓名</th>
              <th className={thCls}>达人类型</th>
              <th className={thCls}>平台</th>
              <th className={thCls}>标签</th>
              <th className={thCls}>合作状态</th>
              <th className={thCls}>合作次数</th>
              <th className={thCls}>最近合作金额</th>
              <th className={thCls}>累计费用</th>
              <th className={thCls}>平均评价</th>
              <th className={thCls}>审核状态</th>
              <th className={thCls}>登记人</th>
              {canWrite && <th className={thCls}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>
                  <InfluencerHoverCard id={r.id} name={r.name} />
                </td>
                <td className={tdCls}>{r.influencerType ? influencerTypeLabels[r.influencerType] ?? r.influencerType : "-"}</td>
                <td className={tdCls}>
                  {r.platforms.length > 0
                    ? r.platforms.map((p) => platformTagLabels[p] ?? p).join("、")
                    : "-"}
                </td>
                <td className={tdCls}>
                  {r.tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 ring-1 ring-blue-200">
                          {t}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={tdCls}>
                  {r.coopCount === 0 ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300">
                      未合作
                    </span>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      合作中
                    </span>
                  )}
                </td>
                <td className={tdCls}>{r.coopCount}</td>
                <td className={tdCls}>
                  {r.cooperationRecords.length > 0 ? formatFee(r.cooperationRecords[0].fee) : "-"}
                </td>
                <td className={tdCls}>{formatFee(r.totalFee)}</td>
                <td className={tdCls}>
                  {r.reviews.length > 0 ? (
                    <span className="text-yellow-600">
                      ★ {(r.reviews.reduce((s, x) => s + x.rating, 0) / r.reviews.length).toFixed(1)}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                    {influencerStatusLabels[r.status]}
                  </span>
                </td>
                <td className={tdCls}>{r.registeredBy?.name ?? "-"}</td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    {r.status === "APPROVED" ? (
                      <Link
                        href={`/tickets/new?influencerId=${r.id}`}
                        className="rounded border border-[#0071e3] px-2.5 py-1 text-xs text-[#0071e3] hover:bg-blue-50"
                      >
                        发起工单
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={canWrite ? 12 : 11} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
