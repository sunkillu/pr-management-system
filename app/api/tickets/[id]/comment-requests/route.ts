import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 评论需求：已发布工单可发起
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const list = await prisma.commentRequest.findMany({
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
    return NextResponse.json({ error: "仅已发布的工单可发起评论需求" }, { status: 400 });
  }
  const body = await req.json();
  const content = String(body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "请填写评论需求内容" }, { status: 400 });

  const created = await prisma.commentRequest.create({
    data: { ticketId: params.id, content, createdById: auth.userId },
  });
  return NextResponse.json(created);
}
