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
  if (!ticket.estimatedSchedule || ticket.estimatedSchedule === "-") {
    return NextResponse.json({ error: "请填写预估档期" }, { status: 400 });
  }
  // v2 档期报价：合作报价与确定档期必填，否则不能提交审批
  if (ticket.quoteAmount == null) {
    return NextResponse.json({ error: "请填写合作报价" }, { status: 400 });
  }
  if (!ticket.confirmedDate) {
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
    // 采买转入的工单在创建时未生成进度节点，提交时补建
    const nodeCount = await tx.ticketNode.count({ where: { ticketId: params.id } });
    if (nodeCount === 0) {
      const nodes = buildNodesForTicket(ticket.type, ticket.startDate ?? new Date());
      await tx.ticketNode.createMany({
        data: nodes.map((n) => ({ ticketId: params.id, ...n })),
      });
    }
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "PENDING_APPROVAL", escalatedAt: null },
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
    `${auth.userName}提交了合作工单「${ticket.title}」审批，请处理。`,
    { type: "TICKET", id: ticket.id, title: "工单待审批", kind: "APPROVAL_PENDING" },
  );

  return NextResponse.json({ ok: true });
}
