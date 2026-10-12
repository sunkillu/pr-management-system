import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 任务分发（仅 ADMIN）：周维度可拆分多 PR；链接采买直接指定一位 PR 接单
// body: { assignments: [{ assigneeId: string, quantity?: number }] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const item = await prisma.procurementRequest.findUnique({
    where: { id: params.id },
    include: { tasks: true },
  });
  if (!item) return NextResponse.json({ error: "不存在" }, { status: 404 });
  if (item.status !== "PENDING") {
    return NextResponse.json({ error: "仅待分发的需求可分发" }, { status: 400 });
  }

  const body = await req.json();
  const assignments: Array<{ assigneeId: string; quantity?: number }> = body?.assignments ?? [];
  if (assignments.length === 0) {
    return NextResponse.json({ error: "请至少指定一位 PR" }, { status: 400 });
  }
  // 校验都是 PR 角色
  const users = await prisma.user.findMany({
    where: { id: { in: assignments.map((a) => a.assigneeId) } },
    select: { id: true, role: true },
  });
  const prIds = new Set(users.filter((u) => u.role === "PR").map((u) => u.id));
  const bad = assignments.find((a) => !prIds.has(a.assigneeId));
  if (bad) return NextResponse.json({ error: "分发对象必须为 PR 角色" }, { status: 400 });

  if (item.type === "WEEKLY_STYLE") {
    const total = assignments.reduce((s, a) => s + (a.quantity || 0), 0);
    if (total !== item.quantity) {
      return NextResponse.json({ error: `拆分数量之和（${total}）须等于需求数量（${item.quantity}）` }, { status: 400 });
    }
    for (const a of assignments) {
      if (!Number.isInteger(a.quantity) || (a.quantity as number) <= 0) {
        return NextResponse.json({ error: "每位 PR 负责数量须为正整数" }, { status: 400 });
      }
    }
  }

  await prisma.$transaction([
    prisma.procurementTask.createMany({
      data: assignments.map((a) => ({
        requestId: params.id,
        assigneeId: a.assigneeId,
        quantity: item.type === "WEEKLY_STYLE" ? a.quantity : null,
      })),
    }),
    prisma.procurementRequest.update({
      where: { id: params.id },
      data: { status: "DISTRIBUTED" },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
