import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const actualFee = Number(body.actualFee);
  if (!Number.isFinite(actualFee) || actualFee <= 0) return NextResponse.json({ error: "实际费用必须大于 0" }, { status: 400 });
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      title: true,
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "PUBLISHED") return NextResponse.json({ error: "仅已发布工单可提交结算审批" }, { status: 400 });
  const followUpCount = await prisma.followUpRecord.count({ where: { ticketId: params.id } });
  if (followUpCount < 1) return NextResponse.json({ error: "申请结算前至少需要完成一次跟进" }, { status: 400 });
  const existing = await prisma.paymentRequest.findFirst({ where: { ticketId: params.id, status: { notIn: ["REJECTED", "VOIDED", "PAID"] } }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "该工单已有进行中的结算申请" }, { status: 409 });
  const payment = await prisma.$transaction(async (tx) => {
    const payeeName = ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "合作达人/合作方";
    const created = await tx.paymentRequest.create({ data: { title: `合作结算-${ticket.title}`, amount: actualFee, payeeName, reason: `工单「${ticket.title}」已发布结算`, ticketId: params.id, requesterId: auth.userId, status: "PENDING_BIZ" } });
    await tx.cooperationTicket.update({ where: { id: params.id }, data: { actualFee } });
    await writeLog(tx, { docType: "PAYMENT", docId: created.id, action: "SUBMIT", actorId: auth.userId, toStatus: "PENDING_BIZ", note: `已发布后提交实际费用 ¥${actualFee}` });
    return created;
  });
  const approvers = await prisma.user.findMany({ where: { role: { in: ["PR_MANAGER", "ADMIN"] } }, select: { id: true } });
  await notifyApprovers(approvers.map((u) => u.id), `工单「${ticket.title}」已发布，请审批实际结算金额 ¥${actualFee}。`, { type: "PAYMENT", id: payment.id, title: "结算申请待业务审批", kind: "APPROVAL_PENDING" });
  return NextResponse.json(payment, { status: 201 });
}
