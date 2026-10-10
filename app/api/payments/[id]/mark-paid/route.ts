import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 标记已打款：财务（管理员兜底也有权限）。待打款 → 已打款，写入操作日志。
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (existing.status !== "APPROVED") {
    return NextResponse.json({ error: "仅待打款的申请可标记已打款" }, { status: 400 });
  }
  // 必须先上传打款凭证才能标记已打款
  const voucherCount = await prisma.paymentVoucher.count({ where: { paymentRequestId: params.id } });
  if (voucherCount === 0) {
    return NextResponse.json({ error: "请先上传打款凭证，再标记已打款" }, { status: 400 });
  }
  const [payment] = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentRequest.update({
      where: { id: params.id },
      data: { status: "PAID" },
    });
    await writeLog(tx, {
      docType: "PAYMENT",
      docId: params.id,
      action: "MARK_PAID",
      actorId: auth.userId,
      fromStatus: "APPROVED",
      toStatus: "PAID",
    });
    // 关联合作工单：已打款 → 工单进入跟进中（15天数据跟进），并累计合作次数/费用
    if (existing.ticketId) {
      const ticket = await tx.cooperationTicket.findUnique({ where: { id: existing.ticketId } });
      if (ticket && ["SETTLING", "COMPLETED"].includes(ticket.status)) {
        const fee = Number(ticket.actualFee ?? ticket.budgetFee);
        const followUpDueDate = new Date(Date.now() + 15 * 24 * 3600 * 1000);
        await tx.cooperationTicket.update({
          where: { id: ticket.id },
          data: { status: "FOLLOW_UP", followUpDueDate },
        });
        await writeLog(tx, {
          docType: "TICKET",
          docId: ticket.id,
          action: "MARK_PAID",
          actorId: auth.userId,
          fromStatus: ticket.status,
          toStatus: "FOLLOW_UP",
          note: `打款单「${updated.title}」已打款，进入15天跟进期`,
        });
        if (ticket.influencerId) {
          await tx.influencer.update({
            where: { id: ticket.influencerId },
            data: { coopCount: { increment: 1 }, totalFee: { increment: fee } },
          });
        }
        if (ticket.makeupArtistId) {
          await tx.makeupArtist.update({
            where: { id: ticket.makeupArtistId },
            data: { coopCount: { increment: 1 }, totalFee: { increment: fee } },
          });
        }
      }
    }
    return [updated];
  });
  return NextResponse.json(payment);
}
