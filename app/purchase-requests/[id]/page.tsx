import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PurchaseRequestDetailClient from "@/components/PurchaseRequestDetailClient";
import PurchaseRequestStatusBadge from "@/components/PurchaseRequestStatusBadge";
import RecordTimestamps from "@/components/RecordTimestamps";
import StateHistory from "@/components/StateHistory";
import { InfoRow, PageHeader, Section } from "@/components/ui";
import { formatDateTime } from "@/lib/labels";
import {
  PURCHASE_LINE_STATUS_LABELS,
  PURCHASE_PLATFORM_LABELS,
  PURCHASE_REQUEST_STATUS_LABELS,
  canViewPurchaseRequest,
  isPurchasePageRole,
  sumQuantities,
} from "@/lib/purchase-shared";

export default async function PurchaseRequestDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (!me?.id || !isPurchasePageRole(me.role)) redirect("/");

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true } },
      lines: {
        orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
        include: {
          reviewedBy: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          ticket: { select: { id: true, ticketNo: true, title: true } },
        },
      },
    },
  });
  if (!request) notFound();
  if (!canViewPurchaseRequest(me.role, me.id, request.creatorId)) redirect("/");

  const [logs, prs] = await Promise.all([
    prisma.approvalLog.findMany({
      where: {
        OR: [
          { docType: "PURCHASE", docId: request.id },
          { docType: "PURCHASE_LINE", docId: { in: request.lines.map((line) => line.id) } },
        ],
      },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    me.role === "ADMIN" || me.role === "PR_MANAGER"
      ? prisma.user.findMany({ where: { role: "PR" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const lineMap = new Map(request.lines.map((line) => [line.id, line]));
  const timeline = logs.map((log) => {
    const line = log.docType === "PURCHASE_LINE" ? lineMap.get(log.docId) : null;
    const summary = line
      ? `第 ${line.sort + 1} 行｜${PURCHASE_PLATFORM_LABELS[line.platform] ?? line.platform}｜${line.style}×${line.quantity}`
      : null;
    return {
      id: log.id,
      action: log.action,
      actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
      createdAt: log.createdAt,
      note: summary ? `${summary}${log.note ? `\n${log.note}` : ""}` : log.note,
      fromStatusLabel: log.fromStatus
        ? (log.docType === "PURCHASE_LINE" ? PURCHASE_LINE_STATUS_LABELS[log.fromStatus] : PURCHASE_REQUEST_STATUS_LABELS[log.fromStatus]) ?? log.fromStatus
        : null,
      toStatusLabel: log.toStatus
        ? (log.docType === "PURCHASE_LINE" ? PURCHASE_LINE_STATUS_LABELS[log.toStatus] : PURCHASE_REQUEST_STATUS_LABELS[log.toStatus]) ?? log.toStatus
        : null,
    };
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg bg-card [&>section:first-child]:border-t-0">
        <PageHeader
          title={request.requestNo}
          desc={`${PURCHASE_REQUEST_STATUS_LABELS[request.status] ?? request.status} · ${request.lines.length} 行 / 总数量 ${sumQuantities(request.lines)}`}
          action={
            <Link href="/purchase-requests" className="text-sm text-primary hover:underline">
              ← 返回采买请求
            </Link>
          }
        />
        <Section first>
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border pb-3">
            <PurchaseRequestStatusBadge status={request.status} label={PURCHASE_REQUEST_STATUS_LABELS[request.status] ?? request.status} />
            <span className="text-sm text-muted-foreground">提交人：{request.creator.name}</span>
            <span className="text-sm text-muted-foreground">总数量：{sumQuantities(request.lines)}</span>
          </div>
          <RecordTimestamps createdAt={request.createdAt} updatedAt={request.updatedAt} />
          <dl className="mt-4">
            <InfoRow label="审批完成时间">{request.reviewedAt ? formatDateTime(request.reviewedAt) : "-"}</InfoRow>
            <InfoRow label="分配完成时间">{request.assignedAt ? formatDateTime(request.assignedAt) : "-"}</InfoRow>
            <InfoRow label="备注" wide>{request.note || "-"}</InfoRow>
          </dl>
        </Section>
        <Section title="采买行明细">
          <PurchaseRequestDetailClient
            requestId={request.id}
            requestNo={request.requestNo}
            requestStatus={request.status}
            role={me.role}
            prs={prs}
            lines={request.lines.map((line) => ({
              id: line.id,
              sort: line.sort,
              platform: line.platform,
              link: line.link,
              style: line.style,
              quantity: line.quantity,
              status: line.status,
              createdAt: line.createdAt.toISOString(),
              updatedAt: line.updatedAt.toISOString(),
              reviewedAt: line.reviewedAt ? line.reviewedAt.toISOString() : null,
              reviewNote: line.reviewNote,
              assigneeId: line.assigneeId,
              assignedAt: line.assignedAt ? line.assignedAt.toISOString() : null,
              ticketId: line.ticketId,
              ticketNo: line.ticket?.ticketNo ?? null,
              reviewedByName: line.reviewedBy?.name ?? null,
              assigneeName: line.assignee?.name ?? null,
            }))}
          />
        </Section>
      </div>
      <div className="rounded-lg bg-card h-fit [&>section:first-child]:border-t-0">
        <Section title="操作历史" first>
          <StateHistory items={timeline} label="查看历史" />
        </Section>
      </div>
    </div>
  );
}
