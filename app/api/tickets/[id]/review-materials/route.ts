import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 素材审批：PR负责人 / ADMIN 审批回收素材
// 通过：待素材审批 → 已完成 → 自动生成打款单 → 结算中
// 驳回（需理由）：待素材审批 → 执行中（继续回收素材）
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const ticket = await prisma.cooperationTicket.findUnique({
where: { id: params.id},
include: {
influencer: { select: { name: true}},
makeupArtist: { select: { name: true}},
},
});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
if (ticket.status!== "MATERIAL_REVIEW") {
return NextResponse.json({ error: "仅待素材审批的工单可操作"}, { status: 400});
}
const body = await req.json();
const action = String(body.action?? "").toUpperCase();
if (!["APPROVE", "REJECT"].includes(action)) {
return NextResponse.json({ error: "action 必须为 APPROVE 或 REJECT"}, { status: 400});
}
const reason = String(body.reason?? "").trim();
if (action === "REJECT" &&!reason) {
return NextResponse.json({ error: "驳回必须填写理由"}, { status: 400});
}

if (action === "REJECT") {
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.cooperationTicket.update({
where: { id: params.id},
data: { status: "IN_PROGRESS"},
});
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: "REJECT",
actorId: auth.userId,
fromStatus: "MATERIAL_REVIEW",
toStatus: "IN_PROGRESS",
note: `素材审批驳回：${reason}`,
});
return u;
});
return NextResponse.json(updated);
}

// 通过：生成打款单，工单进入结算中
const payeeName = ticket.influencer?.name?? ticket.makeupArtist?.name?? "";
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.cooperationTicket.update({
where: { id: params.id},
data: { status: "COMPLETED"},
});
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "MATERIAL_REVIEW",
toStatus: "COMPLETED",
note: body.comment?.trim()? `素材审批通过：${body.comment.trim()}`: "素材审批通过",
});
const payment = await tx.paymentRequest.create({
data: {
title: `合作工单结算-${ticket.title}`,
amount: String(ticket.actualFee?? ticket.budgetFee),
payeeName,
reason: `合作工单「${ticket.title}」结算`,
ticketId: params.id,
requesterId: auth.userId,
status: "PENDING_BIZ",
},
});
await tx.cooperationTicket.update({
where: { id: params.id},
data: { status: "SETTLING"},
});
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "COMPLETED",
toStatus: "SETTLING",
note: `素材审批通过，自动生成打款单「${payment.title}」`,
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
return { ticket: u, payment};
});

// 通知管理员有新的打款申请待业务审批
const bizApprovers = await prisma.user.findMany({
where: { role: "ADMIN"},
select: { id: true},
});
await notifyApprovers(
bizApprovers.map((a) => a.id),
`合作工单「${ticket.title}」素材审批通过，系统自动生成了打款申请「${updated.payment.title}」（¥${updated.payment.amount}），请进行业务审批。`,
{ type: "PAYMENT", id: updated.payment.id, title: "打款申请待审批", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(updated.ticket);
}
