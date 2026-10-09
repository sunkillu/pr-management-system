import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";

// 达人登记审批（或签）：任一审批人通过即通过；驳回需理由。
// 审批人 = 提交时多选的 PR负责人/管理员；ADMIN 可兜底审批。
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
const action = body.action as "APPROVE" | "REJECT";
if (!["APPROVE", "REJECT"].includes(action)) {
return NextResponse.json({ error: "action 非法"}, { status: 400});
}
if (action === "REJECT" &&!body.comment?.trim()) {
return NextResponse.json({ error: "驳回必须填写理由"}, { status: 400});
}

const influencer = await prisma.influencer.findUnique({
where: { id: params.id},
include: { registeredBy: { select: { id: true, name: true}}},
});
if (!influencer) return NextResponse.json({ error: "达人登记不存在"}, { status: 404});
if (influencer.status!== "PENDING") {
return NextResponse.json({ error: "仅待审核的登记可审批"}, { status: 400});
}

// 必须是被选中的审批人（ADMIN 兜底）
if (auth.role!== "ADMIN") {
const assigned = await prisma.requestApprover.findUnique({
where: {
requestType_requestId_approverId: {
requestType: "INFLUENCER",
requestId: params.id,
approverId: auth.userId,
},
},
});
if (!assigned) return NextResponse.json({ error: "你不是该登记的审批人"}, { status: 403});
}

const toStatus = action === "APPROVE"? "APPROVED": "REJECTED";
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.influencer.update({
where: { id: params.id},
data: {
status: toStatus,
rejectReason: action === "REJECT"? body.comment.trim(): null,
},
});
// 更新审批人自己的审批记录（或签：其他审批人保持 PENDING 即可）
await tx.requestApprover.upsert({
where: {
requestType_requestId_approverId: {
requestType: "INFLUENCER",
requestId: params.id,
approverId: auth.userId,
},
},
update: { status: action === "APPROVE" ? "APPROVED" : "REJECTED", decidedAt: new Date()},
create: {
requestType: "INFLUENCER",
requestId: params.id,
approverId: auth.userId,
status: action === "APPROVE" ? "APPROVED" : "REJECTED",
decidedAt: new Date(),
},
});
await writeLog(tx, {
docType: "INFLUENCER",
docId: params.id,
action,
actorId: auth.userId,
fromStatus: "PENDING",
toStatus,
note: body.comment?.trim() || null,
});
return u;
});

await notifyUser(
influencer.registeredById,
`「${influencer.name}」${action === "APPROVE"? "审批通过，可用于合作。": `被驳回，理由：${body.comment.trim()}`}`,
{ type: "INFLUENCER", id: influencer.id, title: influencer.name}
);

return NextResponse.json(updated);
}
