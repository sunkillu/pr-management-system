import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 驳回后重新提交：提交人本人或管理员可操作，审批人重置，可更换审批人
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
const request = await prisma.cooperationRequest.findUnique({ where: { id: params.id}});
if (!request) return NextResponse.json({ error: "合作需求不存在"}, { status: 404});
if (request.status!== "REJECTED") {
return NextResponse.json({ error: "仅被驳回的需求可重新提交"}, { status: 400});
}
if (auth.role!== "ADMIN" && request.submitterId!== auth.userId) {
return NextResponse.json({ error: "仅提交人本人或管理员可重新提交"}, { status: 403});
}

let approverIds: string[] = Array.isArray(body.approverIds)
? Array.from(new Set(body.approverIds as string[]))
: [];
// 未传审批人时沿用上次的审批人
if (approverIds.length === 0) {
const prev = await prisma.requestApprover.findMany({
where: { requestType: "COOP_REQUEST", requestId: params.id },
select: { approverId: true },
});
approverIds = Array.from(new Set(prev.map((p) => p.approverId)));
}
if (approverIds.length === 0) {
return NextResponse.json({ error: "请选择至少一位审批人" }, { status: 400 });
}
const approvers = await prisma.user.findMany({
where: { id: { in: approverIds}, role: { in: ["PR_MANAGER", "ADMIN"]}},
select: { id: true},
});
if (approvers.length!== approverIds.length) {
return NextResponse.json({ error: "审批人必须为PR负责人或管理员"}, { status: 400});
}

const updated = await prisma.$transaction(async (tx) => {
const u = await tx.cooperationRequest.update({
where: { id: params.id},
data: {
status: "PENDING",
rejectReason: null,
title: body.title?.trim() || undefined,
reqType: body.reqType?.trim() || undefined,
description: body.description?.trim() || undefined,
attachments: body.attachments!== undefined? body.attachments: undefined,
},
});
await tx.requestApprover.deleteMany({
where: { requestType: "COOP_REQUEST", requestId: params.id},
});
await tx.requestApprover.createMany({
data: approverIds.map((approverId) => ({
requestType: "COOP_REQUEST" as const,
requestId: params.id,
approverId,
})),
});
await writeLog(tx, {
docType: "COOP_REQUEST",
docId: params.id,
action: "RESUBMIT",
actorId: auth.userId,
fromStatus: "REJECTED",
toStatus: "PENDING",
note: body.note?.trim() || "修改后重新提交",
});
return u;
});

await notifyApprovers(
approverIds,
`「${updated.title}」修改后重新提交，请审批。`,
{ type: "COOP_REQUEST", id: updated.id, title: "合作需求重新提交", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(updated);
}
