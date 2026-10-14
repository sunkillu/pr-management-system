import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { refreshTicketTitle } from "@/lib/ticket-title-refresh";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, ticketKind: true, status: true, creatorId: true, assigneeId: true },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId && ticket.assigneeId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人、归属人或管理员可操作" }, { status: 403 });
  }
  if (ticket.ticketKind !== "MAINTENANCE" || ticket.status !== "MAINTAINING") {
    return NextResponse.json({ error: "仅维护中的维护工单可转为合作工单" }, { status: 400 });
  }

  const converted = await prisma.$transaction(async (tx) => {
    const updated = await tx.cooperationTicket.updateMany({
      where: { id: params.id, ticketKind: "MAINTENANCE", status: "MAINTAINING" },
      data: { ticketKind: "COOPERATION", status: "DRAFT", escalatedAt: null },
    });
    if (updated.count !== 1) return false;
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "EDIT",
      actorId: auth.userId,
      fromStatus: "MAINTAINING",
      toStatus: "DRAFT",
      note: "维护工单转合作工单",
    });
    await refreshTicketTitle(tx as never, params.id);
    return true;
  });

  if (!converted) {
    return NextResponse.json({ error: "工单状态已变化，请刷新页面后重试" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
