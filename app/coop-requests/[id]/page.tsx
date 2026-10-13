import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Section} from "@/components/ui";
import {
  coopRequestStatusLabels,
  approverStatusLabels,
  notifyTypeLabels,
  badgeClass,
  formatDateTime,
  influencerTypeLabels,
  platformTagLabels,
} from "@/lib/labels";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import ApprovalRecords from "@/components/ApprovalRecords";
import CoopRequestActions from "@/components/CoopRequestActions";
import InfluencerHoverCard from "@/components/InfluencerHoverCard";
import TaggingSection from "@/components/TaggingSection";

export default async function CoopRequestDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;

  const request = await prisma.cooperationRequest.findUnique({
    where: { id: params.id },
    include: {
      submitter: { select: { id: true, name: true } },
      influencer: { select: { id: true, name: true } },
    },
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

  const canApprove = request.status === "PENDING" && role === "ADMIN";
  const canResubmit =
    request.status === "REJECTED" && (role === "ADMIN" || request.submitterId === me.id);
  const canRemind =
    request.status === "PENDING" && request.submitterId === me.id;

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
          <Link href="/coop-requests" className="text-sm text-primary hover:underline">
            ← 返回合作需求
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-card rounded-lg lg:col-span-2 h-fit [&>section:first-child]:border-t-0">
          <Section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(request.status)}`}>
                {coopRequestStatusLabels[request.status]}
              </span>
              <span className="text-sm text-muted-foreground">
                达人类型：{request.influencerType ? influencerTypeLabels[request.influencerType] ?? request.influencerType : "-"}
              </span>
              <span className="text-sm text-muted-foreground">
                平台：{request.platforms.length > 0 ? request.platforms.map((p) => platformTagLabels[p] ?? p).join("、") : "-"}
              </span>
              <span className="text-sm text-muted-foreground">提交人：{request.submitter?.name ?? "-"}</span>
            </div>
            {request.status === "REJECTED" && request.rejectReason && (
              <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
                驳回理由：{request.rejectReason}
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{request.description}</div>
            {attachments.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 text-sm text-muted-foreground">附件</div>
                <ul className="space-y-1 text-sm">
                  {attachments.map((a, i) => (
                    <li key={i}>
                      <a href={a.fileUrl} target="_blank" className="text-primary hover:underline">
                        {a.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 border-t pt-3" id="approval-section">
              <div className="flex flex-wrap items-center gap-2">
                <CoopRequestActions
                  id={request.id}
                  status={request.status}
                  canApprove={canApprove}
                  canResubmit={canResubmit}
                  canRemind={canRemind}
                  title={request.title}
                  influencerType={request.influencerType}
                  platforms={request.platforms}
                />
                {request.status === "APPROVED" && request.influencer && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      已生成达人：
                      <InfluencerHoverCard id={request.influencer.id} name={request.influencer.name} />
                    </span>
                    {["ADMIN", "PR", "PR_MANAGER"].includes(role) && (
                      <Link
                        href={`/tickets/new?influencerId=${request.influencer.id}&coopRequestId=${request.id}`}
                        className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
                      >
                        发起工单
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </Section>

          <Section title="审批人（或签：任一通过即通过）">
            <ul className="space-y-2 text-sm">
              {approvers.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>{a.approver.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(a.status)}`}>
                    {approverStatusLabels[a.status]}
                  </span>
                </li>
              ))}
              {approvers.length === 0 && <li className="text-muted-foreground">暂无</li>}
            </ul>
            <ApprovalRecords records={approvers} />
          </Section>
        </div>

        <div className="bg-card rounded-lg h-fit [&>section:first-child]:border-t-0">
          <Section title="标签（谁打的）">
            <TaggingSection
              entityType="COOP_REQUEST"
              entityId={request.id}
              categoryKey="INFLUENCER"
              meId={me.id}
              isAdmin={role === "ADMIN"}
              canTag={["ADMIN", "PR", "OPERATOR"].includes(role)}
            />
          </Section>
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>
          <Section title="通知记录">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无通知</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b pb-2">
                    <div>{n.receiver?.name ?? "-"} · {notifyTypeLabels[n.type]}</div>
                    <div className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</div>
                    {n.note && <div className="text-xs text-muted-foreground">{n.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
