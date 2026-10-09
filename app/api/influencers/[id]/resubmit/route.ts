import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 驳回后重新提交：登记人本人或管理员可操作，状态回到待审核，审批人重置为待审批。
// 可更换审批人（多选 PR负责人/管理员）。
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
const influencer = await prisma.influencer.findUnique({ where: { id: params.id}});
if (!influencer) return NextResponse.json({ error: "达人登记不存在"}, { status: 404});
if (influencer.status!== "REJECTED") {
return NextResponse.json({ error: "仅被驳回的登记可重新提交"}, { status: 400});
}
if (auth.role!== "ADMIN" && influencer.registeredById!== auth.userId) {
return NextResponse.json({ error: "仅登记人本人或管理员可重新提交"}, { status: 403});
}

let approverIds: string[] = Array.isArray(body.approverIds)
? Array.from(new Set(body.approverIds as string[]))
: [];
// 未传审批人时沿用上次的审批人
if (approverIds.length === 0) {
const prev = await prisma.requestApprover.findMany({
where: { requestType: "INFLUENCER", requestId: params.id },
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
const u = await tx.influencer.update({
where: { id: params.id},
data: {
status: "PENDING",
rejectReason: null,
name: body.name?.trim() || undefined,
platforms: Array.isArray(body.platforms)? body.platforms: undefined,
contactInfo: body.contactInfo!== undefined? body.contactInfo || null: undefined,
bio: body.bio!== undefined? body.bio || null: undefined,
},
});
await tx.requestApprover.deleteMany({
where: { requestType: "INFLUENCER", requestId: params.id},
});
await tx.requestApprover.createMany({
data: approverIds.map((approverId) => ({
requestType: "INFLUENCER" as const,
requestId: params.id,
approverId,
})),
});
await writeLog(tx, {
docType: "INFLUENCER",
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
`「${updated.name}」修改后重新提交，请审批。`,
{ type: "INFLUENCER", id: updated.id, title: "达人登记重新提交", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(updated);
}
