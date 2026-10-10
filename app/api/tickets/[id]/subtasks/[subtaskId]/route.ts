import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;
const TERMINAL = ["VOIDED", "SETTLED"];
const STATUS = ["TODO", "DOING", "DONE"] as const;

async function getSubtask(ticketId: string, subtaskId: string) {
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "工单不存在", status: 404 } as const;
  const subtask = await prisma.ticketSubtask.findFirst({
    where: { id: subtaskId, ticketId },
  });
  if (!subtask) return { error: "子任务不存在", status: 404 } as const;
  return { ticket, subtask };
}

// 更新子任务（标题/状态/负责人/截止日期/排序）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const found = await getSubtask(params.id, params.subtaskId);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status });
  if (TERMINAL.includes(found.ticket.status)) {
    return NextResponse.json({ error: "终态工单不可增改子任务" }, { status: 400 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.status === "string" && (STATUS as readonly string[]).includes(body.status)) {
    data.status = body.status;
  }
  if ("assigneeId" in body) data.assigneeId = body.assigneeId || null;
  if ("dueDate" in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  const updated = await prisma.ticketSubtask.update({
    where: { id: found.subtask.id },
    data,
    include: { assignee: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

// 删除子任务
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const found = await getSubtask(params.id, params.subtaskId);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status });
  if (TERMINAL.includes(found.ticket.status)) {
    return NextResponse.json({ error: "终态工单不可增改子任务" }, { status: 400 });
  }
  await prisma.ticketSubtask.delete({ where: { id: found.subtask.id } });
  return NextResponse.json({ ok: true });
}
