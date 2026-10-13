import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";

// 提交打款申请：运营 / 管理员，初始状态为待业务审批，写入操作日志
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "金额必须大于 0" }, { status: 400 });
  if (!body.payeeName?.trim()) return NextResponse.json({ error: "收款方不能为空" }, { status: 400 });

  const [payment] = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentRequest.create({
      data: {
        title: body.title.trim(),
        amount: body.amount,
        payeeName: body.payeeName.trim(),
        payeeAccount: body.payeeAccount || null,
        reason: body.reason || null,
        outletId: body.outletId || null,
        campaignId: body.campaignId || null,
        contentId: body.contentId || null,
        ticketId: body.ticketId || null,
        // 品牌从关联工单自动透传
        brandId: body.ticketId
          ? (await tx.cooperationTicket.findUnique({ where: { id: body.ticketId }, select: { brandId: true } }))?.brandId ?? null
          : null,
        requesterId: auth.userId,
        status: "PENDING_BIZ",
      },
    });
    await writeLog(tx, {
      docType: "PAYMENT",
      docId: created.id,
      action: "SUBMIT",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: "PENDING_BIZ",
    });
    // 关联合作工单：工单进入结算中
    if (body.ticketId) {
      const ticket = await tx.cooperationTicket.findUnique({ where: { id: body.ticketId } });
      if (ticket && ticket.status === "COMPLETED") {
        await tx.cooperationTicket.update({
          where: { id: ticket.id },
          data: { status: "SETTLING" },
        });
        await writeLog(tx, {
          docType: "TICKET",
          docId: ticket.id,
          action: "SUBMIT",
          actorId: auth.userId,
          fromStatus: "COMPLETED",
          toStatus: "SETTLING",
          note: `生成打款单「${created.title}」`,
        });
      }
    }
    return [created];
  });

  // 飞书通知业务审批人（管理员）
  const bizApprovers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await notifyApprovers(
    bizApprovers.map((a) => a.id),
    `【打款申请待审批】${auth.userName}提交了打款申请「${payment.title}」（¥${payment.amount}），请进行业务审批。`,
    { type: "PAYMENT", id: payment.id, title: "打款申请待审批", kind: "APPROVAL_PENDING" }
  );

  return NextResponse.json(payment, { status: 201 });
}
