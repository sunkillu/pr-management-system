import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDate, campaignStatusLabels } from "@/lib/labels";
import ReportsClient from "./ReportsClient";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import RecordTimestamps from "@/components/RecordTimestamps";
import StateHistory from "@/components/StateHistory";

const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { campaignId?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = role === "ADMIN" || role === "PR";

  const campaignId = searchParams.campaignId || "";
  const where = campaignId ? { campaignId } : {};

  const pagination = getPagination(searchParams.page);
  const [campaigns, contents, reports, total] = await Promise.all([
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
      orderBy: [{ recordDate: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.report.count({ where }),
  ]);

  const [summaryCampaigns, reportTotals, paidTotals] = await Promise.all([
    prisma.campaign.findMany({
      ...(campaignId ? { where: { id: campaignId } } : {}),
      select: { id: true, name: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.report.groupBy({
      by: ["campaignId"],
      where,
      _sum: { impressions: true, reads: true, likes: true, comments: true, conversions: true, gmv: true },
    }),
    prisma.paymentRequest.groupBy({
      by: ["campaignId"],
      where: { status: "PAID", ...(campaignId ? { campaignId } : {}) },
      _sum: { amount: true },
    }),
  ]);
  const reportTotalsByCampaign = new Map(reportTotals.map((r) => [r.campaignId, r._sum]));
  const paidTotalsByCampaign = new Map(paidTotals.map((p) => [p.campaignId, Number(p._sum.amount ?? 0)]));
  const campaignLogs = summaryCampaigns.length
    ? await prisma.approvalLog.findMany({
        where: { docType: "CAMPAIGN", docId: { in: summaryCampaigns.map((campaign) => campaign.id) } },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historyByCampaign = new Map<string, typeof campaignLogs>();
  for (const log of campaignLogs) {
    const history = historyByCampaign.get(log.docId) ?? [];
    history.push(log);
    historyByCampaign.set(log.docId, history);
  }
  const agg = summaryCampaigns.map((c) => {
    const report = reportTotalsByCampaign.get(c.id);
    return ({
    id: c.id,
    name: c.name,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    impressions: report?.impressions ?? 0,
    reads: report?.reads ?? 0,
    likes: report?.likes ?? 0,
    comments: report?.comments ?? 0,
    conversions: report?.conversions ?? 0,
    gmv: Number(report?.gmv ?? 0),
    paid: paidTotalsByCampaign.get(c.id) ?? 0,
  });
  });

  const exportHref = campaignId ? `/api/reports/export?campaignId=${campaignId}` : "/api/reports/export";

  return (
    <div>
      <PageHeader
        title="效果报表"
        desc="按项目汇总曝光、转化、GMV 与已打款金额，支持导出 CSV"
        action={
          <span className="space-x-2">
            <Button variant="outline" asChild>
              <a href={exportHref}>导出 CSV</a>
            </Button>
            {canWrite && <ReportsClient canWrite={canWrite} campaigns={campaigns} contents={contents} />}
          </span>
        }
      />

      <h2 className="mb-3 text-lg font-semibold">项目汇总</h2>
      <div className="mb-6 overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>项目</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>状态历史</TableHead>
              <TableHead className="tabular-nums">曝光</TableHead>
              <TableHead className="tabular-nums">阅读</TableHead>
              <TableHead className="tabular-nums">点赞</TableHead>
              <TableHead className="tabular-nums">评论</TableHead>
              <TableHead className="tabular-nums">转化</TableHead>
              <TableHead className="tabular-nums">GMV（元）</TableHead>
              <TableHead className="tabular-nums">已打款（元）</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agg.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{campaignStatusLabels[a.status] ?? a.status}</TableCell>
                <TableCell><RecordTimestamps createdAt={a.createdAt} updatedAt={a.updatedAt} compact /></TableCell>
                <TableCell>
                  <StateHistory
                    items={(historyByCampaign.get(a.id) ?? []).map((log) => ({
                      id: log.id,
                      action: log.action,
                      actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
                      createdAt: log.createdAt,
                      note: log.note,
                      fromStatusLabel: log.fromStatus ? campaignStatusLabels[log.fromStatus] ?? log.fromStatus : null,
                      toStatusLabel: log.toStatus ? campaignStatusLabels[log.toStatus] ?? log.toStatus : null,
                    }))}
                  />
                </TableCell>
                <TableCell className="tabular-nums">{a.impressions.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{a.reads.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{a.likes.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{a.comments.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{a.conversions.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(a.gmv)}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(a.paid)}</TableCell>
              </TableRow>
            ))}
            {agg.length === 0 && (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">明细数据</h2>
      <form method="GET" className="mb-4 flex gap-2">
        <select name="campaignId" defaultValue={campaignId} className={selectCls}>
          <option value="">全部项目</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>项目</TableHead>
              <TableHead>关联内容</TableHead>
              <TableHead className="tabular-nums">曝光</TableHead>
              <TableHead className="tabular-nums">阅读</TableHead>
              <TableHead className="tabular-nums">点赞</TableHead>
              <TableHead className="tabular-nums">评论</TableHead>
              <TableHead className="tabular-nums">转化</TableHead>
              <TableHead className="tabular-nums">GMV（元）</TableHead>
              <TableHead>记录日期</TableHead>
              <TableHead>记录时间</TableHead>
              {canWrite && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.campaign.name}</TableCell>
                <TableCell>{r.content?.title ?? "-"}</TableCell>
                <TableCell className="tabular-nums">{r.impressions.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{r.reads.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{r.likes.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{r.comments.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{r.conversions.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(r.gmv)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(r.recordDate)}</TableCell>
                <TableCell><RecordTimestamps createdAt={r.createdAt} updatedAt={r.updatedAt} compact /></TableCell>
                {canWrite && (
                  <TableCell className="whitespace-nowrap">
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
                  </TableCell>
                )}
              </TableRow>
            ))}
            {reports.length === 0 && (
              <TableRow><TableCell colSpan={canWrite ? 11 : 10} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/reports" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
