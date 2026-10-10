import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { notifyUser } from "@/lib/feishu-notify";

const ALL_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;
const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;

// 评论列表
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const list = await prisma.ticketComment.findMany({
    where: { ticketId: params.id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

// 发表评论：支持 @ 用户（mentionedIds），被@者收到站内通知
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  const body = await req.json();
  if (!body.content?.trim()) return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
  const mentionedIds: string[] = Array.isArray(body.mentionedIds)
    ? body.mentionedIds.filter(
        (id: unknown, idx: number, arr: unknown[]) =>
          typeof id === "string" && id !== auth.userId && arr.indexOf(id) === idx
      )
    : [];

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: params.id,
      authorId: auth.userId,
      content: body.content.trim(),
      mentionedIds,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  for (const uid of mentionedIds) {
    await notifyUser(
      uid,
      `${auth.userName}在合作工单「${ticket.title}」的评论中@了你：${body.content.trim().slice(0, 100)}`,
      { type: "TICKET", id: ticket.id, title: "评论@提醒", kind: "REMIND" }
    );
  }

  return NextResponse.json(comment, { status: 201 });
}
