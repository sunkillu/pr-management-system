import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";
import { canOperateTicket} from "@/lib/ticket-permission";

// 发布后结算请求：工单已发布后，PR 发起结算请求，生成一笔待业务审批的打款单
// （reason 前缀标识）。审批人 = PR负责人：
// - 创建：POST { actualFee, note?}，工单须为 PUBLISHED
// - 审批：POST { action: "APPROVE" | "REJECT", paymentId, comment?}，仅 PR负责人 / ADMIN
// 通过 → 打款单进待财务审批（PENDING_FIN，即财务打款单已就绪，复用同一 PaymentRequest 流转，
// 不另建第二笔，避免重复打款）；驳回 → 已驳回（需理由）。
const SETTLE_REASON_PREFIX = "";

export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json().catch(() => ({}));

// ---- 审批分支 ----
if (body.action) {
const action = String(body.action).toUpperCase() as "APPROVE" | "REJECT";
if (!["APPROVE", "REJECT"].includes(action)) {
return NextResponse.json({ error: "action 必须为 APPROVE 或 REJECT"}, { status: 400});
}
if (auth.role!== "ADMIN" && auth.role!== "PR_MANAGER") {
return NextResponse.json({ error: "仅 PR负责人或管理员可审批结算请求"}, { status: 403});
}
const paymentId = String(body.paymentId?? "");
if (!paymentId) return NextResponse.json({ error: "paymentId 必填"}, { status: 400});
const payment = await prisma.paymentRequest.findUnique({ where: { id: paymentId}});
if (!payment || payment.ticketId!== params.id) {
return NextResponse.json({ error: "结算请求不存在"}, { status: 404});
}
if (!payment.reason?.startsWith(SETTLE_REASON_PREFIX)) {
return NextResponse.json({ error: "该打款单不是发布后结算请求"}, { status: 400});
}
if (payment.status!== "PENDING_BIZ") {
return NextResponse.json({ error: "仅待审批的结算请求可操作"}, { status: 400});
}
const comment = String(body.comment?? "").trim();
if (action === "REJECT" &&!comment) {
return NextResponse.json({ error: "驳回必须填写理由"}, { status: 400});
}
const toStatus = action === "APPROVE"? "PENDING_FIN": "REJECTED";
const [updated] = await prisma.$transaction(async (tx) => {
const u = await tx.paymentRequest.update({
where: { id: paymentId},
data: {
status: toStatus,
rejectReason: action === "REJECT"? comment: null,
},
});
// 驳回时工单回到已发布，PR 可重新发送结算请求
if (action === "REJECT") {
await tx.cooperationTicket.update({
where: { id: params.id},
data: { status: "PUBLISHED" },
});
}
await tx.approvalRecord.create({
data: {
stage: "BIZ",
action,
comment: comment || null,
approverId: auth.userId,
paymentRequestId: paymentId,
},
});
await writeLog(tx, {
docType: "PAYMENT",
docId: paymentId,
action,
actorId: auth.userId,
fromStatus: "PENDING_BIZ",
toStatus,
note: action === "APPROVE"? "发布后结算请求审批通过，进入财务审批": `发布后结算请求驳回：${comment}`,
});
return [u];
});
if (action === "APPROVE") {
const financeApprovers = await prisma.user.findMany({
where: { role: { in: ["FINANCE", "ADMIN"]}},
select: { id: true},
});
await notifyApprovers(
financeApprovers.map((a) => a.id),
`发布后结算请求已通过 PR负责人审批，打款申请「${payment.title}」（¥${payment.amount}）待财务审批。`,
{ type: "PAYMENT", id: payment.id, title: "打款申请待财务审批", kind: "APPROVAL_PENDING"}
);
}
return NextResponse.json(updated);
}

// ---- 创建分支 ----
const ticket = await prisma.cooperationTicket.findUnique({
where: { id: params.id},
include: {
influencer: { select: { name: true}},
makeupArtist: { select: { name: true}},
},
});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
if (ticket.status!== "PUBLISHED") {
return NextResponse.json({ error: "仅已发布的工单可发送结算请求"}, { status: 400});
}
if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
return NextResponse.json({ error: "仅创建人、审批链成员或管理员可发送结算请求"}, { status: 403});
}
const actualFee = Number(body.actualFee);
if (!Number.isFinite(actualFee) || actualFee <= 0) {
return NextResponse.json({ error: "实际价格必须为大于 0 的数字"}, { status: 400});
}
const note = String(body.note?? "").trim();
// 防重复：同一工单已有未终结的结算请求时拒绝
const existing = await prisma.paymentRequest.findFirst({
where: {
ticketId: params.id,
reason: { startsWith: SETTLE_REASON_PREFIX},
status: { in: ["PENDING_BIZ", "PENDING_FIN", "APPROVED"]},
},
});
if (existing) {
return NextResponse.json({ error: "该工单已有待处理的结算请求，请勿重复发送"}, { status: 400});
}
const payeeName = ticket.influencer?.name?? ticket.makeupArtist?.name?? "";
const [payment] = await prisma.$transaction(async (tx) => {
await tx.cooperationTicket.update({
where: { id: params.id},
data: { actualFee: String(actualFee), status: "SETTLING" },
});
const p = await tx.paymentRequest.create({
data: {
title: `发布后结算-${ticket.title}`,
amount: String(actualFee),
payeeName,
reason: `${SETTLE_REASON_PREFIX}${note? ` ${note}`: ""}（工单「${ticket.title}」已发布）`,
ticketId: params.id,
brandId: ticket.brandId,
requesterId: auth.userId,
status: "PENDING_BIZ",
},
});
await writeLog(tx, {
docType: "PAYMENT",
docId: p.id,
action: "SUBMIT",
actorId: auth.userId,
fromStatus: null,
toStatus: "PENDING_BIZ",
note: `发布后结算请求，实际价格 ¥${actualFee}`,
});
return [p];
});
// 通知 PR负责人审批
const prManagers = await prisma.user.findMany({
where: { role: { in: ["PR_MANAGER", "ADMIN"]}},
select: { id: true},
});
await notifyApprovers(
prManagers.map((a) => a.id),
`工单「${ticket.title}」已发布，发起结算请求（实际价格 ¥${actualFee}），请 PR负责人审批。`,
{ type: "PAYMENT", id: payment.id, title: "发布后结算请求待审批", kind: "APPROVAL_PENDING"}
);
return NextResponse.json(payment);
}
