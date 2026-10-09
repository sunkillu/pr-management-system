import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 列表：所有登录用户可查，支持搜索 / 平台 / 状态筛选
export async function GET(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const { searchParams} = new URL(req.url);
const q = searchParams.get("q")?? "";
const platform = searchParams.get("platform");
const status = searchParams.get("status");

const list = await prisma.influencer.findMany({
where: {
...(q? { name: { contains: q, mode: "insensitive" as const}}: {}),
...(platform? { platforms: { has: platform}}: {}),
...(status? { status: status as never}: {}),
},
include: { registeredBy: { select: { name: true}}},
orderBy: { updatedAt: "desc"},
});
return NextResponse.json(list);
}

// 提报登记：运营 / 管理员 / PR负责人。提交时多选审批人（PR负责人或管理员），或签。
// 创建后状态为待审核，并飞书通知审批人们。
export async function POST(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
if (!body.name?.trim()) {
return NextResponse.json({ error: "达人姓名不能为空"}, { status: 400});
}
const platforms: string[] = Array.isArray(body.platforms)? body.platforms: [];
const approverIds: string[] = Array.isArray(body.approverIds)
? Array.from(new Set(body.approverIds as string[]))
: [];
if (approverIds.length === 0) {
return NextResponse.json({ error: "请选择至少一位审批人"}, { status: 400});
}
// 审批人必须是 PR负责人 或 管理员
const approvers = await prisma.user.findMany({
where: { id: { in: approverIds}, role: { in: ["PR_MANAGER", "ADMIN"]}},
select: { id: true},
});
if (approvers.length!== approverIds.length) {
return NextResponse.json({ error: "审批人必须为PR负责人或管理员"}, { status: 400});
}

const influencer = await prisma.$transaction(async (tx) => {
const created = await tx.influencer.create({
data: {
name: body.name.trim(),
platforms,
contactInfo: body.contactInfo || null,
bio: body.bio || null,
status: "PENDING",
registeredById: auth.userId,
},
});
await tx.requestApprover.createMany({
data: approverIds.map((approverId) => ({
requestType: "INFLUENCER" as const,
requestId: created.id,
approverId,
})),
});
await writeLog(tx, {
docType: "INFLUENCER",
docId: created.id,
action: "SUBMIT",
actorId: auth.userId,
fromStatus: null,
toStatus: "PENDING",
note: `提报达人登记，审批人 ${approverIds.length} 位`,
});
return created;
});

await notifyApprovers(
approverIds,
`${auth.userName}提报了达人「${influencer.name}」，请审批。`,
{ type: "INFLUENCER", id: influencer.id, title: influencer.name}
);

return NextResponse.json(influencer, { status: 201});
}
