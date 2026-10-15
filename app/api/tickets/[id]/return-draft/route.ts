import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id }, select: { status: true, confirmedDate: true } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "AWAITING_DRAFT") return NextResponse.json({ error: "仅待返稿工单可推送为已返稿" }, { status: 400 });
  if (!ticket.confirmedDate) return NextResponse.json({ error: "请先填写确定档期" }, { status: 400 });
  const count = await prisma.materialRecord.count({ where: { ticketId: params.id } });
  if (count === 0) return NextResponse.json({ error: "请先上传素材" }, { status: 400 });
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.cooperationTicket.updateMany({ where: { id: params.id, status: "AWAITING_DRAFT" }, data: { status: "DRAFT_RETURNED", materialApprovedAt: new Date(), materialApprovedById: auth.userId } });
    if (result.count !== 1) return null;
    await writeLog(tx, { docType: "TICKET", docId: params.id, action: "APPROVE", actorId: auth.userId, fromStatus: "AWAITING_DRAFT", toStatus: "DRAFT_RETURNED", note: "素材审批通过并确认已返稿" });
    return tx.cooperationTicket.findUnique({ where: { id: params.id } });
  });
  if (!updated) return NextResponse.json({ error: "状态已变化，请刷新后重试" }, { status: 409 });
  return NextResponse.json(updated);
}
