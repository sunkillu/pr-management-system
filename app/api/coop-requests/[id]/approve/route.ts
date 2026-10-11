import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";

// 合作需求审批（或签）：任一管理员审批人通过即通过；驳回需理由。仅管理员可审批。
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN"]);
if (!auth.ok) return auth.res;
const body = await req.json();
const action = body.action as "APPROVE" | "REJECT";
if (!["APPROVE", "REJECT"].includes(action)) {
return NextResponse.json({ error: "action 非法"}, { status: 400});
}
if (action === "REJECT" &&!body.comment?.trim()) {
return NextResponse.json({ error: "驳回必须填写理由"}, { status: 400});
}

const request = await prisma.cooperationRequest.findUnique({ where: { id: params.id}});
if (!request) return NextResponse.json({ error: "合作需求不存在"}, { status: 404});
if (request.status!== "PENDING") {
return NextResponse.json({ error: "仅待审批的需求可审批"}, { status: 400});
}

const toStatus = action === "APPROVE"? "APPROVED": "REJECTED";
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.cooperationRequest.update({
where: { id: params.id},
data: {
status: toStatus,
rejectReason: action === "REJECT"? body.comment.trim(): null,
},
});
// 审批通过：自动创建达人并直接入库（幂等：已生成过则跳过）
let influencerId = request.influencerId;
if (action === "APPROVE" &&!influencerId) {
const inf = await tx.influencer.create({
data: {
name: request.title,
influencerType: request.influencerType,
platforms: request.platforms,
bio: request.description,
attachments: request.attachments ?? undefined,
status: "APPROVED",
registeredById: request.submitterId,
tags: [],
},
});
influencerId = inf.id;
await tx.cooperationRequest.update({
where: { id: params.id},
data: { influencerId },
});
}
await tx.requestApprover.upsert({
where: {
requestType_requestId_approverId: {
requestType: "COOP_REQUEST",
requestId: params.id,
approverId: auth.userId,
},
},
update: { status: action === "APPROVE" ? "APPROVED" : "REJECTED", decidedAt: new Date(), comment: body.comment?.trim() || null },
create: {
requestType: "COOP_REQUEST",
requestId: params.id,
approverId: auth.userId,
status: action === "APPROVE" ? "APPROVED" : "REJECTED",
decidedAt: new Date(),
comment: body.comment?.trim() || null,
},
});
await writeLog(tx, {
docType: "COOP_REQUEST",
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
request.submitterId,
`「${request.title}」${action === "APPROVE"? "审批通过，已自动加入达人库。": `被驳回，理由：${body.comment.trim()}`}`,
{ type: "COOP_REQUEST", id: request.id, title: "合作需求审批结果", kind: action === "APPROVE" ? "APPROVED" : "REJECTED" }
);

return NextResponse.json(updated);
}
