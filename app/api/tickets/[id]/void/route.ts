import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 作废：ADMIN 可作废非终态单；创建人/审批链成员仅可作废待审批/草稿/已驳回；终态（已结算/已作废）不可作废
const TERMINAL = ["SETTLED", "VOIDED"];
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.reason?.trim()) return NextResponse.json({ error: "作废必须填写理由" }, { status: 400 });
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (TERMINAL.includes(ticket.status)) {
    return NextResponse.json({ error: "终态工单不可作废" }, { status: 400 });
  }
  if (auth.role !== "ADMIN") {
    if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
      return NextResponse.json({ error: "仅创建人、审批链成员或管理员可作废" }, { status: 403 });
    }
    if (!["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(ticket.status)) {
      return NextResponse.json({ error: "仅可作废待审批/草稿/已驳回的工单" }, { status: 403 });
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "VOIDED", voidReason: body.reason.trim() },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "VOID",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: "VOIDED",
      note: body.reason.trim(),
    });
    return u;
  });
  return NextResponse.json(updated);
}
