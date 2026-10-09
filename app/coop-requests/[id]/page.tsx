import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import {
  coopRequestStatusLabels,
  approverStatusLabels,
  notifyTypeLabels,
  badgeClass,
  formatDateTime,
} from "@/lib/labels";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import CoopRequestActions from "@/components/CoopRequestActions";

export default async function CoopRequestDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;

  const request = await prisma.cooperationRequest.findUnique({
    where: { id: params.id },
    include: { submitter: { select: { id: true, name: true } } },
  });
  if (!request) notFound();

  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "COOP_REQUEST", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const logs = await prisma.approvalLog.findMany({
    where: { docType: "COOP_REQUEST", docId: params.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const notifications = await prisma.notificationLog.findMany({
    where: { relatedType: "COOP_REQUEST", relatedId: params.id },
    include: { receiver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const isAssigned = approvers.some((a) => a.approverId === me.id && a.status === "PENDING");
  const canApprove =
    request.status === "PENDING" && (role === "ADMIN" || (role === "PR_MANAGER" && isAssigned));
  const canResubmit =
    request.status === "REJECTED" && (role === "ADMIN" || request.submitterId === me.id);
  const canRemind =
    request.status === "PENDING" && ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);

  const timeline: TimelineItem[] = logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor.name,
    createdAt: l.createdAt,
    note: l.note,
    fromStatusLabel: l.fromStatus ? coopRequestStatusLabels[l.fromStatus] ?? l.fromStatus : null,
    toStatusLabel: l.toStatus ? coopRequestStatusLabels[l.toStatus] ?? l.toStatus : null,
  }));

  const attachments = (request.attachments as { fileUrl: string; fileName: string }[] | null) ?? [];

  return (
    <div>
      <PageHeader
        title={request.title}
        desc={`${request.reqType} · ${coopRequestStatusLabels[request.status]}`}
        action={
          <Link href="/coop-requests" className="text-sm text-blue-600 hover:underline">
            ← 返回合作需求
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="mb-3 flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(request.status)}`}>
                {coopRequestStatusLabels[request.status]}
              </span>
              <span className="text-sm text-gray-500">提交人：{request.submitter?.name ?? "-"}</span>
            </div>
            {request.status === "REJECTED" && request.rejectReason && (
              <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
                驳回理由：{request.rejectReason}
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{request.description}</div>
            {attachments.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 text-sm text-gray-500">附件</div>
                <ul className="space-y-1 text-sm">
                  {attachments.map((a, i) => (
                    <li key={i}>
                      <a href={a.fileUrl} target="_blank" className="text-blue-600 hover:underline">
                        {a.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 border-t pt-3">
              <CoopRequestActions
                id={request.id}
                status={request.status}
                canApprove={canApprove}
                canResubmit={canResubmit}
                canRemind={canRemind}
                title={request.title}
              />
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-semibold">审批人（或签：任一通过即通过）</h3>
            <ul className="space-y-2 text-sm">
              {approvers.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>{a.approver.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(a.status)}`}>
                    {approverStatusLabels[a.status]}
                  </span>
                </li>
              ))}
              {approvers.length === 0 && <li className="text-gray-400">暂无</li>}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-semibold">操作历史</h3>
            <ApprovalTimeline items={timeline} />
          </div>
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-semibold">通知记录</h3>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400">暂无通知</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b pb-2">
                    <div>{n.receiver?.name ?? "-"} · {notifyTypeLabels[n.type]}</div>
                    <div className="text-xs text-gray-500">{formatDateTime(n.createdAt)}</div>
                    {n.note && <div className="text-xs text-gray-400">{n.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
