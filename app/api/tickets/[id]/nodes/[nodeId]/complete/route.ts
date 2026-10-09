import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 标记进度节点完成（记录完成人/时间）
export async function POST(_req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["APPROVED", "IN_PROGRESS"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅待执行/执行中的工单可更新节点" }, { status: 400 });
  }
  const node = await prisma.ticketNode.findFirst({
    where: { id: params.nodeId, ticketId: params.id },
  });
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
  if (node.completedAt) return NextResponse.json({ error: "该节点已完成" }, { status: 400 });

  const updated = await prisma.ticketNode.update({
    where: { id: node.id },
    data: { completedAt: new Date(), completedById: auth.userId },
  });
  return NextResponse.json(updated);
}
