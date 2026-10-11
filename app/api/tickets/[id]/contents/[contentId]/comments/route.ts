import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 内容发布后评论：仅已发布的内容可添加外部评论；ADMIN / PR / PR_MANAGER
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; contentId: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const content = await prisma.content.findFirst({
    where: { id: params.contentId, ticketId: params.id },
  });
  if (!content) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (content.status !== "PUBLISHED") {
    return NextResponse.json({ error: "仅已发布的内容可记录评论" }, { status: 400 });
  }
  const body = await req.json();
  const comment = String(body.comment ?? "").trim();
  if (!comment) return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
  const created = await prisma.contentComment.create({
    data: {
      contentId: params.contentId,
      comment,
      author: body.author?.trim() || null,
      createdById: auth.userId,
    },
    include: { handledBy: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
