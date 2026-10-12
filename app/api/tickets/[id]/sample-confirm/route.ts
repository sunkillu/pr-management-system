import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 手动确认已寄品/无需寄品：待寄品 → 执行中
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "PENDING_SAMPLE") {
    return NextResponse.json({ error: "仅待寄品的工单可确认" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: {
        status: "IN_PROGRESS",
        sampleConfirmedAt: new Date(),
        sampleConfirmedById: auth.userId,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "PENDING_SAMPLE",
      toStatus: "IN_PROGRESS",
      note: "手动确认已寄品/无需寄品，进入执行中",
    });
    return u;
  });
  return NextResponse.json(updated);
}
