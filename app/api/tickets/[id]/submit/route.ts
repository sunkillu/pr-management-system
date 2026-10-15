import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";
import { buildNodesForTicket, wireTicketNodeDependencies } from "@/lib/ticket-nodes";

// 草稿提交审批：DRAFT → PENDING_APPROVAL
// 用于采买转入的合作工单：接单PR补充合作信息（合作对象/类目/档期）后提交，走完整合作审批流
// 维护工单也可提交审批（审批通过停在 APPROVED，可转为合作工单）；维护工单无合作类目/确定档期要求，提交时不建进度节点（转化后提交时再补建）
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "COOPERATION" && ticket.ticketKind !== "MAINTENANCE") {
    return NextResponse.json({ error: "仅合作工单 / 维护工单可提交审批" }, { status: 400 });
  }
  if (ticket.status !== "DRAFT") {
    return NextResponse.json({ error: "仅草稿可提交审批" }, { status: 400 });
  }
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId && ticket.assigneeId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人、接单人或管理员可提交" }, { status: 403 });
  }

  // 合作工单必填校验（采买转入的工单需先补充完整）
  if (ticket.type !== "MAKEUP" && !ticket.influencerId) {
    return NextResponse.json({ error: "请选择合作达人" }, { status: 400 });
  }
  if (ticket.type === "MAKEUP" && !ticket.makeupArtistId) {
    return NextResponse.json({ error: "请选择合作化妆师" }, { status: 400 });
  }
  if (!(ticket.platform as string[]).length) {
    return NextResponse.json({ error: "请选择合作平台" }, { status: 400 });
  }
  if (!(ticket.style as string[]).length) {
    return NextResponse.json({ error: "请选择款式" }, { status: 400 });
  }
  // 合作类目 / 确定档期仅合作工单必填（维护工单无这两项）
  if (ticket.ticketKind === "COOPERATION" && !(ticket.coopCategory as string[]).length) {
    return NextResponse.json({ error: "请选择合作类目" }, { status: 400 });
  }
  // 时间段 / 报价已改为选填，不再作为提交门槛（表单已移除这两项输入）
  // v2 档期：确定档期仍必填，否则不能提交审批（仅合作工单）
  if (ticket.ticketKind === "COOPERATION" && !ticket.confirmedDate) {
    return NextResponse.json({ error: "请填写确定档期（暂不确认档期不能进入合作中）" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const approverIds: string[] = Array.isArray(body.approverIds) ? body.approverIds : [];
  if (approverIds.length === 0) {
    return NextResponse.json({ error: "提交审批必须选择至少一位审批人" }, { status: 400 });
  }
  const approvers = await prisma.user.findMany({
    where: { id: { in: approverIds }, role: { in: ["ADMIN", "PR_MANAGER"] } },
    select: { id: true },
  });
  if (approvers.length !== approverIds.length) {
    return NextResponse.json({ error: "审批人必须为 PR负责人 或 管理员" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // 采买转入的工单在创建时未生成进度节点，提交时补建（维护工单不建节点，转化后提交时再补建）
    const nodeCount = await tx.ticketNode.count({ where: { ticketId: params.id } });
    if (nodeCount === 0 && ticket.ticketKind === "COOPERATION") {
      const nodes = buildNodesForTicket(ticket.type, ticket.startDate ?? new Date(), { scriptRequired: ticket.scriptRequired });
      await tx.ticketNode.createMany({
        data: nodes.map((n) => ({ ticketId: params.id, ...n })),
      });
      await wireTicketNodeDependencies(tx, params.id);
    }
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "PENDING_APPROVAL", escalatedAt: null },
    });
    // 维护工单转为合作工单后会重新走一轮合作审批。
    // 旧维护审批记录属于上一轮审批，不能与新一轮审批人复用同一唯一键；
    // 审批历史由 ApprovalLog 留存，这里只重建当前轮次的待审批列表。
    await tx.requestApprover.deleteMany({
      where: { requestType: "TICKET", requestId: params.id },
    });
    await tx.requestApprover.createMany({
      data: approverIds.map((approverId: string) => ({
        requestType: "TICKET" as const,
        requestId: params.id,
        approverId,
      })),
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "SUBMIT",
      actorId: auth.userId,
      fromStatus: "DRAFT",
      toStatus: "PENDING_APPROVAL",
    });
  });

  await notifyApprovers(
    approverIds,
    `${auth.userName}提交了${ticket.ticketKind === "MAINTENANCE" ? "维护" : "合作"}工单「${ticket.title}」审批，请处理。`,
    { type: "TICKET", id: ticket.id, title: "工单待审批", kind: "APPROVAL_PENDING" },
  );

  return NextResponse.json({ ok: true });
}
