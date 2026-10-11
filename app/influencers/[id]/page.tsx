import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Section, InfoRow } from "@/components/ui";
import {
  influencerStatusLabels,
  influencerTypeLabels,
  platformTagLabels,
  approverStatusLabels,
  notifyTypeLabels,
  badgeClass,
  formatFee,
  formatDateTime,
} from "@/lib/labels";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import InfluencerActions from "@/components/InfluencerActions";

export default async function InfluencerDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;

  const influencer = await prisma.influencer.findUnique({
    where: { id: params.id },
    include: {
      registeredBy: { select: { id: true, name: true } },
      cooperationRecords: { orderBy: { coopDate: "desc" }, take: 20 },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { reviewer: { select: { name: true } }, ticket: { select: { id: true, title: true } } },
      },
    },
  });
  if (!influencer) notFound();
  const avgRating = influencer.reviews.length > 0
    ? (influencer.reviews.reduce((s, r) => s + r.rating, 0) / influencer.reviews.length).toFixed(1)
    : null;

  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "INFLUENCER", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const logs = await prisma.approvalLog.findMany({
    where: { docType: "INFLUENCER", docId: params.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const notifications = await prisma.notificationLog.findMany({
    where: { relatedType: "INFLUENCER", relatedId: params.id },
    include: { receiver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const isAssigned = approvers.some((a) => a.approverId === me.id && a.status === "PENDING");
  const canApprove =
    influencer.status === "PENDING" && (role === "ADMIN" || (role === "PR_MANAGER" && isAssigned));
  const canResubmit =
    influencer.status === "REJECTED" &&
    (role === "ADMIN" || influencer.registeredById === me.id);
  const canRemind =
    influencer.status === "PENDING" && ["ADMIN", "PR", "PR_MANAGER"].includes(role);

  const timeline: TimelineItem[] = logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor.name,
    createdAt: l.createdAt,
    note: l.note,
    fromStatusLabel: l.fromStatus ? influencerStatusLabels[l.fromStatus] ?? l.fromStatus : null,
    toStatusLabel: l.toStatus ? influencerStatusLabels[l.toStatus] ?? l.toStatus : null,
  }));

  return (
    <div>
      <PageHeader
        title={influencer.name}
        desc={`达人登记 · ${influencerStatusLabels[influencer.status]}`}
        action={
          <Link href="/partners?tab=influencer" className="text-sm text-[#0071e3] hover:underline">
            ← 返回达人库
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-white rounded-2xl lg:col-span-2 h-fit [&>section:first-child]:border-t-0">
          <Section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(influencer.status)}`}>
                {influencerStatusLabels[influencer.status]}
              </span>
              {influencer.coopCount === 0 ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300">
                  未合作
                </span>
              ) : (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  合作中
                </span>
              )}
              <span className="text-sm text-gray-500">
                达人类型：{influencer.influencerType ? influencerTypeLabels[influencer.influencerType] ?? influencer.influencerType : "-"}
              </span>
              <span className="text-sm text-gray-500">
                平台：{influencer.platforms.length > 0
                  ? influencer.platforms.map((p) => platformTagLabels[p] ?? p).join("、")
                  : "-"}
              </span>
            </div>
            {influencer.status === "REJECTED" && influencer.rejectReason && (
              <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
                驳回理由：{influencer.rejectReason}
              </div>
            )}
            <dl>
              <InfoRow label="联系方式">{influencer.contactInfo ?? "-"}</InfoRow>
              <InfoRow label="登记人">{influencer.registeredBy?.name ?? "-"}</InfoRow>
              <InfoRow label="合作次数">{influencer.coopCount}</InfoRow>
              <InfoRow label="累计合作费用">{formatFee(influencer.totalFee)}</InfoRow>
              {influencer.tags.length > 0 && (
                <InfoRow label="标签">
                  <span className="flex flex-wrap gap-1">
                    {influencer.tags.map((t: string) => (
                      <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 ring-1 ring-blue-200">
                        {t}
                      </span>
                    ))}
                  </span>
                </InfoRow>
              )}
            </dl>
            {influencer.bio && (
              <div className="mt-3 text-sm">
                <div className="text-gray-500">简介</div>
                <div className="whitespace-pre-wrap">{influencer.bio}</div>
              </div>
            )}
            {((influencer.attachments as { fileUrl: string; fileName: string }[] | null) ?? []).length > 0 && (
              <div className="mt-3 text-sm">
                <div className="mb-2 text-gray-500">附件（参考图）</div>
                <div className="flex flex-wrap gap-2">
                  {((influencer.attachments as { fileUrl: string; fileName: string }[]) ?? []).map((a, i) => (
                    <a key={i} href={a.fileUrl} target="_blank" title={a.fileName}
                      className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border border-gray-200 bg-[#f5f5f7] text-center text-[10px] text-[#0071e3]">
                      {/.(jpe?g|png|webp|gif)$/i.test(a.fileName) ? (
                        <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="px-1">{a.fileName}</span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 border-t border-[#e5e5e5] pt-4" id="approval-section">
              <InfluencerActions
                id={influencer.id}
                status={influencer.status}
                canApprove={canApprove}
                canResubmit={canResubmit}
                canRemind={canRemind}
                name={influencer.name}
              />
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
              {approvers.length === 0 && <li className="text-gray-400">暂无</li>}
            </ul>
          </Section>

          <Section title="合作评价（近20条）">
            {avgRating && <p className="mb-3 text-sm text-yellow-600">★ 平均 {avgRating} 分</p>}
            {influencer.reviews.length === 0 ? (
              <p className="text-sm text-gray-400">暂无评价</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {influencer.reviews.map((r) => (
                  <li key={r.id} className="rounded bg-[#f5f5f7] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span className="text-xs text-gray-500">{r.reviewer.name} · {r.createdAt.toISOString().slice(0, 10)}</span>
                    </div>
                    {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
                    <Link href={`/tickets/${r.ticket.id}`} className="text-xs text-[#0071e3] hover:underline">
                      {r.ticket.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="合作记录（近20条）">
            {influencer.cooperationRecords.length === 0 ? (
              <p className="text-sm text-gray-400">暂无合作记录</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {influencer.cooperationRecords.map((r) => (
                  <li key={r.id} className="flex justify-between border-b pb-2">
                    <span>{r.coopDate.toISOString().slice(0, 10)} · {r.note ?? ""}</span>
                    <span className="font-medium">{formatFee(r.fee)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="bg-white rounded-2xl h-fit [&>section:first-child]:border-t-0">
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>
          <Section title="通知记录">
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
          </Section>
        </div>
      </div>
    </div>
  );
}
