import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { outletTypeLabels, platformLabels, outletStatusLabels, formatMoney } from "@/lib/labels";
import OutletsClient from "./OutletsClient";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import RecordTimestamps from "@/components/RecordTimestamps";
import StateHistory from "@/components/StateHistory";

const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function OutletsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; platform?: string; status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = role === "ADMIN" || role === "PR";

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.name = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.platform) where.platform = searchParams.platform;
  if (searchParams.status) where.status = searchParams.status;

  const pagination = getPagination(searchParams.page);
  const [outlets, total] = await Promise.all([
    prisma.mediaOutlet.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.mediaOutlet.count({ where }),
  ]);
  const statusLogs = outlets.length
    ? await prisma.approvalLog.findMany({
        where: { docType: "OUTLET", docId: { in: outlets.map((outlet) => outlet.id) } },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historyByOutlet = new Map<string, typeof statusLogs>();
  for (const log of statusLogs) {
    const history = historyByOutlet.get(log.docId) ?? [];
    history.push(log);
    historyByOutlet.set(log.docId, history);
  }

  return (
    <div>
      <PageHeader
        title="媒体资源库"
        desc="维护达人 / KOC / 媒体 / 机构资源，支持搜索与筛选"
        action={<OutletsClient canWrite={canWrite} />}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="按名称搜索"
          defaultValue={searchParams.q ?? ""}
          className="w-64"
        />
        <select name="type" defaultValue={searchParams.type ?? ""} className={selectCls}>
          <option value="">全部类型</option>
          {Object.entries(outletTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="platform" defaultValue={searchParams.platform ?? ""} className={selectCls}>
          <option value="">全部平台</option>
          {Object.entries(platformLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className={selectCls}>
          <option value="">全部状态</option>
          {Object.entries(outletStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>平台</TableHead>
              <TableHead className="tabular-nums">粉丝量</TableHead>
              <TableHead>联系人</TableHead>
              <TableHead className="tabular-nums">报价（元）</TableHead>
              <TableHead>评分</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>状态历史</TableHead>
              {canWrite && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {outlets.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell>{outletTypeLabels[o.type]}</TableCell>
                <TableCell>{platformLabels[o.platform]}</TableCell>
                <TableCell className="tabular-nums">{o.followers.toLocaleString()}</TableCell>
                <TableCell>{o.contactName ?? "-"}<div className="text-xs text-muted-foreground">{o.contactInfo ?? ""}</div></TableCell>
                <TableCell className="tabular-nums">{o.priceQuote ? formatMoney(o.priceQuote) : "-"}</TableCell>
                <TableCell>{o.rating ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={o.status} label={outletStatusLabels[o.status]} />
                </TableCell>
                <TableCell><RecordTimestamps createdAt={o.createdAt} updatedAt={o.updatedAt} compact /></TableCell>
                <TableCell>
                  <StateHistory
                    items={(historyByOutlet.get(o.id) ?? []).map((log) => ({
                      id: log.id,
                      action: log.action,
                      actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
                      createdAt: log.createdAt,
                      note: log.note,
                      fromStatusLabel: log.fromStatus,
                      toStatusLabel: log.toStatus,
                    }))}
                  />
                </TableCell>
                {canWrite && (
                  <TableCell className="whitespace-nowrap">
                    <OutletsClient
                      canWrite={canWrite}
                      editTarget={{
                        id: o.id,
                        name: o.name,
                        type: o.type,
                        platform: o.platform,
                        followers: o.followers,
                        contactName: o.contactName ?? "",
                        contactInfo: o.contactInfo ?? "",
                        priceQuote: o.priceQuote ? String(o.priceQuote) : "",
                        rating: o.rating ? String(o.rating) : "",
                        notes: o.notes ?? "",
                        status: o.status,
                      }}
                      deleteId={o.id}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {outlets.length === 0 && (
              <TableRow><TableCell colSpan={canWrite ? 11 : 10} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/outlets" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
