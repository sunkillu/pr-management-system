import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { canOperateTicket } from "@/lib/ticket-permission";

// 设置 / 清除节点的前置依赖：仅创建人 / 审批链成员 / ADMIN
// 校验：前置必须是同工单的其他节点；不能成环（不能选自己的后代）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; nodeId: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }
  const node = await prisma.ticketNode.findFirst({
    where: { id: params.nodeId, ticketId: params.id },
  });
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
  if (node.completedAt) return NextResponse.json({ error: "已完成的节点不可改前置" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const dependsOnId = body.dependsOnId ? String(body.dependsOnId) : null;

  if (dependsOnId) {
    if (dependsOnId === node.id) {
      return NextResponse.json({ error: "前置节点不能是自己" }, { status: 400 });
    }
    const dep = await prisma.ticketNode.findFirst({
      where: { id: dependsOnId, ticketId: params.id },
    });
    if (!dep) return NextResponse.json({ error: "前置节点不存在" }, { status: 404 });
    // 成环校验：沿依赖链向上走，不能回到自己
    let cur: string | null = dependsOnId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === node.id) {
        return NextResponse.json({ error: "不能形成依赖环" }, { status: 400 });
      }
      if (seen.has(cur)) break;
      seen.add(cur);
      const found: { dependsOnId: string | null } | null = await prisma.ticketNode.findUnique({
        where: { id: cur },
        select: { dependsOnId: true },
      });
      cur = found?.dependsOnId ?? null;
    }
  }

  const updated = await prisma.ticketNode.update({
    where: { id: node.id },
    data: { dependsOnId, unlockedNotifiedAt: null },
  });
  return NextResponse.json(updated);
}
