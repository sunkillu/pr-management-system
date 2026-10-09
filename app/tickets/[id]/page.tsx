import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
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

  return (
    <div>
      <PageHeader
        title={ticket.title}
        desc={`${coopTypeLabels[ticket.type]} · ${ticketStatusLabels[ticket.status]}`}
        action={
          <Link href="/tickets" className="text-sm text-blue-600 hover:underline">
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
        <div className="space-y-4 lg:col-span-2">
          {/* 基本信息 */}
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-medium">基本信息</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><dt className="text-gray-500">合作对象</dt><dd className="font-medium">
                {partnerHref ? <Link href={partnerHref} className="text-blue-600 hover:underline">{partnerName}</Link> : partnerName}
              </dd></div>
              <div><dt className="text-gray-500">合作类型</dt><dd>{coopTypeLabels[ticket.type]}</dd></div>
              <div><dt className="text-gray-500">预算费用</dt><dd>¥{formatMoney(ticket.budgetFee)}</dd></div>
              <div><dt className="text-gray-500">实际费用</dt><dd>{ticket.actualFee ? `¥${formatMoney(ticket.actualFee)}` : "-"}</dd></div>
              <div><dt className="text-gray-500">档期</dt><dd>{ticket.startDate ? formatDate(ticket.startDate) : "-"} ~ {ticket.endDate ? formatDate(ticket.endDate) : "-"}</dd></div>
              <div><dt className="text-gray-500">发起人</dt><dd>{ticket.creator.name}</dd></div>
              {ticket.rejectReason && (
                <div className="col-span-2"><dt className="text-gray-500">驳回理由</dt><dd className="text-red-600">{ticket.rejectReason}</dd></div>
              )}
              {ticket.voidReason && (
                <div className="col-span-2"><dt className="text-gray-500">作废理由</dt><dd className="text-gray-600">{ticket.voidReason}</dd></div>
              )}
              {ticket.note && (
                <div className="col-span-2"><dt className="text-gray-500">备注</dt><dd className="whitespace-pre-wrap">{ticket.note}</dd></div>
              )}
              {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-gray-500">插图 / 附件</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {(ticket.attachments as { fileUrl: string; fileName: string }[]).map((a, i) =>
                      /\.(jpe?g|png|webp|gif)$/i.test(a.fileName) ? (
                        <a key={i} href={a.fileUrl} target="_blank" title={a.fileName}>
                          <img src={a.fileUrl} alt={a.fileName} className="h-24 w-24 rounded border border-gray-200 object-cover hover:ring-2 hover:ring-blue-300" />
                        </a>
                      ) : (
                        <a key={i} href={a.fileUrl} target="_blank"
                          className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-blue-600 hover:underline">
                          {a.fileName}
                        </a>
                      )
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* 进度节点 */}
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-medium">进度节点</h3>
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
          </div>

          {/* 审批区 */}
          <div id="approval-section" className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-medium">审批</h3>
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
            <TicketActions ticket={{ id: ticket.id, title: ticket.title, status: ticket.status, creatorId: ticket.creator.id, actualFee: ticket.actualFee }} userId={me.id} role={role} />
          </div>

          {/* 关联打款单 */}
          {ticket.paymentRequests.length > 0 && (
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="mb-3 font-medium">关联打款单</h3>
              <div className="space-y-2">
                {ticket.paymentRequests.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/payments/${p.id}`} className="text-blue-600 hover:underline">{p.title}</Link>
                    <span>¥{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 合作评价 */}
          {ticket.reviews.length > 0 && (
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="mb-3 font-medium">合作评价</h3>
              {ticket.reviews.map((r) => (
                <div key={r.id} className="rounded bg-gray-50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="text-xs text-gray-500">{r.reviewer.name} · {formatDateTime(r.createdAt)}</span>
                  </div>
                  {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}

          {/* 评论区 */}
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-medium">评论（{comments.length}）</h3>
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
          </div>
        </div>

        <div className="space-y-4">
          {/* 操作历史 */}
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-medium">操作历史</h3>
            <ApprovalTimeline items={timeline} />
          </div>
          {/* 通知记录 */}
          {notifications.length > 0 && (
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h3 className="mb-3 font-medium">通知记录</h3>
              <div className="space-y-2 text-xs">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded bg-gray-50 p-2">
                    <div className="flex justify-between text-gray-500">
                      <span>{n.receiver?.name ?? "未知"}</span>
                      <span>{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-gray-700">{n.content.slice(0, 80)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
