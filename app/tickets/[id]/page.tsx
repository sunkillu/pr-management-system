import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Section, InfoRow } from "@/components/ui";
import {
  ticketStatusLabels,
  coopTypeLabels,
  ticketKindLabels,
  procurementSubTypeLabels,
  approverStatusLabels,
  badgeClass,
  formatMoney,
  formatDate,
  formatDateTime,
  platformTagLabels,
  styleLabels,
  coopCategoryLabels,
} from "@/lib/labels";
import { APPROVAL_TIMEOUT_HOURS } from "@/lib/constants";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import ApprovalRecords from "@/components/ApprovalRecords";
import InfluencerHoverCard from "@/components/InfluencerHoverCard";
import TicketActions from "@/components/TicketActions";
import TicketNodes from "@/components/TicketNodes";
import NodeTimeline from "@/components/NodeTimeline";
import TicketSubtasks from "@/components/TicketSubtasks";
import TicketComments from "@/components/TicketComments";
import TicketFollowUps from "@/components/TicketFollowUps";
import TicketContents, { TicketContent } from "@/components/TicketContents";
import TicketMaterials from "@/components/TicketMaterials";
import TicketSampleLink from "@/components/TicketSampleLink";
import AutoRefresh from "@/components/AutoRefresh";
import TaggingSection from "@/components/TaggingSection";
import ProcurementAssignee from "@/components/ProcurementAssignee";
import TicketForm from "@/components/TicketForm";
import TicketChildren from "@/components/TicketChildren";
import ScheduleChangeTimeline from "@/components/ScheduleChangeTimeline";

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
      coopRequest: { select: { id: true, title: true } },
      assignee: { select: { id: true, name: true } },
      forceBy: { select: { id: true, name: true } },
      assigneeLogs: {
        include: {
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
          changedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      nodes: {
        orderBy: { sort: "asc" },
        include: {
          completedBy: { select: { name: true } },
          dependsOn: { select: { id: true, name: true, completedAt: true } },
        },
      },
      subtasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
      reviews: { include: { reviewer: { select: { name: true } } } },
      samples: {
        select: { id: true, sampleNo: true, productName: true, status: true, trackingNo: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      paymentRequests: {
        select: { id: true, title: true, amount: true, status: true },
        orderBy: { createdAt: "desc" },
      },
      followUps: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { followNo: "asc" },
      },
      contents: {
        include: {
          createdBy: { select: { id: true, name: true } },
          comments: {
            include: {
              handledBy: { select: { name: true } },
              createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      materials: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) notFound();

  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "TICKET", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  // 素材标签（MATERIAL 种类，供打标签与展示）
  const materialTags = await prisma.tag.findMany({
    where: { category: { key: "MATERIAL" } },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
  });
  const materialTagMap: Record<string, string> = Object.fromEntries(
    materialTags.map((t) => [t.id, t.name])
  );
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

  // 子工单（v2 父子工单模型）：仅父工单拉取其子工单；子工单则拉取父工单入口
  const childTicketsRaw = ticket.parentId
    ? []
    : await prisma.cooperationTicket.findMany({
        where: { parentId: ticket.id },
        include: {
          influencer: { select: { name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
  const childTickets = childTicketsRaw.map((c) => ({
    id: c.id,
    ticketNo: c.ticketNo,
    title: c.title,
    subType: c.subType,
    status: c.status,
    influencer: c.influencer,
    assignee: c.assignee,
    createdAt: c.createdAt.toISOString(),
  }));
  const parentTicket = ticket.parentId
    ? await prisma.cooperationTicket.findUnique({
        where: { id: ticket.parentId },
        select: { id: true, ticketNo: true, title: true },
      })
    : null;

  // v2: 档期修改审计
  const scheduleLogsRaw = await prisma.scheduleChangeLog.findMany({
    where: { ticketId: ticket.id },
    include: { changedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const scheduleLogs = scheduleLogsRaw.map((l) => ({
    id: l.id,
    oldDate: l.oldDate ? l.oldDate.toISOString().slice(0, 10) : null,
    newDate: l.newDate ? l.newDate.toISOString().slice(0, 10) : null,
    changedByName: l.changedBy.name,
    reason: l.reason,
    createdAt: l.createdAt.toISOString(),
  }));

  const timeline: TimelineItem[] = logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor.name,
    createdAt: l.createdAt,
    note: l.note,
    fromStatusLabel: l.fromStatus ? ticketStatusLabels[l.fromStatus] ?? l.fromStatus : null,
    toStatusLabel: l.toStatus ? ticketStatusLabels[l.toStatus] ?? l.toStatus : null,
  }));

  // 编辑用：达人/化妆师列表（草稿补充合作信息时用）
  const influencers = await prisma.influencer.findMany({
    where: { status: "APPROVED", ...(role === "PR" ? { registeredById: me.id } : {}) },
    select: { id: true, name: true, homepageId: true },
    orderBy: { name: "asc" },
  });
  const makeupArtists = await prisma.makeupArtist.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  // 草稿可编辑：创建人 / 接单人 / 管理员（采买转入的合作工单由接单PR补充合作信息）
  const canEdit =
    ticket.status === "DRAFT" &&
    (role === "ADMIN" || ticket.creator.id === me.id || ticket.assigneeId === me.id);

  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 3600 * 1000);
  const overdue = ticket.status === "PENDING_APPROVAL" && ticket.updatedAt < cutoff;
  // 状态推动权限：仅创建人 / 审批链成员 / ADMIN
  const canOperate =
    role === "ADMIN" ||
    ticket.creator.id === me.id ||
    approvers.some((a) => a.approverId === me.id);
  // 预估档期超期提醒：从文本中解析最后一个 YYYY-MM-DD 作为参考结束日，仅标黄不锁定
  const scheduleEndMatch = ticket.estimatedSchedule.match(/(\d{4})-(\d{2})-(\d{2})/g);
  const scheduleEnd = scheduleEndMatch ? new Date(scheduleEndMatch[scheduleEndMatch.length - 1] + "T23:59:59") : null;
  const scheduleOverdue =
    scheduleEnd !== null &&
    !isNaN(scheduleEnd.getTime()) &&
    scheduleEnd < new Date() &&
    !["SETTLED", "VOIDED"].includes(ticket.status);
  const partnerName = ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "-";
  const partnerHref = ticket.influencer
    ? `/influencers/${ticket.influencer.id}`
    : ticket.makeupArtist
    ? `/makeup-artists/${ticket.makeupArtist.id}`
    : null;
  const canUpdateNodes =
    canOperate &&
    ["APPROVED", "IN_PROGRESS"].includes(ticket.status);
  const canWriteComment = ["ADMIN", "PR", "PR_MANAGER"].includes(role);
  const canManageSubtasks =
    canOperate &&
    !["VOIDED", "SETTLED", "FOLLOW_UP", "MATERIAL_REVIEW"].includes(ticket.status);
  const canManageFollowUps =
    canOperate && ticket.status === "FOLLOW_UP";
  const canManageContents =
    canOperate &&
    !["VOIDED", "MATERIAL_REVIEW"].includes(ticket.status);
  const canManageMaterials =
    canOperate && ticket.status === "IN_PROGRESS";
  const incompleteSubtasks = ticket.subtasks.filter((s) => s.status !== "DONE").length;

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title={ticket.title}
        desc={`${ticket.ticketNo} · ${coopTypeLabels[ticket.type]} · ${ticketStatusLabels[ticket.status]}`}
        action={
          <div className="flex items-center gap-3">
            {canEdit && (
              <TicketForm
                influencers={influencers}
                makeupArtists={makeupArtists}
                userRole={role}
                editTicket={{
                  id: ticket.id,
                  title: ticket.title,
                  type: ticket.type,
                  brandId: ticket.brandId,
                  platform: ticket.platform as string[],
                  style: ticket.style as string[],
                  budgetFee: String(ticket.budgetFee),
                  note: ticket.note ?? "",
                  contentDirection: ticket.contentDirection ?? "",
                  priceNote: ticket.priceNote ?? "",
                  contentNote: ticket.contentNote ?? "",
                  estimatedSchedule: ticket.estimatedSchedule === "-" ? "" : ticket.estimatedSchedule,
                  estimatedPublishMonth: ticket.estimatedPublishMonth ?? "",
                  quoteAmount: ticket.quoteAmount != null ? String(ticket.quoteAmount) : "",
                  confirmedDate: ticket.confirmedDate ? new Date(ticket.confirmedDate).toISOString().slice(0, 10) : "",
                  coopCategory: ticket.coopCategory as string[],
                  homepageId: ticket.homepageId ?? "",
                  startDate: ticket.startDate ? new Date(ticket.startDate).toISOString().slice(0, 10) : "",
                  endDate: ticket.endDate ? new Date(ticket.endDate).toISOString().slice(0, 10) : "",
                  influencerId: ticket.influencerId,
                  makeupArtistId: ticket.makeupArtistId,
                }}
              />
            )}
            <Link href="/tickets" className="text-sm text-primary hover:underline">
              ← 返回合作工单
            </Link>
          </div>
        }
      />
      {overdue && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          该工单已超过 {APPROVAL_TIMEOUT_HOURS} 小时未审批，已升级通知管理员。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="bg-card rounded-lg lg:col-span-2 h-fit [&>section:first-child]:border-t-0">
          {/* 基本信息 */}
          <Section title="基本信息">
            <dl>
              <InfoRow label="工单编号">
                <span className="font-mono text-sm">{ticket.ticketNo}</span>
              </InfoRow>
              <InfoRow label="工单类型">
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                  {ticketKindLabels[ticket.ticketKind] ?? ticket.ticketKind}
                </span>
                {ticket.ticketKind === "PROCUREMENT" && ticket.procurementType && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {procurementSubTypeLabels[ticket.procurementType] ?? ticket.procurementType}
                  </span>
                )}
              </InfoRow>
              {ticket.ticketKind === "PROCUREMENT" && ticket.status === "APPROVED" && (
                <InfoRow label="接单归属">
                  {ticket.assignee ? (
                    <span className="text-sm font-medium">{ticket.assignee.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">待接单</span>
                  )}
                  {(() => {
                    const approvedAt = ticket.procurementApprovedAt;
                    const overdue = !ticket.assigneeId && approvedAt &&
                      Date.now() - new Date(approvedAt).getTime() > 12 * 3600 * 1000;
                    return overdue ? (
                      <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        超过12小时未接单
                      </span>
                    ) : null;
                  })()}
                </InfoRow>
              )}
              <InfoRow label="合作对象">
                <span className="font-medium">
                  {ticket.influencer ? (
                    <InfluencerHoverCard id={ticket.influencer.id} name={partnerName} />
                  ) : partnerHref ? (
                    <Link href={partnerHref} className="text-primary hover:underline">{partnerName}</Link>
                  ) : (
                    partnerName
                  )}
                </span>
              </InfoRow>
              {ticket.coopRequest && (
                <InfoRow label="来源需求">
                  <Link href={`/coop-requests/${ticket.coopRequest.id}`} className="text-primary hover:underline">
                    {ticket.coopRequest.title}
                  </Link>
                </InfoRow>
              )}
              <InfoRow label="合作类型">{coopTypeLabels[ticket.type]}</InfoRow>
              <InfoRow label="合作平台">{(ticket.platform as string[]).map((p) => platformTagLabels[p] ?? p).join("、") || "-"}</InfoRow>
              {ticket.homepageId && (
                <InfoRow label="达人主页ID"><span className="font-mono text-sm">{ticket.homepageId}</span></InfoRow>
              )}
              {ticket.style.length > 0 && (
                <InfoRow label="款式">{ticket.style.map((s) => styleLabels[s] ?? s).join("、")}</InfoRow>
              )}
              {ticket.coopCategory.length > 0 && (
                <InfoRow label="合作类目">{ticket.coopCategory.map((c) => coopCategoryLabels[c] ?? c).join("、")}</InfoRow>
              )}
              <InfoRow label="预算费用">¥{formatMoney(ticket.budgetFee)}</InfoRow>
              <InfoRow label="实际费用">{ticket.actualFee ? `¥${formatMoney(ticket.actualFee)}` : "-"}</InfoRow>
              {ticket.contentDirection && (
                <InfoRow label="内容方向" wide><span className="whitespace-pre-wrap">{ticket.contentDirection}</span></InfoRow>
              )}
              {ticket.priceNote && (
                <InfoRow label="价格备注" wide><span className="whitespace-pre-wrap">{ticket.priceNote}</span></InfoRow>
              )}
              {ticket.contentNote && (
                <InfoRow label="内容备注" wide><span className="whitespace-pre-wrap">{ticket.contentNote}</span></InfoRow>
              )}
              <InfoRow label="档期">{ticket.startDate ? formatDate(ticket.startDate) : "-"} ~ {ticket.endDate ? formatDate(ticket.endDate) : "-"}</InfoRow>
              <InfoRow label="预估档期">
                <span>{ticket.estimatedSchedule}</span>
                {scheduleOverdue && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300">
                    已超预估档期（仅提醒）
                  </span>
                )}
              </InfoRow>
              {/* v2: 预估发布年月 / 确定档期 / 报价（A级敏感，仅授权角色） */}
              {ticket.estimatedPublishMonth && (
                <InfoRow label="预估发布年月"><span>{ticket.estimatedPublishMonth}</span></InfoRow>
              )}
              <InfoRow label="确定档期">
                <span>{ticket.confirmedDate ? formatDate(ticket.confirmedDate) : "暂不确认"}</span>
              </InfoRow>
              {(role === "ADMIN" || role === "PR_MANAGER" || ticket.creatorId === me.id || ticket.assigneeId === me.id) && ticket.quoteAmount != null && (
                <InfoRow label="合作报价">
                  <span>¥{Number(ticket.quoteAmount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span>
                </InfoRow>
              )}
              {ticket.occupiesResource && (
                <InfoRow label="资源占用">
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 ring-1 ring-green-300">
                    占用中
                  </span>
                </InfoRow>
              )}
              {ticket.forceCreated && (
                <InfoRow label="强制创建">
                  <span className="text-xs text-muted-foreground">
                    {ticket.forceBy?.name ?? "管理员"} 于 {ticket.forceAt ? formatDateTime(ticket.forceAt) : "-"} 强制创建，原因：{ticket.forceReason ?? "-"}
                  </span>
                </InfoRow>
              )}
              <InfoRow label="发起人">{ticket.creator.name}</InfoRow>
              {ticket.rejectReason && (
                <InfoRow label="驳回理由" wide><span className="text-red-600">{ticket.rejectReason}</span></InfoRow>
              )}
              {ticket.voidReason && (
                <InfoRow label="作废理由" wide><span className="text-muted-foreground">{ticket.voidReason}</span></InfoRow>
              )}
              {ticket.note && (
                <InfoRow label="备注" wide><span className="whitespace-pre-wrap">{ticket.note}</span></InfoRow>
              )}
              {Array.isArray(ticket.shipItems) && ticket.shipItems.length > 0 && (
                <InfoRow label="寄品明细" wide>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">款式名</th>
                        <th className="py-1 pr-3 font-medium">度数</th>
                        <th className="py-1 font-medium">寄品备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ticket.shipItems as { style: string; degree?: string; note?: string }[]).map((s, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-1.5 pr-3 font-medium">{s.style}</td>
                          <td className="py-1.5 pr-3">{s.degree || "-"}</td>
                          <td className="py-1.5 text-muted-foreground">{s.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TicketSampleLink
                    ticketId={ticket.id}
                    ticketTitle={ticket.title}
                    ticketStatus={ticket.status}
                    shipItems={ticket.shipItems as { style: string; degree?: string; note?: string }[]}
                    samples={ticket.samples}
                    influencerId={ticket.influencerId}
                    influencerName={ticket.influencer?.name ?? ticket.makeupArtist?.name ?? ""}
                    canCreate={["ADMIN", "PR", "PR_MANAGER"].includes(role)}
                  />
                </InfoRow>
              )}
              {Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                <InfoRow label="插图 / 附件" wide>
                  <span className="flex flex-wrap gap-2">
                    {(ticket.attachments as { fileUrl: string; fileName: string }[]).map((a, i) =>
                      /\.(jpe?g|png|webp|gif)$/i.test(a.fileName) ? (
                        <a key={i} href={a.fileUrl} target="_blank" title={a.fileName}>
                          <img src={a.fileUrl} alt={a.fileName} className="h-24 w-24 rounded-[10px] border border-border object-cover" />
                        </a>
                      ) : (
                        <a key={i} href={a.fileUrl} target="_blank"
                          className="rounded-[10px] border border-border bg-muted px-3 py-2 text-sm text-primary hover:underline">
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
          <Section title="标签（谁打的）">
            <TaggingSection
              entityType="TICKET"
              entityId={ticket.id}
              categoryKey="TICKET"
              meId={me.id}
              isAdmin={role === "ADMIN"}
              canTag={["ADMIN", "PR", "OPERATOR"].includes(role)}
            />
          </Section>

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
                dependsOnId: n.dependsOnId,
                dependsOn: n.dependsOn
                  ? {
                      id: n.dependsOn.id,
                      name: n.dependsOn.name,
                      completedAt: n.dependsOn.completedAt ? n.dependsOn.completedAt.toISOString() : null,
                    }
                  : null,
              }))}
              canUpdate={canUpdateNodes}
              materialsCount={ticket.materials.length}
            />
          </Section>

          {/* 节点时间线：计划 vs 实际 */}
          <Section title="节点时间线">
            <NodeTimeline
              nodes={ticket.nodes.map((n) => ({
                id: n.id,
                name: n.name,
                expectedAt: n.expectedAt ? n.expectedAt.toISOString() : null,
                completedAt: n.completedAt ? n.completedAt.toISOString() : null,
              }))}
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
                blockedReason: s.blockedReason,
                blockedAt: s.blockedAt ? s.blockedAt.toISOString() : null,
              }))}
              users={users}
              canManage={canManageSubtasks}
            />
          </Section>

          {/* 内容（工单内维护） */}
          <Section
            title={`内容（${ticket.contents.length}）`}
            action={
              ticket.contents.length > 0 ? (
                <a
                  href={`/api/tickets/${ticket.id}/summary`}
                  className="text-sm text-primary hover:underline"
                >
                  生成汇总单
                </a>
              ) : undefined
            }
          >
            <TicketContents
              ticketId={ticket.id}
              contents={ticket.contents.map((c): TicketContent => ({
                id: c.id,
                title: c.title,
                type: c.type,
                status: c.status,
                link: c.link,
                body: c.body,
                platform: c.platform,
                style: c.style,
                cost: c.cost != null ? Number(c.cost) : null,
                rejectReason: c.rejectReason,
                version: c.version,
                createdAt: c.createdAt.toISOString(),
                createdBy: c.createdBy,
                comments: c.comments.map((cm) => ({
                  id: cm.id,
                  comment: cm.comment,
                  author: cm.author,
                  handled: cm.handled,
                  handledBy: cm.handledBy,
                  handledAt: cm.handledAt ? cm.handledAt.toISOString() : null,
                  createdBy: cm.createdBy,
                  createdAt: cm.createdAt.toISOString(),
                })),
              }))}
              role={role}
              userId={me.id}
              canManage={canManageContents}
            />
          </Section>

          {/* 回收素材 */}
          <Section title={`回收素材（${ticket.materials.length}）`}>
            <TicketMaterials
              ticketId={ticket.id}
              materialTags={materialTags.map((t) => ({ id: t.id, name: t.name }))}
              tagMap={materialTagMap}
              initial={ticket.materials.map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
                note: m.note,
                tagIds: m.tagIds,
                createdAt: m.createdAt.toISOString(),
                uploadedBy: m.uploadedBy,
              }))}
              canManage={canManageMaterials}
            />
            {ticket.status === "MATERIAL_REVIEW" && (
              <p className="mt-3 rounded-[10px] bg-purple-50 p-2 text-xs text-purple-800 ring-1 ring-inset ring-purple-200">
                素材待 PR负责人 / 管理员审批，审批通过后自动生成打款单。
              </p>
            )}
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
              <p className="mb-3 text-sm text-muted-foreground">草稿状态，尚未提交审批</p>
            )}
            <TicketActions ticket={{ id: ticket.id, title: ticket.title, status: ticket.status, creatorId: ticket.creator.id, actualFee: ticket.actualFee, incompleteSubtasks }} userId={me.id} role={role} canOperate={canOperate} />
            {/* 采买工单接单后同单转入合作工单流程（accept 接口直接翻转 ticketKind），无需转工单按钮 */}
            {/* 采买工单接单 / 人工分配 */}
            {ticket.ticketKind === "PROCUREMENT" && ticket.status === "APPROVED" && (
              <ProcurementAssignee
                ticketId={ticket.id}
                ticketTitle={ticket.title}
                hasAssignee={!!ticket.assigneeId}
                role={role}
              />
            )}
            <ApprovalRecords records={approvers} />
            {/* 归属变更记录 */}
            {ticket.ticketKind === "PROCUREMENT" && ticket.assigneeLogs.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-sm font-medium">接单 / 分配记录</h4>
                <div className="space-y-1.5">
                  {ticket.assigneeLogs.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                        {l.action === "ACCEPT" ? "接单" : "人工分配"}
                      </span>
                      <span>
                        {l.fromUser ? `${l.fromUser.name} → ` : ""}{l.toUser.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.changedBy.name} · {new Date(l.createdAt).toLocaleString("zh-CN")}
                      </span>
                      {l.reason && <span className="text-xs text-muted-foreground">（{l.reason}）</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* 关联打款单 */}
          {ticket.paymentRequests.length > 0 && (
            <Section title="关联打款单">
              <div className="space-y-2">
                {ticket.paymentRequests.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/payments/${p.id}`} className="text-primary hover:underline">{p.title}</Link>
                    <span>¥{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 跟进记录（打款后15天） */}
          {["FOLLOW_UP", "SETTLED"].includes(ticket.status) && ticket.followUpDueDate && (
            <Section title="跟进记录">
              <TicketFollowUps
                ticketId={ticket.id}
                initial={ticket.followUps.map((f) => ({
                  id: f.id,
                  followNo: f.followNo,
                  noteUrl: f.noteUrl,
                  views: f.views,
                  likes: f.likes,
                  comments: f.comments,
                  note: f.note,
                  createdAt: f.createdAt.toISOString(),
                  createdBy: f.createdBy,
                }))}
                dueDate={ticket.followUpDueDate.toISOString()}
                canManage={canManageFollowUps}
              />
            </Section>
          )}

          {/* 合作评价 */}
          {ticket.reviews.length > 0 && (
            <Section title="合作评价">
              {ticket.reviews.map((r) => (
                <div key={r.id} className="rounded bg-muted p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="text-xs text-muted-foreground">{r.reviewer.name} · {formatDateTime(r.createdAt)}</span>
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

          {/* 子工单（v2 父子工单模型） */}
          <Section title={ticket.parentId ? "父工单" : `子工单（${childTickets.length}）`}>
            <TicketChildren
              ticketId={ticket.id}
              isParent={!ticket.parentId}
              parentTicket={parentTicket}
              initial={childTickets}
              users={users}
              canCreate={canOperate}
              context={{
                influencerId: ticket.influencerId,
                influencerName: partnerName,
                styles: ticket.style,
                platforms: ticket.platform as string[],
                confirmedDate: ticket.confirmedDate ? new Date(ticket.confirmedDate).toISOString().slice(0, 10) : null,
                publishDate: ticket.publishDate ? new Date(ticket.publishDate).toISOString().slice(0, 10) : null,
              }}
            />
          </Section>
          {/* v2: 档期修改记录 */}
          {scheduleLogs.length > 0 && (
            <Section title={`档期修改记录（${scheduleLogs.length}）`}>
              <ScheduleChangeTimeline items={scheduleLogs} />
            </Section>
          )}
        </div>

        <div className="bg-card rounded-lg h-fit [&>section:first-child]:border-t-0">
          {/* 推进记录 */}
          <Section title="推进记录">
            <ApprovalTimeline items={timeline} />
          </Section>
          {/* 通知记录 */}
          {notifications.length > 0 && (
            <Section title="通知记录">
              <div className="space-y-2 text-xs">
                {notifications.map((n) => (
                  <div key={n.id} className="rounded bg-muted p-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{n.receiver?.name ?? "未知"}</span>
                      <span>{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-foreground">{n.content.slice(0, 80)}</p>
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
