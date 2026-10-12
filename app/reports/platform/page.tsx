import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { formatMoney } from "@/lib/labels";
import { PLATFORM_TAG_OPTIONS, platformTagLabels } from "@/lib/labels";

// 平台数据汇总：按平台（小红书/抖音）汇总内容数、总花费、平均费用、达人数
// 数据来源：Content.platform / Content.cost（子内容）；达人数经工单关联去重
export default async function PlatformReportsPage({
  searchParams,
}: {
  searchParams: { platform?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me?.role ?? "";
  if (!["ADMIN", "PR_MANAGER", "FINANCE"].includes(role)) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-lg font-medium">无权限</p>
        <p className="mt-2 text-sm text-gray-500">平台数据汇总仅管理员 / PR负责人 / 财务可查看。</p>
      </div>
    );
  }

  const platformFilter = searchParams.platform || "";
  const from = searchParams.from || "";
  const to = searchParams.to || "";

  const where: Record<string, unknown> = { platform: { not: null } };
  if (platformFilter) where.platform = platformFilter;
  const createdAt: Record<string, Date> = {};
  if (from) {
    const d = new Date(from + "T00:00:00");
    if (!isNaN(d.getTime())) createdAt.gte = d;
  }
  if (to) {
    const d = new Date(to + "T23:59:59");
    if (!isNaN(d.getTime())) createdAt.lte = d;
  }
  if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

  const contents = await prisma.content.findMany({
    where,
    select: {
      id: true,
      platform: true,
      cost: true,
      ticketId: true,
      ticket: { select: { influencerId: true } },
    },
    take: 20000,
  });

  type Agg = { count: number; totalCost: number; costCount: number; influencers: Set<string> };
  const byPlatform = new Map<string, Agg>();
  for (const c of contents) {
    const p = c.platform as string;
    let a = byPlatform.get(p);
    if (!a) {
      a = { count: 0, totalCost: 0, costCount: 0, influencers: new Set() };
      byPlatform.set(p, a);
    }
    a.count++;
    if (c.cost != null) {
      a.totalCost += Number(c.cost);
      a.costCount++;
    }
    if (c.ticket?.influencerId) a.influencers.add(c.ticket.influencerId);
  }

  const rows = Array.from(byPlatform.entries()).map(([p, a]) => ({
    platform: p,
    label: platformTagLabels[p] ?? p,
    count: a.count,
    totalCost: a.totalCost,
    avgCost: a.costCount > 0 ? a.totalCost / a.costCount : 0,
    influencerCount: a.influencers.size,
  }));

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);

  const query = new URLSearchParams();
  if (platformFilter) query.set("platform", platformFilter);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const qs = query.toString();

  return (
    <div>
      <PageHeader
        title="平台数据汇总"
        desc={`按平台汇总子内容数据：内容数 ${totalCount} · 总花费 ¥${formatMoney(totalCost)}`}
        action={
          <a
            href={`/api/admin/export?type=contents${qs ? `&${qs}` : ""}`}
            className="rounded-full bg-[#0071e3] px-4 py-1.5 text-sm text-white"
          >
            导出明细
          </a>
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <select
          name="platform"
          defaultValue={platformFilter}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部平台</option>
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-400">至</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button className="rounded-full bg-[#0071e3] px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e5e5e5]">
              <th className={thCls}>平台</th>
              <th className={thCls}>内容数</th>
              <th className={thCls}>总花费（元）</th>
              <th className={thCls}>平均费用（元）</th>
              <th className={thCls}>合作达人数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.platform} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                <td className={tdCls}>
                  <span className="font-medium">{r.label}</span>
                </td>
                <td className={tdCls}>{r.count}</td>
                <td className={tdCls}>¥{formatMoney(r.totalCost)}</td>
                <td className={tdCls}>¥{formatMoney(r.avgCost)}</td>
                <td className={tdCls}>{r.influencerCount}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                  暂无数据（子内容需填写平台后才会统计）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        说明：统计口径为工单下的子内容（Content.platform / cost）；平均费用按有花费的子内容计算。
      </p>
    </div>
  );
}
