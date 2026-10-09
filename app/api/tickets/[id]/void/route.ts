import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 作废：创建人可作废自己的待审批单；ADMIN 可作废非终态单；终态（已结算/已作废）不可作废
const TERMINAL = ["SETTLED", "VOIDED"];
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.reason?.trim()) return NextResponse.json({ error: "作废必须填写理由" }, { status: 400 });
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (TERMINAL.includes(ticket.status)) {
    return NextResponse.json({ error: "终态工单不可作废" }, { status: 400 });
  }
  if (auth.role !== "ADMIN") {
    if (ticket.creatorId !== auth.userId) {
      return NextResponse.json({ error: "仅创建人或管理员可作废" }, { status: 403 });
    }
    if (!["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(ticket.status)) {
      return NextResponse.json({ error: "创建人仅可作废待审批/草稿/已驳回的工单" }, { status: 403 });
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
