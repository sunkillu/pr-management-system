import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ALL_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;
const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;

// 详情：基本信息 + 节点 + 评论 + 评价 + 关联打款单
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: {
      influencer: { select: { id: true, name: true } },
      makeupArtist: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      nodes: {
        orderBy: { sort: "asc" },
        include: { completedBy: { select: { name: true } } },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
      reviews: { include: { reviewer: { select: { name: true } } } },
      paymentRequests: {
        select: { id: true, title: true, amount: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });

  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "TICKET", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ...ticket, approvers });
}

// 编辑：仅草稿/已驳回可编辑（创建人或管理员）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["DRAFT", "REJECTED"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅草稿或已驳回的工单可编辑" }, { status: 400 });
  }
  // 采买转入的合作工单：接单人（assignee）可补充合作信息
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId && ticket.assigneeId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人、接单人或管理员可编辑" }, { status: 403 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title?.trim()) data.title = body.title.trim();
  if (body.budgetFee && Number(body.budgetFee) > 0) data.budgetFee = body.budgetFee;
  if (body.actualFee !== undefined) data.actualFee = body.actualFee || null;
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.note !== undefined) data.note = body.note?.trim() || null;
  if (body.platform !== undefined) {
    const ps = Array.isArray(body.platform) ? body.platform.map((s: unknown) => String(s)).filter((s: string) => ["XIAOHONGSHU", "DOUYIN"].includes(s)) : [];
    if (ps.length > 0) data.platform = ps;
  }
  if (body.homepageId !== undefined) data.homepageId = String(body.homepageId ?? "").trim() || null;
  if (body.style !== undefined) data.style = Array.isArray(body.style) ? body.style.map((s: unknown) => String(s)).filter(Boolean) : [];
  if (body.contentDirection !== undefined) data.contentDirection = String(body.contentDirection ?? "").trim() || null;
  if (body.coopCategory !== undefined) data.coopCategory = Array.isArray(body.coopCategory) ? body.coopCategory.map((s: unknown) => String(s)).filter(Boolean) : [];
  if (body.estimatedSchedule !== undefined && String(body.estimatedSchedule ?? "").trim()) data.estimatedSchedule = String(body.estimatedSchedule).trim();
  // v2: 预估发布年月 / 预估报价 / 确定档期（编辑时可改；确定档期变更走 /schedule 接口写审计）
  if (body.estimatedPublishMonth !== undefined) {
    const m = String(body.estimatedPublishMonth ?? "").trim();
    if (m && !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return NextResponse.json({ error: "预估发布年月格式非法" }, { status: 400 });
    data.estimatedPublishMonth = m || null;
  }
  if (body.quoteAmount !== undefined) {
    const qn = Number(body.quoteAmount);
    data.quoteAmount = body.quoteAmount == null || body.quoteAmount === "" ? null : qn;
  }
  if (body.confirmedDate !== undefined) {
    const cds = String(body.confirmedDate ?? "").trim();
    if (cds && !/^\d{4}-\d{2}-\d{2}$/.test(cds)) return NextResponse.json({ error: "确定档期格式非法" }, { status: 400 });
    data.confirmedDate = cds ? new Date(`${cds}T00:00:00`) : null;
  }
  if (body.priceNote !== undefined) data.priceNote = String(body.priceNote ?? "").trim() || null;
  if (body.contentNote !== undefined) data.contentNote = String(body.contentNote ?? "").trim() || null;
  if (body.influencerId !== undefined) data.influencerId = body.influencerId || null;
  if (body.makeupArtistId !== undefined) data.makeupArtistId = body.makeupArtistId || null;

  const updated = await prisma.cooperationTicket.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}
