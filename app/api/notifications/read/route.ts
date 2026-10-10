import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ALL_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;

/** 标已读：body { ids?: string[] } 或 { all: true }，只能标自己的 */
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  if (body.all) {
    const r = await prisma.notificationLog.updateMany({
      where: { receiverId: auth.userId, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true, count: r.count });
  }
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids 为空" }, { status: 400 });
  }
  const r = await prisma.notificationLog.updateMany({
    where: { id: { in: ids }, receiverId: auth.userId },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true, count: r.count });
}
