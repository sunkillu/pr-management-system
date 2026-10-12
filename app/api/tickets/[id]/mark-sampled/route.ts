import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 标记已寄品：执行中 → 已寄品
// 有系统寄品单时需已核销；手动确认路径（无系统单）PR可直接标记
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "仅执行中的工单可标记已寄品" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }

  // 有系统寄品单时，必须已核销
  const sample = await prisma.sampleShipment.findFirst({
    where: { ticketId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (sample && sample.status !== "WRITTEN_OFF") {
    return NextResponse.json({ error: "寄件请求尚未核销，请等待仓库核销后自动流转" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "SAMPLED" },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "IN_PROGRESS",
      toStatus: "SAMPLED",
      note: sample ? "寄件已核销，工单进入已寄品" : "手动确认已寄品",
    });
    return u;
  });
  return NextResponse.json(updated);
}
