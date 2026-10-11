import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 标记评论已处理（回复/跟进完成）；ADMIN / PR / PR_MANAGER
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; contentId: string; commentId: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.contentComment.findFirst({
    where: { id: params.commentId, contentId: params.contentId },
    include: { content: { select: { ticketId: true, status: true } } },
  });
  if (!existing) return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  if (existing.content.ticketId !== params.id) {
    return NextResponse.json({ error: "内容不属于该工单" }, { status: 400 });
  }
  const body = await req.json();
  const handled = body.handled !== false;
  const updated = await prisma.contentComment.update({
    where: { id: params.commentId },
    data: {
      handled,
      handledById: handled ? auth.userId : null,
      handledAt: handled ? new Date() : null,
    },
    include: { handledBy: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  return NextResponse.json(updated);
}

// 删除评论
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; contentId: string; commentId: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.contentComment.findFirst({
    where: { id: params.commentId, contentId: params.contentId },
  });
  if (!existing) return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  await prisma.contentComment.delete({ where: { id: params.commentId } });
  return NextResponse.json({ ok: true });
}
