import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";
import { influencerOwnerFilter, parseInfluencerAttachments } from "@/lib/influencer-access";

// 列表：支持搜索 / 平台 / 状态 / 标签筛选；PR 角色只能看自己登记的
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
...influencerOwnerFilter(auth.role, auth.userId),
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
return NextResponse.json(list);
}

// 提报登记：PR / 管理员 / PR负责人。普通提交由 PR负责人或签审批；direct 用于免审入库。
// 创建后状态为待审核，并飞书通知审批人们。
export async function POST(req: NextRequest) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const body = await req.json();
if (!body.name?.trim()) {
return NextResponse.json({ error: "达人姓名不能为空"}, { status: 400});
}
const platforms: string[] = Array.isArray(body.platforms)? body.platforms: [];
const attachmentResult = parseInfluencerAttachments(body.attachments);
if (!attachmentResult.ok) {
return NextResponse.json({ error: attachmentResult.error}, { status: 400});
}
const direct = body.direct === true;
const influencerType = ["KOL", "KOC", "AMATEUR", "MAKEUP_ARTIST"].includes(body.influencerType)
? body.influencerType
: null;
const attachments = attachmentResult.attachments;
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
if (!direct && approverIds.length === 0) {
return NextResponse.json({ error: "请选择至少一位审批人"}, { status: 400});
}
// 初始审批人只能选 PR负责人；管理员在审批接口保留兜底权限。
const approvers = direct ? [] : await prisma.user.findMany({
where: { id: { in: approverIds}, role: "PR_MANAGER"},
select: { id: true},
});
if (!direct && approvers.length!== approverIds.length) {
return NextResponse.json({ error: "审批人必须为PR负责人"}, { status: 400});
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
status: direct ? "APPROVED" : "PENDING",
registeredById: auth.userId,
},
});
if (!direct) await tx.requestApprover.createMany({
data: approverIds.map((approverId) => ({
requestType: "INFLUENCER" as const,
requestId: created.id,
approverId,
})),
});
await writeLog(tx, {
docType: "INFLUENCER",
docId: created.id,
action: direct ? "CREATE" : "SUBMIT",
actorId: auth.userId,
fromStatus: null,
toStatus: direct ? "APPROVED" : "PENDING",
note: direct ? "免审直接加入达人库" : `提报达人登记，审批人 ${approverIds.length} 位`,
});
return created;
});

if (!direct) await notifyApprovers(
approverIds,
`${auth.userName}提报了达人「${influencer.name}」，请审批。`,
{ type: "INFLUENCER", id: influencer.id, title: "达人登记待审批", kind: "APPROVAL_PENDING"}
);

return NextResponse.json(influencer, { status: 201});
}
