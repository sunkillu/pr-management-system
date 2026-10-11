import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { notifyApprovers } from "@/lib/feishu-notify";
import { writeLog } from "@/lib/approval-log";

// 编辑打款申请：仅待业务审批 / 已驳回状态可编辑；工单结算单驳回后回到待财务审批
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (auth.role === "PR_MANAGER" && (!existing.ticketId || existing.requesterId !== auth.userId)) {
    return NextResponse.json({ error: "PR负责人仅可编辑本人发起的工单结算单" }, { status: 403 });
  }
  if (!["PENDING_BIZ", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "当前状态不可编辑" }, { status: 400 });
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "金额必须大于 0" }, { status: 400 });
  if (!body.payeeName?.trim()) return NextResponse.json({ error: "收款方不能为空" }, { status: 400 });

  const nextStatus = existing.status === "REJECTED"
    ? existing.ticketId ? "PENDING_FIN" : "PENDING_BIZ"
    : existing.status;
  const payment = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentRequest.updateMany({
      where: { id: params.id, status: existing.status },
      data: {
        title: body.title.trim(),
        amount: body.amount,
        payeeName: body.payeeName.trim(),
        payeeAccount: body.payeeAccount || null,
        reason: body.reason || null,
        outletId: body.outletId || null,
        campaignId: body.campaignId || null,
        contentId: body.contentId || null,
        status: nextStatus,
        rejectReason: null,
      },
    });
    if (updated.count !== 1) return null;
    if (existing.status === "REJECTED") {
      await writeLog(tx, {
        docType: "PAYMENT",
        docId: params.id,
        action: "RESUBMIT",
        actorId: auth.userId,
        fromStatus: "REJECTED",
        toStatus: nextStatus,
        note: "修改后重新提交",
      });
    }
    return tx.paymentRequest.findUniqueOrThrow({ where: { id: params.id } });
  });
  if (!payment) {
    return NextResponse.json({ error: "申请状态已变化，请刷新页面后重试" }, { status: 409 });
  }
  if (existing.status === "REJECTED" && existing.ticketId) {
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

// 删除：运营 / 管理员
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  await prisma.paymentRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
