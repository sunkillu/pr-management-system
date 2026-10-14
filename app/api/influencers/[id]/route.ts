import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { filterInfluencer } from "@/lib/sensitive";

// 详情：所有登录用户可查
// A级字段（phone/wechat/email）按 viewer 权限过滤；工单 assignee 同样可看
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const influencer = await prisma.influencer.findUnique({
    where: { id: params.id },
    include: {
      registeredBy: { select: { name: true } },
      cooperationRecords: { orderBy: { coopDate: "desc" }, take: 10 },
    },
  });
  if (!influencer) return NextResponse.json({ error: "达人不存在" }, { status: 404 });
  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "INFLUENCER", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const logs = await prisma.approvalLog.findMany({
    where: { docType: "INFLUENCER", docId: params.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const notifications = await prisma.notificationLog.findMany({
    where: { relatedType: "INFLUENCER", relatedId: params.id },
    include: { receiver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  // 工单 assignee（对应 PR）也可见 A级字段
  const assigned = await prisma.cooperationTicket.findMany({
    where: { influencerId: params.id, assigneeId: { not: null } },
    select: { assigneeId: true },
  });
  const filtered = filterInfluencer(
    {
      ...influencer,
      assigneeIds: assigned.map((t) => t.assigneeId).filter(Boolean) as string[],
    },
    { role: auth.role, id: auth.userId }
  );
  return NextResponse.json({ influencer: filtered, approvers, logs, notifications });
}

// 编辑：仅待审核/已驳回状态可编辑，运营 / 管理员 / PR负责人（或登记人）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.influencer.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "达人不存在" }, { status: 404 });
  if (!["PENDING", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "仅待审核 / 已驳回的登记可编辑" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "达人姓名不能为空" }, { status: 400 });
  }
  const updated = await prisma.influencer.update({
    where: { id: params.id },
    data: {
      name: body.name.trim(),
      platforms: Array.isArray(body.platforms) ? body.platforms : [],
      contactInfo: body.contactInfo || null,
      homepageId: String(body.homepageId ?? "").trim() || null,
      douyinUrl: String(body.douyinUrl ?? "").trim() || null,
      bio: body.bio || null,
    },
  });
  return NextResponse.json(updated);
}
