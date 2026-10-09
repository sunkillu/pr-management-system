import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import {
  influencerStatusLabels,
  platformTagLabels,
  PLATFORM_TAG_OPTIONS,
  badgeClass,
  formatFee,
} from "@/lib/labels";
import Link from "next/link";
import InfluencerForm from "@/components/InfluencerForm";

export default async function InfluencersPage({
  searchParams,
}: {
  searchParams: { q?: string; platform?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.name = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.platform) where.platforms = { has: searchParams.platform };
  if (searchParams.status) where.status = searchParams.status;

  const list = await prisma.influencer.findMany({
    where,
    include: { registeredBy: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="达人库"
        desc="提报达人登记 → 负责人审批 → 通过后可用于合作；合作次数与累计费用由合作记录自动累计"
        action={canWrite ? <InfluencerForm /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按姓名搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="platform" defaultValue={searchParams.platform ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部平台</option>
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(influencerStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="rounded bg-gray-800 px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>姓名</th>
              <th className={thCls}>平台</th>
              <th className={thCls}>联系方式</th>
              <th className={thCls}>合作次数</th>
              <th className={thCls}>累计费用</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>登记人</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>
                  <Link href={`/influencers/${r.id}`} className="text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className={tdCls}>
                  {r.platforms.length > 0
                    ? r.platforms.map((p) => platformTagLabels[p] ?? p).join("、")
                    : "-"}
                </td>
                <td className={tdCls}>{r.contactInfo ?? "-"}</td>
                <td className={tdCls}>{r.coopCount}</td>
                <td className={tdCls}>{formatFee(r.totalFee)}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                    {influencerStatusLabels[r.status]}
                  </span>
                </td>
                <td className={tdCls}>{r.registeredBy?.name ?? "-"}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
