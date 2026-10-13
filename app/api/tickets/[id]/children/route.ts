// 子工单 CRUD（v2 父子工单模型）
// GET：列出指定父工单的子工单；POST：创建子工单（parentId 固定为 URL 中的 id，标题按规范自动生成）
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoles, RoleName } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";
import { buildChildTitle, ChildTicketSubType, CHILD_SUB_TYPES } from "@/lib/ticket-title";

const READ_ROLES: RoleName[] = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"];
const WRITE_ROLES: RoleName[] = ["ADMIN", "PR", "PR_MANAGER"];

const VALID_PLATFORMS = ["XIAOHONGSHU", "DOUYIN"] as const;

// Date → YYYY-MM-DD（用于标题中的档期/发布日期）
function toDateStr(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 工单编号：YYYYMMDD + 4 位序号
async function nextTicketNo(tx: Prisma.TransactionClient) {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayCount = await tx.cooperationTicket.count({ where: { createdAt: { gte: dayStart } } });
  return `${ymd}${String(todayCount + 1).padStart(4, "0")}`;
}

// 子工单列表：所有登录用户可查
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(READ_ROLES);
  if (!auth.ok) return auth.res;

  const parent = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, parentId: true },
  });
  if (!parent) return NextResponse.json({ error: "工单不存在" }, { status: 404 });

  const list = await prisma.cooperationTicket.findMany({
    where: { parentId: params.id },
    include: {
      influencer: { select: { name: true } },
      assignee: { select: { id: true, name: true } },
      creator: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(list);
}

// 创建子工单：必须关联 parentId（URL）、influencerId、assigneeId、platform；标题自动按规范生成
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(WRITE_ROLES);
  if (!auth.ok) return auth.res;

  const body = await req.json();

  const subType = body.subType as string;
  if (!CHILD_SUB_TYPES.includes(subType as ChildTicketSubType)) {
    return NextResponse.json({ error: "子工单类型非法（SAMPLE / REVIEW / PUBLISH / DATA）" }, { status: 400 });
  }

  // 父工单校验：必须存在，且本身是父工单（不支持多级嵌套）
  const parent = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: { influencer: { select: { id: true, name: true } } },
  });
  if (!parent) return NextResponse.json({ error: "父工单不存在" }, { status: 404 });
  if (parent.parentId) {
    return NextResponse.json({ error: "只能在父工单下创建子工单（不支持多级嵌套）" }, { status: 400 });
  }

  // 必填：influencerId（须已通过审核）
  const influencerId = String(body.influencerId ?? "").trim();
  if (!influencerId) return NextResponse.json({ error: "请选择达人" }, { status: 400 });
  const influencer = await prisma.influencer.findUnique({ where: { id: influencerId } });
  if (!influencer) return NextResponse.json({ error: "达人不存在" }, { status: 404 });
  if (influencer.status !== "APPROVED") {
    return NextResponse.json({ error: "该达人尚未通过审核，不能创建子工单" }, { status: 400 });
  }
  // 数据权限：PR 只能用自己登记的达人
  if (auth.role === "PR" && influencer.registeredById !== auth.userId) {
    return NextResponse.json({ error: "只能选择自己登记的达人" }, { status: 403 });
  }

  // 必填：assigneeId（归属人须存在）
  const assigneeId = String(body.assigneeId ?? "").trim();
  if (!assigneeId) return NextResponse.json({ error: "请选择子工单归属人" }, { status: 400 });
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true } });
  if (!assignee) return NextResponse.json({ error: "归属人不存在" }, { status: 400 });

  // 必填：platform（多选）
  const platforms: string[] = Array.isArray(body.platform)
    ? (body.platform as unknown[]).map(String).filter((s) => (VALID_PLATFORMS as readonly string[]).includes(s))
    : [];
  if (platforms.length === 0) {
    return NextResponse.json({ error: "请选择合作平台（可多选）" }, { status: 400 });
  }

  // 可选覆盖：款式 / 确认档期 / 发布日期（未填则继承父工单）
  const styles: string[] = Array.isArray(body.style)
    ? (body.style as unknown[]).map(String).filter(Boolean)
    : parent.style;
  const confirmedDateStr =
    toDateStr(body.confirmedDate) ?? toDateStr(parent.confirmedDate) ?? null;
  const publishDateStr =
    toDateStr(body.publishDate) ?? toDateStr(parent.publishDate) ?? null;

  // 标题按规范自动生成
  const title = buildChildTitle(subType as ChildTicketSubType, {
    influencerName: influencer.name,
    styles,
    platforms,
    confirmedDate: confirmedDateStr,
    publishDate: publishDateStr,
  });

  const note = String(body.note ?? "").trim() || null;

  const child = await prisma.$transaction(async (tx) => {
    const ticketNo = await nextTicketNo(tx);
    const created = await tx.cooperationTicket.create({
      data: {
        ticketNo,
        title,
        type: parent.type,
        ticketKind: parent.ticketKind,
        parentId: parent.id,
        subType: subType as ChildTicketSubType,
        influencerId,
        makeupArtistId: null,
        assigneeId,
        platform: platforms,
        style: styles,
        coopCategory: parent.coopCategory,
        budgetFee: parent.budgetFee, // 子工单无独立预算，继承父工单
        homepageId: parent.homepageId,
        estimatedSchedule: parent.estimatedSchedule,
        estimatedPublishMonth: parent.estimatedPublishMonth,
        confirmedDate: confirmedDateStr ? new Date(confirmedDateStr) : parent.confirmedDate,
        publishDate: publishDateStr ? new Date(publishDateStr) : parent.publishDate,
        note,
        status: "DRAFT",
        creatorId: auth.userId,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: created.id,
      action: "CREATE",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: "DRAFT",
      note: `创建子工单（${subType}），父工单 ${parent.ticketNo}`,
    });
    return created;
  });

  // 通知归属人
  await notifyUser(
    assigneeId,
    `${auth.userName}将子工单「${title}」指派给了你，请跟进。`,
    { type: "TICKET", id: child.id, title: "子工单已指派", kind: "SYSTEM" },
  );

  return NextResponse.json(child, { status: 201 });
}
