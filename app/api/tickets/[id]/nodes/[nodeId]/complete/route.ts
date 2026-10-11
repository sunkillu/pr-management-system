import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 标记进度节点完成（记录完成人/时间，可附推进说明记入日志）
// 仅创建人 / 审批链成员 / ADMIN 可操作
export async function POST(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["APPROVED", "IN_PROGRESS"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅待执行/执行中的工单可更新节点" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可推进节点" }, { status: 403 });
  }
  const node = await prisma.ticketNode.findFirst({
    where: { id: params.nodeId, ticketId: params.id },
  });
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
  if (node.completedAt) return NextResponse.json({ error: "该节点已完成" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").trim() || null;

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticketNode.update({
      where: { id: node.id },
      data: { completedAt: new Date(), completedById: auth.userId },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      note: `完成进度节点「${node.name}」${note ? `：${note}` : ""}`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
