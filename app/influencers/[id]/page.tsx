import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
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
    influencer.status === "PENDING" && ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);

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
          <Link href="/influencers" className="text-sm text-blue-600 hover:underline">
            ← 返回达人库
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
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
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">联系方式</dt><dd>{influencer.contactInfo ?? "-"}</dd></div>
              <div><dt className="text-gray-500">登记人</dt><dd>{influencer.registeredBy?.name ?? "-"}</dd></div>
              <div><dt className="text-gray-500">合作次数</dt><dd>{influencer.coopCount}</dd></div>
              <div><dt className="text-gray-500">累计合作费用</dt><dd>{formatFee(influencer.totalFee)}</dd></div>
            </dl>
            {influencer.bio && (
              <div className="mt-3 text-sm">
                <div className="text-gray-500">简介</div>
                <div className="whitespace-pre-wrap">{influencer.bio}</div>
              </div>
            )}
            <div className="mt-4 border-t pt-3" id="approval-section">
              <InfluencerActions
                id={influencer.id}
                status={influencer.status}
                canApprove={canApprove}
                canResubmit={canResubmit}
                canRemind={canRemind}
                name={influencer.name}
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

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-semibold">
              合作评价（近20条）
              {avgRating && <span className="ml-2 text-sm font-normal text-yellow-600">★ 平均 {avgRating} 分</span>}
            </h3>
            {influencer.reviews.length === 0 ? (
              <p className="text-sm text-gray-400">暂无评价</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {influencer.reviews.map((r) => (
                  <li key={r.id} className="rounded bg-gray-50 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span className="text-xs text-gray-500">{r.reviewer.name} · {r.createdAt.toISOString().slice(0, 10)}</span>
                    </div>
                    {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
                    <Link href={`/tickets/${r.ticket.id}`} className="text-xs text-blue-600 hover:underline">
                      {r.ticket.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-semibold">合作记录（近20条）</h3>
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
