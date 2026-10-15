import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";

// 采买工单人工分配：PR负责人 / 管理员指定归属 PR，变更留痕
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const body = await req.json();
  const assigneeId = String(body.assigneeId ?? "").trim();
  if (!assigneeId) return NextResponse.json({ error: "请选择归属 PR" }, { status: 400 });
  const reason = String(body.reason ?? "").trim() || null;

  const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true, role: true } });
  if (!assignee) return NextResponse.json({ error: "指定用户不存在" }, { status: 404 });
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, ticketKind: true, status: true, assigneeId: true, parentId: true },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["PR", "PR_MANAGER"].includes(assignee.role)) {
    return NextResponse.json({ error: "归属人必须是 PR 或 PR负责人" }, { status: 400 });
  }
  if (["SETTLED", "VOIDED", "PROCUREMENT_CLOSED"].includes(ticket.status)) {
    return NextResponse.json({ error: "已关闭工单不可修改归属" }, { status: 400 });
  }
  if (ticket.parentId) {
    await prisma.$transaction(async (tx) => {
      await tx.cooperationTicket.update({ where: { id: params.id }, data: { assigneeId, acceptedAt: new Date() } });
      await tx.ticketAssigneeLog.create({ data: { ticketId: params.id, fromUserId: ticket.assigneeId, toUserId: assigneeId, changedById: auth.userId, action: "ASSIGN", reason } });
    });
    return NextResponse.json({ ok: true });
  }
  if (ticket.ticketKind !== "PROCUREMENT") {
    await prisma.$transaction(async (tx) => {
      await tx.cooperationTicket.update({ where: { id: params.id }, data: { assigneeId, acceptedAt: new Date() } });
      await tx.ticketAssigneeLog.create({ data: { ticketId: params.id, fromUserId: ticket.assigneeId, toUserId: assigneeId, changedById: auth.userId, action: "ASSIGN", reason } });
      await writeLog(tx, { docType: "TICKET", docId: params.id, action: "ASSIGN", actorId: auth.userId, fromStatus: ticket.status, toStatus: ticket.status, note: `${auth.userName}将工单归属设置为 ${assignee.name}` });
    });
    await notifyUser(assigneeId, `工单「${ticket.title}」已归属给你，请处理。`, { type: "TICKET", id: ticket.id, title: "工单归属变更", kind: "SYSTEM" });
    return NextResponse.json({ ok: true });
  }
  if (ticket.ticketKind !== "PROCUREMENT") {
    return NextResponse.json({ error: "仅采买工单可分配" }, { status: 400 });
  }
  // 新流程（有 ProcurementItem）的采买单走逐条审批 + 分配建单，不再同单翻转分配
  const itemCount = await prisma.procurementItem.count({ where: { ticketId: params.id } });
  if (itemCount > 0) {
    return NextResponse.json({ error: "该采买工单已使用逐条审批流程，请在详情页逐条审批并分配" }, { status: 400 });
  }
  if (ticket.status !== "APPROVED") {
    return NextResponse.json({ error: "仅采买通过的工单可分配" }, { status: 400 });
  }
  if (ticket.assigneeId === assigneeId) {
    return NextResponse.json({ error: "已经是该 PR，无需重复分配" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { assigneeId, acceptedAt: new Date() },
    });
    await tx.ticketAssigneeLog.create({
      data: {
        ticketId: params.id,
        fromUserId: ticket.assigneeId,
        toUserId: assigneeId,
        changedById: auth.userId,
        action: "ASSIGN",
        reason,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "ASSIGN",
      actorId: auth.userId,
      fromStatus: "APPROVED",
      toStatus: "APPROVED",
      note: `${auth.userName}将工单分配给 ${assignee.name}${reason ? `，理由：${reason}` : ""}`,
    });
  });

  await notifyUser(
    assigneeId,
    `采买工单「${ticket.title}」已分配给你，请处理。`,
    { type: "TICKET", id: ticket.id, title: "采买工单已分配", kind: "SYSTEM" },
  );

  return NextResponse.json({ ok: true });
}
