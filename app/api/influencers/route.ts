import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";
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

// 提报登记：运营 / 管理员 / PR负责人。直接入库，无需审批。
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

const homepageId = String(body.homepageId ?? "").trim() || null;
const douyinUrl = String(body.douyinUrl ?? "").trim() || null;
// 品牌：多选品牌名称数组
const brands: string[] = Array.isArray(body.brands)
  ? Array.from(new Set((body.brands as unknown[]).map((b: unknown) => String(b ?? "").trim()).filter(Boolean))).slice(0, 10)
  : [];

const influencer = await prisma.$transaction(async (tx) => {
const created = await tx.influencer.create({
data: {
name: body.name.trim(),
influencerType,
platforms,
contactInfo: body.contactInfo || null,
homepageId,
douyinUrl,
bio: body.bio || null,
attachments: attachments ?? undefined,
tags,
brands,
status: "APPROVED",
registeredById: auth.userId,
},
});
await writeLog(tx, {
docType: "INFLUENCER",
docId: created.id,
action: "SUBMIT",
actorId: auth.userId,
fromStatus: null,
toStatus: "APPROVED",
note: `登记达人，直接入库`,
});

// 去重检查：按 homepageId 查找已存在的其他达人记录
if (homepageId) {
const existing = await tx.influencer.findFirst({
where: {
homepageId,
id: { not: created.id },
},
select: { id: true, name: true },
});
if (existing) {
// 标记待去重确认 + 写提交记录
await tx.influencer.update({
where: { id: created.id },
data: { dupStatus: "PENDING_DEDUP" },
});
await tx.influencerSubmitLog.create({
data: {
newInfluencerId: created.id,
existingInfluencerId: existing.id,
submittedById: auth.userId,
newData: {
name: created.name,
influencerType: created.influencerType,
platforms: created.platforms,
contactInfo: created.contactInfo,
homepageId: created.homepageId,
douyinUrl: created.douyinUrl,
bio: created.bio,
tags: created.tags,
brands: created.brands,
},
result: "PENDING",
},
});
await writeLog(tx, {
docType: "INFLUENCER",
docId: created.id,
action: "DUP_DETECTED",
actorId: auth.userId,
fromStatus: null,
toStatus: null,
note: `检测到重复达人（主页ID: ${homepageId}），已存在「${existing.name}」，进入去重确认`,
});
}
}
return created;
});

// 如进入去重流程，通知 PR负责人/管理员处理
if (influencer.dupStatus === "PENDING_DEDUP") {
const managers = await prisma.user.findMany({
where: { role: { in: ["PR_MANAGER", "ADMIN"] } },
select: { id: true },
});
for (const m of managers) {
await notifyUser(
m.id,
`达人「${influencer.name}」登记疑似重复（主页ID: ${influencer.homepageId}），请前往去重处理页确认。`,
{ type: "INFLUENCER", id: influencer.id, title: "达人去重待确认", kind: "SYSTEM" }
);
}
}

return NextResponse.json(influencer, { status: 201});
}
