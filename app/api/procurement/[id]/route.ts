import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR", "PR_MANAGER", "FINANCE", "VIEWER"]);
  if (!auth.ok) return auth.res;

  const item = await prisma.procurementRequest.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ item });
}

// 取消：创建人或 ADMIN，仅 PENDING/DISTRIBUTED 可取消
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;

  const item = await prisma.procurementRequest.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && item.createdById !== auth.userId) {
    return NextResponse.json({ error: "只能取消自己提交的需求" }, { status: 403 });
  }
  if (!["PENDING", "DISTRIBUTED"].includes(item.status)) {
    return NextResponse.json({ error: "当前状态不可取消" }, { status: 400 });
  }
  const body = await req.json();
  if (!body?.cancelReason?.trim()) return NextResponse.json({ error: "取消原因必填" }, { status: 400 });

  await prisma.$transaction([
    prisma.procurementRequest.update({
      where: { id: params.id },
      data: { status: "CANCELLED", cancelReason: body.cancelReason.trim() },
    }),
    prisma.procurementTask.updateMany({
      where: { requestId: params.id, status: { in: ["PENDING", "ACCEPTED", "IN_PROGRESS"] } },
      data: { status: "CANCELLED" },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
