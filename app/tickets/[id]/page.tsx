import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Section, InfoRow } from "@/components/ui";
import {
  ticketStatusLabels,
  coopTypeLabels,
  approverStatusLabels,
  badgeClass,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { APPROVAL_TIMEOUT_HOURS } from "@/lib/constants";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import TicketActions from "@/components/TicketActions";
import TicketNodes from "@/components/TicketNodes";
import TicketSubtasks from "@/components/TicketSubtasks";
import TicketComments from "@/components/TicketComments";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;

  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: {
      influencer: { select: { id: true, name: true } },
      makeupArtist: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      nodes: {
        orderBy: { sort: "asc" },
        include: { completedBy: { select: { name: true } } },
      },
      subtasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
      reviews: { include: { reviewer: { select: { name: true } } } },
      paymentRequests: {
        select: { id: true, title: true, amount: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!ticket) notFound();

  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "TICKET", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const logs = await prisma.approvalLog.findMany({
    where: { docType: "TICKET", docId: params.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const notifications = await prisma.notificationLog.findMany({
    where: { relatedType: "TICKET", relatedId: params.id },
    include: { receiver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const comments = await prisma.ticketComment.findMany({
    where: { ticketId: params.id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const timeline: TimelineItem[] = logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor.name,
    createdAt: l.createdAt,
    note: l.note,
    fromStatusLabel: l.fromStatus ? ticketStatusLabels[l.fromStatus] ?? l.fromStatus : null,
    toStatusLabel: l.toStatus ? ticketStatusLabels[l.toStatus] ?? l.toStatus : null,
  }));

  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 3600 * 1000);
  const overdue = ticket.status === "PENDING_APPROVAL" && ticket.updatedAt < cutoff;
  const partnerName = ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "-";
  const partnerHref = ticket.influencer
    ? `/influencers/${ticket.influencer.id}`
    : ticket.makeupArtist
    ? `/makeup-artists/${ticket.makeupArtist.id}`
    : null;
  const canUpdateNodes = ["APPROVED", "IN_PROGRESS"].includes(ticket.status) &&
    ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);
  const canWriteComment = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);
  const canManageSubtasks =
    ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role) &&
    !["VOIDED", "SETTLED"].includes(ticket.status);
  const incompleteSubtasks = ticket.subtasks.filter((s) => s.status !== "DONE").length;

  return (
    <div>
      <PageHeader
        title={ticket.title}
        desc={`${coopTypeLabels[ticket.type]} · ${ticketStatusLabels[ticket.status]}`}
        action={
          <Link href="/tickets" className="text-sm text-[#0071e3] hover:underline">
            ← 返回合作工单
          </Link>
        }
      />
      {overdue && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          该工单已超过 {APPROVAL_TIMEOUT_HOURS} 小时未审批，已升级通知管理员。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-2xl lg:col-span-2 h-fit [&>section:first-child]:border-t-0">
          {/* 基本信息 */}
          <Section title="基本信息">
            <dl>
              <InfoRow label="合作对象">
                <span className="font-medium">
                  {partnerHref ? <Link href={partnerHref} className="text-[#0071e3] hover:underline">{partnerName}</Link> : partnerName}
                </span>
              </InfoRow>
              <InfoRow label="合作类型">{coopTypeLabels[ticket.type]}</InfoRow>
              <InfoRow label="预算费用">¥{formatMoney(ticket.budgetFee)}</InfoRow>
              <InfoRow label="实际费用">{ticket.actualFee ? `¥${formatMoney(ticket.actualFee)}` : "-"}</InfoRow>
              <InfoRow label="档期">{ticket.startDate ? formatDate(ticket.startDate) : "-"} ~ {ticket.endDate ? formatDate(ticket.endDate) : "-"}</InfoRow>
              <InfoRow label="发起人">{ticket.creator.name}</InfoRow>
              {ticket.rejectReason && (
                <InfoRow label="驳回理由" wide><span className="text-red-600">{ticket.rejectReason}</span></InfoRow>
              )}
              {ticket.voidReason && (
                <InfoRow label="作废理由" wide><span className="text-gray-600">{ticket.voidReason}</span></InfoRow>
              )}
              {ticket.note && (
                <InfoRow label="备注" wide><span className="whitespace-pre-wrap">{ticket.note}</span></InfoRow>
              )}
              {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                <InfoRow label="插图 / 附件" wide>
                  <span className="flex flex-wrap gap-2">
                    {(ticket.attachments as { fileUrl: string; fileName: string }[]).map((a, i) =>
                      /\.(jpe?g|png|webp|gif)$/i.test(a.fileName) ? (
                        <a key={i} href={a.fileUrl} target="_blank" title={a.fileName}>
                          <img src={a.fileUrl} alt={a.fileName} className="h-24 w-24 rounded-[10px] border border-[#e5e5e5] object-cover" />
                        </a>
                      ) : (
                        <a key={i} href={a.fileUrl} target="_blank"
                          className="rounded-[10px] border border-[#e5e5e5] bg-[#f5f5f7] px-3 py-2 text-sm text-[#0071e3] hover:underline">
                          {a.fileName}
                        </a>
                      )
                    )}
                  </span>
                </InfoRow>
              )}
            </dl>
          </Section>

          {/* 进度节点 */}
          <Section title="进度节点">
            <TicketNodes
              ticketId={ticket.id}
              nodes={ticket.nodes.map((n) => ({
                id: n.id,
                name: n.name,
                sort: n.sort,
                expectedAt: n.expectedAt ? n.expectedAt.toISOString() : null,
                completedAt: n.completedAt ? n.completedAt.toISOString() : null,
                completedBy: n.completedBy,
              }))}
              canUpdate={canUpdateNodes}
            />
          </Section>

          {/* 子任务 */}
          <Section title={`子任务（${ticket.subtasks.filter((s) => s.status === "DONE").length}/${ticket.subtasks.length}）`}>
            <TicketSubtasks
              ticketId={ticket.id}
              initial={ticket.subtasks.map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                assigneeId: s.assigneeId,
                assignee: s.assignee,
                dueDate: s.dueDate ? s.dueDate.toISOString() : null,
                sortOrder: s.sortOrder,
              }))}
              users={users}
              canManage={canManageSubtasks}
            />
          </Section>

          {/* 审批区 */}
          <Section id="approval-section" title="审批">
            {approvers.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {approvers.map((a) => (
                  <span key={a.id} className={`rounded px-2 py-0.5 text-xs ${badgeClass(a.status)}`}>
                    {a.approver.name}：{approverStatusLabels[a.status] ?? a.status}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-gray-400">草稿状态，尚未提交审批</p>
            )}
            <TicketActions ticket={{ id: ticket.id, title: ticket.title, status: ticket.status, creatorId: ticket.creator.id, actualFee: ticket.actualFee, incompleteSubtasks }} userId={me.id} role={role} />
          </Section>

          {/* 关联打款单 */}
          {ticket.paymentRequests.length > 0 && (
            <Section title="关联打款单">
              <div className="space-y-2">
                {ticket.paymentRequests.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/payments/${p.id}`} className="text-[#0071e3] hover:underline">{p.title}</Link>
                    <span>¥{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 合作评价 */}
          {ticket.reviews.length > 0 && (
            <Section title="合作评价">
              {ticket.reviews.map((r) => (
                <div key={r.id} className="rounded bg-[#f5f5f7] p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="text-xs text-gray-500">{r.reviewer.name} · {formatDateTime(r.createdAt)}</span>
                  </div>
                  {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
                </div>
              ))}
            </Section>
          )}

          {/* 评论区 */}
          <Section title="评论（{comments.length}）">
            <TicketComments
              ticketId={ticket.id}
              initial={comments.map((c) => ({
                id: c.id,
                content: c.content,
                mentionedIds: c.mentionedIds,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
              }))}
              users={users}
              canWrite={canWriteComment}
              currentUserId={me.id}
            />
          </Section>
        </div>

        <div className="bg-white rounded-2xl h-fit [&>section:first-child]:border-t-0">
          {/* 操作历史 */}
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>
          {/* 通知记录 */}
          {notifications.length > 0 && (
            <Section title="通知记录">
              <div className="space-y-2 text-xs">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded bg-[#f5f5f7] p-2">
                    <div className="flex justify-between text-gray-500">
                      <span>{n.receiver?.name ?? "未知"}</span>
                      <span>{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-gray-700">{n.content.slice(0, 80)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
