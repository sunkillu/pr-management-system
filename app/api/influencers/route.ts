import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";
import { filterInfluencer } from "@/lib/sensitive";

// 列表：支持搜索 / 平台 / 状态 / 标签筛选；PR 角色只能看自己登记的
// A级字段（phone/wechat/email）按 viewer 权限过滤后再返回
export async function GET(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const { searchParams} = new URL(req.url);
const q = searchParams.get("q")?? "";
const platform = searchParams.get("platform");
const status = searchParams.get("status");
const type = searchParams.get("type");
const coop = searchParams.get("coop");
const tag = searchParams.get("tag");

const list = await prisma.influencer.findMany({
where: {
// PR 只能看到自己登记的达人；ADMIN / FINANCE / PR_MANAGER 可看全部
...(auth.role === "PR"? { registeredById: auth.userId}: {}),
...(q? { name: { contains: q, mode: "insensitive" as const}}: {}),
...(platform? { platforms: { has: platform}}: {}),
...(status? { status: status as never}: {}),
...(type? { influencerType: type as never}: {}),
...(tag? { tags: { has: tag}}: {}),
...(coop === "none"? { coopCount: 0}: {}),
...(coop === "active"? { coopCount: { gt: 0}}: {}),
},
include: { registeredBy: { select: { name: true}}},
orderBy: { updatedAt: "desc"},
});
const viewer = { role: auth.role, id: auth.userId };
return NextResponse.json(list.map((i) => filterInfluencer(i, viewer)));
}

// 提报登记：运营 / 管理员 / PR负责人。提交时多选审批人（PR负责人或管理员），或签。
// 创建后状态为待审核，并飞书通知审批人们。
export async function POST(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
if (!body.name?.trim()) {
return NextResponse.json({ error: "达人姓名不能为空"}, { status: 400});
}
const platforms: string[] = Array.isArray(body.platforms)? body.platforms: [];
const influencerType = ["KOL", "KOC", "AMATEUR", "MAKEUP_ARTIST"].includes(body.influencerType)
? body.influencerType
: null;
// 附件：[{fileUrl, fileName}]，简单校验结构
const attachments = Array.isArray(body.attachments)
? body.attachments.filter((a: unknown) => a && typeof (a as { fileUrl?: unknown }).fileUrl === "string").slice(0, 20)
: undefined;
// 标签：字符串数组
const tags: string[] = [];
if (Array.isArray(body.tags)) {
  for (const t of body.tags) {
    const s = String(t ?? "").trim();
    if (s && !tags.includes(s)) tags.push(s);
    if (tags.length >= 20) break;
  }
}
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
influencerType,
platforms,
contactInfo: body.contactInfo || null,
homepageId: String(body.homepageId ?? "").trim() || null,
bio: body.bio || null,
attachments: attachments ?? undefined,
tags,
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
{ type: "INFLUENCER", id: influencer.id, title: "达人登记待审批", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(influencer, { status: 201});
}
