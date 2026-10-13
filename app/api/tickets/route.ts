import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers, notifyUser} from "@/lib/feishu-notify";
import { buildNodesForTicket} from "@/lib/ticket-nodes";
import { checkApprovalTimeouts} from "@/lib/timeout-check";

const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;
// 采买工单：运营可提交
const PROCUREMENT_WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER", "OPERATOR"] as const;
const ALL_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;

function pickPartner(body: Record<string, unknown>) {
const influencerId = (body.influencerId as string) || null;
const makeupArtistId = (body.makeupArtistId as string) || null;
return { influencerId, makeupArtistId};
}

// 列表：所有登录用户可查；附带触发一次超时检查（fire-and-forget）
export async function GET(req: NextRequest) {
const auth = await requireRoles([...ALL_ROLES]);
if (!auth.ok) return auth.res;
checkApprovalTimeouts().catch(() => {});
const { searchParams} = new URL(req.url);
const status = searchParams.get("status");
const type = searchParams.get("type");
const q = searchParams.get("q");
const list = await prisma.cooperationTicket.findMany({
where: {
...(status? { status: status as never}: {}),
...(type? { type: type as never}: {}),
...(q? { OR: [{ title: { contains: q, mode: "insensitive"}}, { ticketNo: { contains: q, mode: "insensitive"}}]}: {}),
},
include: {
influencer: { select: { name: true}},
makeupArtist: { select: { name: true}},
creator: { select: { name: true}},
},
orderBy: { updatedAt: "desc"},
});
return NextResponse.json(list);
}

// 新建工单：submit=true 直接提交审批（生成节点模板 + 审批人 + 通知），否则存草稿
// ticketKind=PROCUREMENT 时为采买工单：运营可提交，流程简化为待采买审批

// 采买工单创建：字段为合作工单子集（title/platform/style/budgetFee/note/contentDirection），
// 采买特有信息（数量/需求理由/发布链接）写入 note 结构化文本，素材类型写入 contentDirection。
// 提交后进 PENDING_PROCUREMENT（不生成进度节点）；审批通过 + PR接单后同单转为 COOPERATION 走合作流程。
async function createProcurementTicket(
  req: NextRequest,
  body: Record<string, unknown>,
  auth: { ok: true; userId: string; userName: string; role: string },
) {
  const procurementType = body.procurementType as string;
  if (!["WEEKLY_STYLE", "LINK_SPECIFIC"].includes(procurementType)) {
    return NextResponse.json({ error: "采买子类型非法" }, { status: 400 });
  }
  const budgetFee = Number(body.budgetFee);
  if (!budgetFee || budgetFee <= 0) {
    return NextResponse.json({ error: "预算费用必须大于 0" }, { status: 400 });
  }
  const platform: string[] = Array.isArray(body.platform)
    ? (body.platform as unknown[]).map(String).filter(Boolean)
    : [];
  if (platform.length === 0) {
    return NextResponse.json({ error: "请选择合作平台（可多选）" }, { status: 400 });
  }

  const styles: string[] = Array.isArray(body.style)
    ? (body.style as unknown[]).map(String).filter(Boolean)
    : [];
  let contentDirection: string | null = null;
  const noteLines: string[] = ["【采买信息】"];

  if (procurementType === "WEEKLY_STYLE") {
    if (styles.length === 0) return NextResponse.json({ error: "请选择款式（可多选）" }, { status: 400 });
    const quantity = Number(body.quantity);
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "采买数量必须为正整数" }, { status: 400 });
    }
    noteLines.push(`采买数量：${quantity}`);
  } else {
    const materialType = String(body.materialType ?? "").trim();
    if (!materialType) return NextResponse.json({ error: "请填写素材类型" }, { status: 400 });
    contentDirection = materialType;
    const reason = String(body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "请填写需求理由" }, { status: 400 });
    noteLines.push(`需求理由：${reason}`);
    const publishLinks: string[] = Array.isArray(body.publishLinks)
      ? (body.publishLinks as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 50)
      : [];
    if (publishLinks.length === 0) return NextResponse.json({ error: "请至少填写一条发布链接" }, { status: 400 });
    noteLines.push(`发布链接：\n${publishLinks.map((l, i) => `${i + 1}. ${l}`).join("\n")}`);
  }
  const userNote = String(body.note ?? "").trim();
  if (userNote) noteLines.push(`备注：${userNote}`);
  const note = noteLines.join("\n");

  const submit = body.submit === true;
  const approverIds: string[] = Array.isArray(body.approverIds) ? body.approverIds as string[] : [];
  if (submit) {
    if (approverIds.length === 0) {
      return NextResponse.json({ error: "提交审批必须选择至少一位审批人" }, { status: 400 });
    }
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds }, role: { in: ["ADMIN", "PR_MANAGER"] } },
      select: { id: true },
    });
    if (approvers.length !== approverIds.length) {
      return NextResponse.json({ error: "审批人必须为 PR负责人 或 管理员" }, { status: 400 });
    }
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayCount = await tx.cooperationTicket.count({ where: { createdAt: { gte: dayStart } } });
    const ticketNo = `${ymd}${String(todayCount + 1).padStart(4, "0")}`;
    const created = await tx.cooperationTicket.create({
      data: {
        ticketNo,
        title: (body.title as string).trim(),
        type: "INFLUENCER_POST",
        ticketKind: "PROCUREMENT",
        procurementType: procurementType as "WEEKLY_STYLE" | "LINK_SPECIFIC",
        style: styles,
        contentDirection,
        budgetFee,
        platform,
        coopCategory: [],
        estimatedSchedule: "-",
        note,
        status: submit ? "PENDING_PROCUREMENT" : "DRAFT",
        creatorId: auth.userId,
      },
    });
    if (submit) {
      await tx.requestApprover.createMany({
        data: approverIds.map((approverId: string) => ({
          requestType: "TICKET" as const,
          requestId: created.id,
          approverId,
        })),
      });
      await writeLog(tx, {
        docType: "TICKET",
        docId: created.id,
        action: "SUBMIT",
        actorId: auth.userId,
        fromStatus: "DRAFT",
        toStatus: "PENDING_PROCUREMENT",
      });
    }
    return created;
  });

  if (submit) {
    await notifyApprovers(
      approverIds,
      `${auth.userName}发起了采买工单「${ticket.title}」，请审批。`,
      { type: "TICKET", id: ticket.id, title: "采买工单待审批", kind: "APPROVAL_PENDING" },
    );
  }

  // 工单标签
  const tagIds: string[] = Array.isArray(body.tagIds)
    ? Array.from(new Set<string>((body.tagIds as unknown[]).map((s) => String(s)).filter(Boolean))).slice(0, 20)
    : [];
  if (tagIds.length > 0) {
    const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } });
    const validIds = tags.map((t) => t.id);
    if (validIds.length > 0) {
      await prisma.tagging.createMany({
        data: validIds.map((tagId) => ({
          tagId,
          entityType: "TICKET" as const,
          entityId: ticket.id,
          createdById: auth.userId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(ticket, { status: 201 });
}
export async function POST(req: NextRequest) {
const body = await req.json();
const ticketKind = (body.ticketKind as string) === "PROCUREMENT" ? "PROCUREMENT" : "COOPERATION";
const auth = await requireRoles(ticketKind === "PROCUREMENT" ? [...PROCUREMENT_WRITE_ROLES] : [...WRITE_ROLES]);
if (!auth.ok) return auth.res;
if (!body.title?.trim()) return NextResponse.json({ error: "标题不能为空"}, { status: 400});

// ---------- 采买工单分支 ----------
if (ticketKind === "PROCUREMENT") {
return createProcurementTicket(req, body, auth);
}

// ---------- 合作工单（原有逻辑） ----------
const type = body.type as "INFLUENCER_POST" | "INFLUENCER_LIVE" | "MAKEUP" | undefined;
if (!type || !["INFLUENCER_POST", "INFLUENCER_LIVE", "MAKEUP"].includes(type)) {
return NextResponse.json({ error: "合作类型非法"}, { status: 400});
}
const budgetFee = Number(body.budgetFee);
if (!budgetFee || budgetFee <= 0) {
return NextResponse.json({ error: "预算费用必须大于 0"}, { status: 400});
}
// 合作平台多选必填
const platforms: string[] = Array.isArray(body.platform) ? body.platform.map((s: unknown) => String(s)).filter((s: string) => ["XIAOHONGSHU", "DOUYIN"].includes(s)) : [];
if (platforms.length === 0) {
return NextResponse.json({ error: "请选择合作平台（可多选）"}, { status: 400});
}
// 款式多选必填
const styles: string[] = Array.isArray(body.style) ? body.style.map((s: unknown) => String(s)).filter(Boolean) : [];
if (styles.length === 0) {
return NextResponse.json({ error: "请选择款式（可多选）" }, { status: 400});
}
// 合作类目多选必填
const coopCategories: string[] = Array.isArray(body.coopCategory) ? body.coopCategory.map((s: unknown) => String(s)).filter(Boolean) : [];
if (coopCategories.length === 0) {
return NextResponse.json({ error: "请选择合作类目（可多选）" }, { status: 400});
}
// 预估档期必填
const estimatedSchedule = String(body.estimatedSchedule ?? "").trim();
if (!estimatedSchedule) {
return NextResponse.json({ error: "请填写预估档期" }, { status: 400});
}
const { influencerId, makeupArtistId} = pickPartner(body);
if (type === "MAKEUP" &&!makeupArtistId) {
return NextResponse.json({ error: "化妆师合作必须选择化妆师"}, { status: 400});
}
if (type!== "MAKEUP" &&!influencerId) {
return NextResponse.json({ error: "达人合作必须选择达人"}, { status: 400});
}
// 达人合作要求达人已通过审核
if (influencerId) {
const inf = await prisma.influencer.findUnique({ where: { id: influencerId}});
if (!inf) return NextResponse.json({ error: "达人不存在"}, { status: 404});
if (inf.status!== "APPROVED") {
return NextResponse.json({ error: "该达人尚未通过审核，不能发起合作"}, { status: 400});
}
// 数据权限：PR 只能用自己登记的达人发起工单
if (auth.role === "PR" && inf.registeredById !== auth.userId) {
return NextResponse.json({ error: "只能选择自己登记的达人发起合作"}, { status: 403});
}
}
// 来源合作需求：如传入则校验存在
const coopRequestId = (typeof body.coopRequestId === "string" && body.coopRequestId.trim()) ? body.coopRequestId.trim() : null;
if (coopRequestId) {
const cr = await prisma.cooperationRequest.findUnique({ where: { id: coopRequestId }, select: { id: true } });
if (!cr) return NextResponse.json({ error: "来源合作需求不存在" }, { status: 400 });
}
// 达人主页ID：未手动填写时从达人库自动带入
let homepageId = String(body.homepageId ?? "").trim() || null;
if (!homepageId && influencerId) {
const inf = await prisma.influencer.findUnique({ where: { id: influencerId }, select: { homepageId: true } });
if (inf?.homepageId) homepageId = inf.homepageId;
}

const submit = body.submit === true;
const approverIds: string[] = Array.isArray(body.approverIds)? body.approverIds: [];
if (submit) {
if (approverIds.length === 0) {
return NextResponse.json({ error: "提交审批必须选择至少一位审批人"}, { status: 400});
}
const approvers = await prisma.user.findMany({
where: { id: { in: approverIds}, role: { in: ["ADMIN", "PR_MANAGER"]}},
select: { id: true},
});
if (approvers.length!== approverIds.length) {
return NextResponse.json({ error: "审批人必须为 PR负责人 或 管理员"}, { status: 400});
}
}

const baseDate = body.startDate? new Date(body.startDate): new Date();
const nodes = buildNodesForTicket(type, baseDate);
// 附件/插图：[{fileUrl, fileName}]，简单校验结构
const attachments = Array.isArray(body.attachments)
  ? body.attachments.filter((a: unknown) => a && typeof (a as { fileUrl?: unknown }).fileUrl === "string").slice(0, 20)
  : undefined;
// 寄品明细：[{style, degree?, note?}]，款式名必填
const shipItems = Array.isArray(body.shipItems)
  ? body.shipItems
      .map((s: unknown) => ({
        style: String((s as { style?: unknown }).style ?? "").trim(),
        degree: String((s as { degree?: unknown }).degree ?? "").trim(),
        note: String((s as { note?: unknown }).note ?? "").trim(),
      }))
      .filter((s: { style: string }) => s.style)
      .slice(0, 50)
  : undefined;

const ticket = await prisma.$transaction(async (tx) => {
// 生成工单编号 YYYYMMDD + 4位序号（如 202610100001）
const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const todayCount = await tx.cooperationTicket.count({ where: { createdAt: { gte: dayStart } } });
const ticketNo = `${ymd}${String(todayCount + 1).padStart(4, "0")}`;
const created = await tx.cooperationTicket.create({
data: {
ticketNo,
title: body.title.trim(),
type,
budgetFee: body.budgetFee,
actualFee: body.actualFee? body.actualFee: null,
platform: platforms,
homepageId,
style: styles,
contentDirection: String(body.contentDirection ?? "").trim() || null,
coopCategory: coopCategories,
priceNote: String(body.priceNote ?? "").trim() || null,
contentNote: String(body.contentNote ?? "").trim() || null,
estimatedSchedule,
startDate: body.startDate? new Date(body.startDate): null,
endDate: body.endDate? new Date(body.endDate): null,
note: body.note?.trim() || null,
status: submit? "PENDING_APPROVAL": "DRAFT",
influencerId,
makeupArtistId,
// 来源合作需求（从需求详情页"发起工单"跳转时带入，已在上方校验）
coopRequestId,
creatorId: auth.userId,
attachments: attachments ?? undefined,
shipItems: shipItems && shipItems.length > 0 ? shipItems : undefined,
nodes: { create: nodes},
},
});
if (submit) {
await tx.requestApprover.createMany({
data: approverIds.map((approverId: string) => ({
requestType: "TICKET" as const,
requestId: created.id,
approverId,
})),
});
await writeLog(tx, {
docType: "TICKET",
docId: created.id,
action: "SUBMIT",
actorId: auth.userId,
fromStatus: "DRAFT",
toStatus: "PENDING_APPROVAL",
});
}
return created;
});

if (submit) {
await notifyApprovers(
approverIds,
`${auth.userName}发起了合作工单「${ticket.title}」，请审批。`,
{ type: "TICKET", id: ticket.id, title: "合作工单待审批", kind: "APPROVAL_PENDING"}
);
// 工单有寄品明细时，提醒提交人：审批通过后可发起寄件请求
if (shipItems && shipItems.length > 0) {
await notifyUser(
auth.userId,
`工单「${ticket.title}」已提交审核，审批通过后可发起寄件请求。`,
{ type: "TICKET", id: ticket.id, title: "工单已提审", kind: "SYSTEM"}
);
}
}

// 工单标签：tagIds 可选，创建 Tagging 记录（打标签人=创建人）
const tagIds: string[] = Array.isArray(body.tagIds)
  ? Array.from(new Set<string>(body.tagIds.map((s: unknown) => String(s)).filter(Boolean))).slice(0, 20)
  : [];
if (tagIds.length > 0) {
  const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } });
  const validIds = tags.map((t) => t.id);
  if (validIds.length > 0) {
    await prisma.tagging.createMany({
      data: validIds.map((tagId) => ({
        tagId,
        entityType: "TICKET" as const,
        entityId: ticket.id,
        createdById: auth.userId,
      })),
      skipDuplicates: true,
    });
  }
}

return NextResponse.json(ticket, { status: 201});
}
