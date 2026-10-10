import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/labels";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { campaignId?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = role === "ADMIN" || role === "OPERATOR";

  const campaignId = searchParams.campaignId || "";
  const where = campaignId ? { campaignId } : {};

  const [campaigns, contents, reports] = await Promise.all([
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.content.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.report.findMany({
      where,
      include: { campaign: true, content: true },
      orderBy: { recordDate: "desc" },
    }),
  ]);

  // 按项目汇总：效果数据 + 已打款金额
  const summary = await prisma.campaign.findMany({
    ...(campaignId ? { where: { id: campaignId } } : {}),
    select: {
      id: true,
      name: true,
      reports: {
        select: { impressions: true, reads: true, likes: true, comments: true, conversions: true, gmv: true },
      },
      paymentRequests: {
        where: { status: "PAID" },
        select: { amount: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const agg = summary.map((c) => ({
    id: c.id,
    name: c.name,
    impressions: c.reports.reduce((s, r) => s + r.impressions, 0),
    reads: c.reports.reduce((s, r) => s + r.reads, 0),
    likes: c.reports.reduce((s, r) => s + r.likes, 0),
    comments: c.reports.reduce((s, r) => s + r.comments, 0),
    conversions: c.reports.reduce((s, r) => s + r.conversions, 0),
    gmv: c.reports.reduce((s, r) => s + Number(r.gmv), 0),
    paid: c.paymentRequests.reduce((s, p) => s + Number(p.amount), 0),
  }));

  const exportHref = campaignId ? `/api/reports/export?campaignId=${campaignId}` : "/api/reports/export";

  return (
    <div>
      <PageHeader
        title="效果报表"
        desc="按项目汇总曝光、转化、GMV 与已打款金额，支持导出 CSV"
        action={
          <span className="space-x-2">
            <a
              href={exportHref}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              导出 CSV
            </a>
            {canWrite && <ReportsClient canWrite={canWrite} campaigns={campaigns} contents={contents} />}
          </span>
        }
      />

      <h2 className="mb-3 text-lg font-semibold">项目汇总</h2>
      <div className="mb-6 overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>项目</th>
              <th className={thCls}>曝光</th>
              <th className={thCls}>阅读</th>
              <th className={thCls}>点赞</th>
              <th className={thCls}>评论</th>
              <th className={thCls}>转化</th>
              <th className={thCls}>GMV（元）</th>
              <th className={thCls}>已打款（元）</th>
            </tr>
          </thead>
          <tbody>
            {agg.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{a.name}</td>
                <td className={tdCls}>{a.impressions.toLocaleString()}</td>
                <td className={tdCls}>{a.reads.toLocaleString()}</td>
                <td className={tdCls}>{a.likes.toLocaleString()}</td>
                <td className={tdCls}>{a.comments.toLocaleString()}</td>
                <td className={tdCls}>{a.conversions.toLocaleString()}</td>
                <td className={tdCls}>{formatMoney(a.gmv)}</td>
                <td className={tdCls}>{formatMoney(a.paid)}</td>
              </tr>
            ))}
            {agg.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">明细数据</h2>
      <form method="GET" className="mb-4 flex gap-2">
        <select name="campaignId" defaultValue={campaignId} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部项目</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="rounded bg-gray-800 px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>项目</th>
              <th className={thCls}>关联内容</th>
              <th className={thCls}>曝光</th>
              <th className={thCls}>阅读</th>
              <th className={thCls}>点赞</th>
              <th className={thCls}>评论</th>
              <th className={thCls}>转化</th>
              <th className={thCls}>GMV（元）</th>
              <th className={thCls}>记录日期</th>
              {canWrite && <th className={thCls}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls}>{r.campaign.name}</td>
                <td className={tdCls}>{r.content?.title ?? "-"}</td>
                <td className={tdCls}>{r.impressions.toLocaleString()}</td>
                <td className={tdCls}>{r.reads.toLocaleString()}</td>
                <td className={tdCls}>{r.likes.toLocaleString()}</td>
                <td className={tdCls}>{r.comments.toLocaleString()}</td>
                <td className={tdCls}>{r.conversions.toLocaleString()}</td>
                <td className={tdCls}>{formatMoney(r.gmv)}</td>
                <td className={tdCls}>{formatDate(r.recordDate)}</td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <ReportsClient
                      canWrite={canWrite}
                      campaigns={campaigns}
                      contents={contents}
                      editTarget={{
                        id: r.id,
                        campaignId: r.campaignId,
                        contentId: r.contentId ?? "",
                        impressions: r.impressions,
                        reads: r.reads,
                        likes: r.likes,
                        comments: r.comments,
                        conversions: r.conversions,
                        gmv: String(r.gmv),
                        recordDate: r.recordDate.toISOString().slice(0, 10),
                        notes: r.notes ?? "",
                      }}
                      deleteId={r.id}
                    />
                  </td>
                )}
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
