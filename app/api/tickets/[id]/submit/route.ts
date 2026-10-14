import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";
import { buildNodesForTicket } from "@/lib/ticket-nodes";

// 草稿提交审批：DRAFT → PENDING_APPROVAL
// 用于采买转入的合作工单：接单PR补充合作信息（合作对象/类目/档期）后提交，走完整合作审批流
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "COOPERATION") {
    return NextResponse.json({ error: "仅合作工单可提交审批" }, { status: 400 });
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
  if (!(ticket.coopCategory as string[]).length) {
    return NextResponse.json({ error: "请选择合作类目" }, { status: 400 });
  }
  // 预估时间段可选；合作报价已移除；确定档期在寄品签收后再补填。

  const body = await req.json().catch(() => ({}));
  const approverIds: string[] = Array.isArray(body.approverIds)
    ? body.approverIds
        .filter((id: unknown): id is string => typeof id === "string")
        .filter((id: string, index: number, ids: string[]) => ids.indexOf(id) === index)
    : [];
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

  const submitted = await prisma.$transaction(async (tx) => {
    const statusUpdate = await tx.cooperationTicket.updateMany({
      where: { id: params.id, ticketKind: "COOPERATION", status: "DRAFT" },
      data: { status: "PENDING_APPROVAL", escalatedAt: null },
    });
    if (statusUpdate.count !== 1) return false;

    // 采买转入的工单在创建时未生成进度节点，提交时补建
    const nodeCount = await tx.ticketNode.count({ where: { ticketId: params.id } });
    if (nodeCount === 0) {
      const nodes = buildNodesForTicket(ticket.type, ticket.startDate ?? new Date());
      await tx.ticketNode.createMany({
        data: nodes.map((n) => ({ ticketId: params.id, ...n })),
      });
    }
    // 采买审批阶段的审批人记录使用相同唯一键；合作审批需替换为本次选择的人。
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
    return true;
  });

  if (!submitted) {
    return NextResponse.json({ error: "工单已由其他人提交或状态已变化，请刷新页面" }, { status: 409 });
  }

  await notifyApprovers(
    approverIds,
    `${auth.userName}提交了合作工单「${ticket.title}」审批，请处理。`,
    { type: "TICKET", id: ticket.id, title: "工单待审批", kind: "APPROVAL_PENDING" },
  );

  return NextResponse.json({ ok: true });
}
