import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ALL_ROLES = ["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;

/** 当前登录用户的通知列表，?unread=1 只取未读，按时间倒序 */
export async function GET(req: NextRequest) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
  const list = await prisma.notificationLog.findMany({
    where: {
      receiverId: auth.userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      content: true,
      kind: true,
      type: true,
      relatedType: true,
      relatedId: true,
      isRead: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ notifications: list });
}
