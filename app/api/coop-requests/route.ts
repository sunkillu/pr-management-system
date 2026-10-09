import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 列表：所有登录用户可查
export async function GET(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const { searchParams} = new URL(req.url);
const q = searchParams.get("q")?? "";
const status = searchParams.get("status");
const influencerType = searchParams.get("type");
const platform = searchParams.get("platform");
const list = await prisma.cooperationRequest.findMany({
where: {
...(q? { title: { contains: q, mode: "insensitive" as const}}: {}),
...(status? { status: status as never}: {}),
...(influencerType? { influencerType: influencerType as never}: {}),
...(platform? { platforms: { has: platform}}: {}),
},
include: { submitter: { select: { name: true}}},
orderBy: { updatedAt: "desc"},
});
return NextResponse.json(list);
}

// 提交合作需求：多选审批人（仅管理员），或签（任一通过即通过），提交后飞书通知审批人们
export async function POST(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
if (!body.title?.trim()) {
return NextResponse.json({ error: "标题不能为空"}, { status: 400});
}
if (!body.description?.trim()) {
return NextResponse.json({ error: "详细描述不能为空"}, { status: 400});
}
const approverIds: string[] = Array.isArray(body.approverIds)
? Array.from(new Set(body.approverIds as string[]))
: [];
if (approverIds.length === 0) {
return NextResponse.json({ error: "请选择至少一位审批人"}, { status: 400});
}
const approvers = await prisma.user.findMany({
where: { id: { in: approverIds}, role: "ADMIN"},
select: { id: true},
});
if (approvers.length!== approverIds.length) {
return NextResponse.json({ error: "审批人必须为管理员"}, { status: 400});
}

const influencerType = ["KOL", "KOC", "AMATEUR", "MAKEUP_ARTIST"].includes(body.influencerType)
? body.influencerType
: null;
const platforms: string[] = Array.isArray(body.platforms)
? Array.from(new Set((body.platforms as string[]).filter((p) => ["XIAOHONGSHU", "DOUYIN"].includes(p))))
: [];

const request = await prisma.$transaction(async (tx) => {
const created = await tx.cooperationRequest.create({
data: {
title: body.title.trim(),
reqType: body.reqType?.trim() || "通用合作",
influencerType,
platforms,
description: body.description.trim(),
attachments: body.attachments?? null,
status: "PENDING",
submitterId: auth.userId,
},
});
await tx.requestApprover.createMany({
data: approverIds.map((approverId) => ({
requestType: "COOP_REQUEST" as const,
requestId: created.id,
approverId,
})),
});
await writeLog(tx, {
docType: "COOP_REQUEST",
docId: created.id,
action: "SUBMIT",
actorId: auth.userId,
fromStatus: null,
toStatus: "PENDING",
note: `提交合作需求，审批人 ${approverIds.length} 位`,
});
return created;
});

await notifyApprovers(
approverIds,
`${auth.userName}提交了合作需求「${request.title}」，请审批。`,
{ type: "COOP_REQUEST", id: request.id, title: "合作需求待审批", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(request, { status: 201});
}
