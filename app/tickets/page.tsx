import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { ticketStatusLabels, coopTypeLabels, formatMoney, formatDate, platformTagLabels, ticketKindLabels, procurementSubTypeLabels } from "@/lib/labels";
import { APPROVAL_TIMEOUT_HOURS } from "@/lib/constants";
import Link from "next/link";
import TicketForm from "@/components/TicketForm";
import TicketBoard, { BoardTicket } from "@/components/TicketBoard";
import AutoRefresh from "@/components/AutoRefresh";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";

const VIEWS = [
  { key: "list", label: "列表" },
  { key: "board", label: "看板" },
] as const;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; type?: string; ticketKind?: string; view?: string; page?: string; tagId?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  // 运营只能发起采买工单；PR/管理员/PR负责人可发起合作工单
  const canWrite = ["ADMIN", "PR", "PR_MANAGER", "OPERATOR"].includes(role);
  const view = searchParams.view === "board" ? "board" : "list";

  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 3600 * 1000);

  const influencers = await prisma.influencer.findMany({
    // PR 只能选择自己登记的达人发起工单
    where: { status: "APPROVED", ...(role === "PR" ? { registeredById: (session?.user as unknown as { id: string }).id } : {}) },
    select: { id: true, name: true, homepageId: true },
    orderBy: { name: "asc" },
  });
  const makeupArtists = await prisma.makeupArtist.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const viewTab = (key: string) =>
    `/tickets${key === "board" ? "?view=board" : ""}`;

  // Keep the board bounded; historical tickets remain available in the paginated list.
  if (view === "board") {
    const all = await prisma.cooperationTicket.findMany({
      include: {
        influencer: { select: { name: true } },
        makeupArtist: { select: { name: true } },
        creator: { select: { name: true } },
        subtasks: { select: { status: true } },
        nodes: { select: { completedAt: true } },
        paymentRequests: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 200,
    });
    const boardTickets: BoardTicket[] = all.map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      title: t.title,
      type: t.type,
      status: t.status,
      budgetFee: String(t.budgetFee),
      influencer: t.influencer,
      makeupArtist: t.makeupArtist,
      creator: t.creator,
      overdue: t.status === "PENDING_APPROVAL" && t.updatedAt < cutoff,
      subtasks: t.subtasks.map((s) => ({ status: s.status })),
      nodes: t.nodes.map((n) => ({ completedAt: n.completedAt ? n.completedAt.toISOString() : null })),
      paymentRequests: t.paymentRequests,
    }));
    return (
      <div>
        <PageHeader
          title="合作工单"
          desc="PR 发起合作 → 审批 → 进度管理 → 打款结算"
          action={canWrite ? <TicketForm influencers={influencers} makeupArtists={makeupArtists} userRole={role} /> : undefined}
        />
        <div className="mb-5 flex gap-1 border-b">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={viewTab(v.key)}
              className={`-mb-px px-4 py-2.5 text-sm font-medium transition-colors ${
                view === v.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <TicketBoard tickets={boardTickets} role={role} />
        <p className="mt-3 text-xs text-muted-foreground">看板显示最近 200 条工单；更早的记录请使用列表筛选。</p>
      </div>
    );
  }

  // 列表视图
  // 标签筛选：先查出打了该标签的工单 id
  const ticketTags = await prisma.tag.findMany({
    where: { category: { key: "TICKET" } },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  let tagTicketIds: string[] | null = null;
  if (searchParams.tagId) {
    const recs = await prisma.tagging.findMany({
      where: { entityType: "TICKET", tagId: searchParams.tagId },
      select: { entityId: true },
    });
    tagTicketIds = recs.map((r) => r.entityId);
  }
  const where: Prisma.CooperationTicketWhereInput = {
      ...(searchParams.q
        ? {
            OR: [
              { title: { contains: searchParams.q, mode: "insensitive" } },
              { ticketNo: { contains: searchParams.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
      ...(searchParams.type ? { type: searchParams.type as never } : {}),
      ...(searchParams.ticketKind ? { ticketKind: searchParams.ticketKind as never } : {}),
      ...(tagTicketIds ? { id: { in: tagTicketIds } } : {}),
  };
  const pagination = getPagination(searchParams.page);
  const [list, total] = await Promise.all([
    prisma.cooperationTicket.findMany({
      where,
      include: {
        influencer: { select: { name: true } },
        makeupArtist: { select: { name: true } },
        creator: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.cooperationTicket.count({ where }),
  ]);

  const acceptCutoff = Date.now() - 12 * 3600 * 1000;

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="合作工单"
        desc="PR 发起合作 → 审批 → 进度管理 → 打款结算"
        action={canWrite ? <TicketForm influencers={influencers} makeupArtists={makeupArtists} userRole={role} /> : undefined}
      />

      <div className="mb-5 flex gap-1 border-b">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={viewTab(v.key)}
            className={`-mb-px px-4 py-2.5 text-sm font-medium transition-colors ${
              view === v.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="按标题/工单编号搜索"
          defaultValue={searchParams.q ?? ""}
          className="w-64"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">全部状态</option>
          {Object.entries(ticketStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="ticketKind" defaultValue={searchParams.ticketKind ?? ""} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">全部工单类型</option>
          {Object.entries(ticketKindLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="type" defaultValue={searchParams.type ?? ""} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">全部合作类型</option>
          {Object.entries(coopTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="tagId" defaultValue={searchParams.tagId ?? ""} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">全部标签</option>
          {ticketTags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>工单编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>工单类型</TableHead>
              <TableHead>合作类型</TableHead>
              <TableHead>平台</TableHead>
              <TableHead>合作对象</TableHead>
              <TableHead className="tabular-nums">预算（元）</TableHead>
              <TableHead>档期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>归属PR</TableHead>
              <TableHead>发起人</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((t) => {
              const overdue = t.status === "PENDING_APPROVAL" && t.updatedAt < cutoff;
              const acceptOverdue = t.ticketKind === "PROCUREMENT" && t.status === "APPROVED" &&
                !t.assignee && t.procurementApprovedAt && new Date(t.procurementApprovedAt).getTime() < acceptCutoff;
              return (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">
                      {t.ticketNo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    {t.title}
                    {overdue && (
                      <Badge variant="destructive" className="ml-2">已超时</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.ticketKind === "PROCUREMENT" ? "secondary" : "outline"}>
                      {ticketKindLabels[t.ticketKind] ?? t.ticketKind}
                    </Badge>
                    {t.ticketKind === "PROCUREMENT" && t.procurementType && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {procurementSubTypeLabels[t.procurementType] ?? t.procurementType}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{t.ticketKind === "PROCUREMENT" ? "-" : coopTypeLabels[t.type]}</TableCell>
                  <TableCell>{(t.platform as string[]).map((p) => platformTagLabels[p] ?? p).join("、") || "-"}</TableCell>
                  <TableCell>{t.influencer?.name ?? t.makeupArtist?.name ?? "-"}</TableCell>
                  <TableCell className="tabular-nums">{formatMoney(t.budgetFee)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.startDate ? formatDate(t.startDate) : "-"} ~ {t.endDate ? formatDate(t.endDate) : "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} label={ticketStatusLabels[t.status]} />
                    {acceptOverdue && (
                      <Badge variant="destructive" className="ml-2">接单超时</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.ticketKind === "PROCUREMENT" ? (t.assignee?.name ?? <span className="text-muted-foreground">待接单</span>) : "-"}
                  </TableCell>
                  <TableCell>{t.creator?.name ?? "-"}</TableCell>
                </TableRow>
              );
            })}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/tickets" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
