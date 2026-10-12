import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 素材审批：PR负责人 / ADMIN 审批回收素材
// 通过：待素材审批 → 自动生成待财务审批的打款单 → 结算中
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
const claimed = await tx.cooperationTicket.updateMany({
where: { id: params.id, status: "MATERIAL_REVIEW" },
data: { status: "PUBLISHED" },
});
if (claimed.count !== 1) return false;
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: "REJECT",
actorId: auth.userId,
fromStatus: "MATERIAL_REVIEW",
toStatus: "PUBLISHED",
note: `素材审批驳回：${reason}`,
});
return tx.cooperationTicket.findUniqueOrThrow({ where: { id: params.id } });
});
if (!updated) {
return NextResponse.json({ error: "素材审批已由其他人处理，请刷新页面"}, { status: 409});
}
return NextResponse.json(updated);
}

// 通过：生成打款单，工单进入结算中
const payeeName = ticket.influencer?.name?? ticket.makeupArtist?.name?? "";
const updated = await prisma.$transaction(async (tx) => {
const claimed = await tx.cooperationTicket.updateMany({
where: { id: params.id, status: "MATERIAL_REVIEW" },
data: { status: "SETTLING"},
});
if (claimed.count !== 1) return null;
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "MATERIAL_REVIEW",
toStatus: "SETTLING",
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
status: "PENDING_FIN",
},
});
await writeLog(tx, {
docType: "PAYMENT",
docId: payment.id,
action: "SUBMIT",
actorId: auth.userId,
fromStatus: null,
toStatus: "PENDING_FIN",
note: `由合作工单「${ticket.title}」素材审批通过后自动提交财务审批`,
});
const settledTicket = await tx.cooperationTicket.findUniqueOrThrow({ where: { id: params.id } });
return { ticket: settledTicket, payment};
});
if (!updated) {
return NextResponse.json({ error: "素材审批已由其他人处理，请刷新页面"}, { status: 409});
}

// 通知财务审批人；管理员保留财务审批兜底权限。
const financeApprovers = await prisma.user.findMany({
where: { role: { in: ["FINANCE", "ADMIN"]}},
select: { id: true},
});
await notifyApprovers(
financeApprovers.map((a) => a.id),
`合作工单「${ticket.title}」素材审批通过，系统自动生成打款申请「${updated.payment.title}」（¥${updated.payment.amount}），请进行财务审批。`,
{ type: "PAYMENT", id: updated.payment.id, title: "打款申请待财务审批", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(updated.ticket);
}
