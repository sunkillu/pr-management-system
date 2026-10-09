import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ALL_ROLES = ["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;
const WRITE_ROLES = ["ADMIN", "OPERATOR", "PR_MANAGER"] as const;

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
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人或管理员可编辑" }, { status: 403 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title?.trim()) data.title = body.title.trim();
  if (body.budgetFee && Number(body.budgetFee) > 0) data.budgetFee = body.budgetFee;
  if (body.actualFee !== undefined) data.actualFee = body.actualFee || null;
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.note !== undefined) data.note = body.note?.trim() || null;
  if (body.influencerId !== undefined) data.influencerId = body.influencerId || null;
  if (body.makeupArtistId !== undefined) data.makeupArtistId = body.makeupArtistId || null;

  const updated = await prisma.cooperationTicket.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}
