import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// PR 接单：仅任务负责人，仅 PENDING 可接
export async function POST(_req: Request, { params }: { params: { taskId: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const task = await prisma.procurementTask.findUnique({
    where: { id: params.taskId },
    include: { request: true },
  });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && task.assigneeId !== auth.userId) {
    return NextResponse.json({ error: "只能接自己的任务" }, { status: 403 });
  }
  if (task.status !== "PENDING") {
    return NextResponse.json({ error: "当前状态不可接单" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.procurementTask.update({
      where: { id: params.taskId },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
    prisma.procurementRequest.update({
      where: { id: task.requestId, status: "DISTRIBUTED" },
      data: { status: "IN_PROGRESS" },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
