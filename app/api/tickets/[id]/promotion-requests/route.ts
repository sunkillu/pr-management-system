import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const PLATFORMS = ["XIAOHONGSHU_DOUPLUS", "DOUYIN_QIANCHUAN", "OTHER"] as const;

// 投放需求：已发布工单可发起，按平台分类填预算与计划
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const list = await prisma.promotionRequest.findMany({
    where: { ticketId: params.id },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["PUBLISHED", "MATERIAL_REVIEW", "COMPLETED", "SETTLING", "FOLLOW_UP", "SETTLED"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅已发布的工单可发起投放需求" }, { status: 400 });
  }
  const body = await req.json();
  if (!PLATFORMS.includes(body.platform)) {
    return NextResponse.json({ error: "请选择投放平台" }, { status: 400 });
  }
  const budget = Number(body.budget);
  if (!(budget > 0)) return NextResponse.json({ error: "请填写投放预算" }, { status: 400 });
  const plan = String(body.plan ?? "").trim();
  if (!plan) return NextResponse.json({ error: "请填写投放计划" }, { status: 400 });

  const created = await prisma.promotionRequest.create({
    data: {
      ticketId: params.id,
      platform: body.platform,
      budget,
      plan,
      createdById: auth.userId,
    },
  });
  return NextResponse.json(created);
}
