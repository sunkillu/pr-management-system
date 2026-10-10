import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";

// 标记完成：执行中 → 已完成，同时写入合作评价（评分 1-5 + 文字评价），沉淀到达人/化妆师档案
// 完成后自动生成打款单（待业务审批），工单进入结算中，无需手动点"生成打款单"
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: {
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "仅执行中的工单可标记完成" }, { status: 400 });
  }
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人或管理员可标记完成" }, { status: 403 });
  }
  const body = await req.json();
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "请给出 1-5 星评价" }, { status: 400 });
  }

  const finalFee = body.actualFee ? body.actualFee : ticket.actualFee;
  const payeeName = ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "";

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: {
        status: "COMPLETED",
        actualFee: finalFee,
      },
    });
    await tx.cooperationReview.create({
      data: {
        ticketId: params.id,
        influencerId: ticket.influencerId,
        makeupArtistId: ticket.makeupArtistId,
        rating,
        comment: body.reviewComment?.trim() || null,
        reviewerId: auth.userId,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "IN_PROGRESS",
      toStatus: "COMPLETED",
      note: `标记完成，评价 ${rating} 星`,
    });
    // 自动生成打款单（待业务审批），工单进入结算中
    const payment = await tx.paymentRequest.create({
      data: {
        title: `合作工单结算-${ticket.title}`,
        amount: String(finalFee ?? ticket.budgetFee),
        payeeName,
        reason: `合作工单「${ticket.title}」结算`,
        ticketId: params.id,
        requesterId: auth.userId,
        status: "PENDING_BIZ",
      },
    });
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "SETTLING" },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "COMPLETED",
      toStatus: "SETTLING",
      note: `自动生成打款单「${payment.title}」`,
    });
    await writeLog(tx, {
      docType: "PAYMENT",
      docId: payment.id,
      action: "SUBMIT",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: "PENDING_BIZ",
      note: `由合作工单「${ticket.title}」自动生成`,
    });
    return { ticket: u, payment };
  });

  // 通知管理员有新的打款申请待业务审批
  const bizApprovers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await notifyApprovers(
    bizApprovers.map((a) => a.id),
    `【打款申请待审批】合作工单「${ticket.title}」已完成，系统自动生成了打款申请「${updated.payment.title}」（¥${updated.payment.amount}），请进行业务审批。`,
    { type: "PAYMENT", id: updated.payment.id, title: "打款申请待审批", kind: "APPROVAL_PENDING" }
  );

  return NextResponse.json(updated.ticket);
}
