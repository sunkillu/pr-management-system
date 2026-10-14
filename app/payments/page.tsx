import Link from "next/link";
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
import { paymentStatusLabels, formatMoney } from "@/lib/labels";
import PaymentsClient from "./PaymentsClient";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import type { TicketPrefill } from "@/components/PaymentForm";
import RecordTimestamps from "@/components/RecordTimestamps";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; newTicket?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as unknown as { id: string; role: string };
  const role = sessionUser.role;
  const canSubmit = role === "ADMIN" || role === "PR";
  const canDelete = role === "ADMIN" || role === "PR";

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.title = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.status) where.status = searchParams.status;

  // 工单一键生成打款单：预填收款方/金额/事由
  let ticketPrefill: TicketPrefill | undefined;
  if (searchParams.newTicket && canSubmit) {
    const ticket = await prisma.cooperationTicket.findUnique({
      where: { id: searchParams.newTicket },
      include: {
        influencer: { select: { name: true } },
        makeupArtist: { select: { name: true } },
      },
    });
    if (ticket && ticket.status === "COMPLETED") {
      ticketPrefill = {
        ticketId: ticket.id,
        ticketTitle: `合作工单结算-${ticket.title}`,
        amount: String(ticket.actualFee ?? ticket.budgetFee),
        payeeName: ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "",
        reason: `合作工单「${ticket.title}」结算`,
      };
    }
  }

  const pagination = getPagination(searchParams.page);
  const [payments, total, outlets, campaigns, contents] = await Promise.all([
    prisma.paymentRequest.findMany({
      where,
      include: { outlet: true, campaign: true, requester: true, _count: { select: { vouchers: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.paymentRequest.count({ where }),
    prisma.mediaOutlet.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.content.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  return (
    <div>
      <PageHeader
        title="打款审批"
        desc="普通打款：业务审批 → 财务审批；工单素材审批通过后直接进入财务审批。发票为选填，不阻塞流程。"
        action={
          canSubmit ? (
            <PaymentsClient role={role} outlets={outlets} campaigns={campaigns} contents={contents} ticketPrefill={ticketPrefill} />
          ) : undefined
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="按标题搜索"
          defaultValue={searchParams.q ?? ""}
          className="w-64"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">全部状态</option>
          {Object.entries(paymentStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead className="tabular-nums">金额（元）</TableHead>
              <TableHead>收款方</TableHead>
              <TableHead>关联</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>申请人</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link href={`/payments/${p.id}`} className="text-primary hover:underline">
                    {p.title}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{formatMoney(p.amount)}</TableCell>
                <TableCell>{p.payeeName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[p.outlet?.name, p.campaign?.name].filter(Boolean).join(" / ") || "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} label={paymentStatusLabels[p.status]} />
                </TableCell>
                <TableCell>{p.requester.name}</TableCell>
                <TableCell><RecordTimestamps createdAt={p.createdAt} updatedAt={p.updatedAt} compact /></TableCell>
                <TableCell className="whitespace-nowrap">
                  <PaymentsClient
                    role={role}
                    outlets={outlets}
                    campaigns={campaigns}
                    contents={contents}
                    editTarget={
                      (canSubmit || (role === "PR_MANAGER" && p.ticketId && p.requesterId === sessionUser.id)) &&
                      (p.status === "PENDING_BIZ" || p.status === "REJECTED")
                        ? {
                            id: p.id,
                            title: p.title,
                            amount: String(p.amount),
                            payeeName: p.payeeName,
                            payeeAccount: p.payeeAccount ?? "",
                            reason: p.reason ?? "",
                            outletId: p.outletId ?? "",
                            campaignId: p.campaignId ?? "",
                            contentId: p.contentId ?? "",
                          }
                        : undefined
                    }
                    actionTarget={{ id: p.id, ticketId: p.ticketId, status: p.status, isRequester: p.requesterId === sessionUser.id, voucherCount: p._count.vouchers }}
                    deleteId={canDelete ? p.id : undefined}
                  />
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/payments" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
