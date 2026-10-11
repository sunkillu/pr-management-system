import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";

// 被驳回的工单结算单重新提交到财务审批；普通打款单重新走业务与财务审批。
// 仅申请人本人或管理员可操作；修改说明写入历史日志；重提次数不设限
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (existing.status !== "REJECTED") {
    return NextResponse.json({ error: "仅被驳回的申请可重新提交" }, { status: 400 });
  }
  if (auth.role === "PR_MANAGER" && !existing.ticketId) {
    return NextResponse.json({ error: "PR负责人仅可重新提交工单结算单" }, { status: 403 });
  }
  if (existing.requesterId !== auth.userId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "仅申请人本人或管理员可重新提交" }, { status: 403 });
  }

  const nextStatus = existing.ticketId ? "PENDING_FIN" : "PENDING_BIZ";
  const payment = await prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentRequest.updateMany({
      where: { id: params.id, status: "REJECTED" },
      data: { status: nextStatus, rejectReason: null },
    });
    if (claimed.count !== 1) return null;
    await writeLog(tx, {
      docType: "PAYMENT",
      docId: params.id,
      action: "RESUBMIT",
      actorId: auth.userId,
      fromStatus: "REJECTED",
      toStatus: nextStatus,
      note: note || null,
    });
    return tx.paymentRequest.findUniqueOrThrow({ where: { id: params.id } });
  });
  if (!payment) {
    return NextResponse.json({ error: "申请已由其他人重新提交，请刷新页面" }, { status: 409 });
  }
  if (nextStatus === "PENDING_FIN") {
    const financeApprovers = await prisma.user.findMany({
      where: { role: { in: ["FINANCE", "ADMIN"] } },
      select: { id: true },
    });
    await notifyApprovers(
      financeApprovers.map((approver) => approver.id),
      `打款申请「${payment.title}」已重新提交，请进行财务审批。`,
      { type: "PAYMENT", id: payment.id, title: "打款申请待财务审批", kind: "APPROVAL_PENDING" },
    );
  }
  return NextResponse.json(payment);
}
