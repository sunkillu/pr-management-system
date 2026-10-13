import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";
import { canOperateTicket } from "@/lib/ticket-permission";

// 驳回后重提：创建人 / 审批链成员 / 管理员可操作，重新走审批（可更换审批人）
// 采买工单重提回到待采买审批；运营可重提自己的采买工单
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id}, select: { id: true, title: true, ticketKind: true, status: true }});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
const isProcurement = ticket.ticketKind === "PROCUREMENT";
const auth = await requireRoles(isProcurement ? ["ADMIN", "PR", "PR_MANAGER", "OPERATOR"] : ["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
if (ticket.status!== "REJECTED") {
return NextResponse.json({ error: "仅已驳回的工单可重新提交"}, { status: 400});
}
if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
return NextResponse.json({ error: "仅创建人、审批链成员或管理员可重新提交"}, { status: 403});
}
const body = await req.json().catch(() => ({}));
const approverIds: string[] = Array.isArray(body.approverIds)? body.approverIds: [];

await prisma.$transaction(async (tx) => {
await tx.cooperationTicket.update({
where: { id: params.id},
data: { status: isProcurement ? "PENDING_PROCUREMENT" : "PENDING_APPROVAL", rejectReason: null, escalatedAt: null},
});
if (approverIds.length > 0) {
await tx.requestApprover.deleteMany({
where: { requestType: "TICKET", requestId: params.id},
});
await tx.requestApprover.createMany({
data: approverIds.map((approverId: string) => ({
requestType: "TICKET" as const,
requestId: params.id,
approverId,
})),
});
} else {
await tx.requestApprover.updateMany({
where: { requestType: "TICKET", requestId: params.id},
data: { status: "PENDING", decidedAt: null},
});
}
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: "RESUBMIT",
actorId: auth.userId,
fromStatus: "REJECTED",
toStatus: isProcurement ? "PENDING_PROCUREMENT" : "PENDING_APPROVAL",
note: body.note?.trim() || null,
});
});

const approvers = await prisma.requestApprover.findMany({
where: { requestType: "TICKET", requestId: params.id},
select: { approverId: true},
});
await notifyApprovers(
approvers.map((a) => a.approverId),
`${auth.userName}重新提交了合作工单「${ticket.title}」，请审批。`,
{ type: "TICKET", id: ticket.id, title: "合作工单待审批", kind: "APPROVAL_PENDING"}
);

return NextResponse.json({ ok: true});
}
