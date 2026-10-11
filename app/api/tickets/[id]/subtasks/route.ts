import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { canOperateTicket } from "@/lib/ticket-permission";

const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;
const TERMINAL = ["VOIDED", "SETTLED", "FOLLOW_UP"];

// 子任务列表
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const list = await prisma.ticketSubtask.findMany({
    where: { ticketId: params.id },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(list);
}

// 新增子任务：仅创建人 / 审批链成员 / ADMIN
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作子任务" }, { status: 403 });
  }
  if (TERMINAL.includes(ticket.status)) {
    return NextResponse.json({ error: "终态工单不可增改子任务" }, { status: 400 });
  }
  const body = await req.json();
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "子任务标题不能为空" }, { status: 400 });

  const maxSort = await prisma.ticketSubtask.aggregate({
    where: { ticketId: params.id },
    _max: { sortOrder: true },
  });
  const created = await prisma.ticketSubtask.create({
    data: {
      ticketId: params.id,
      title,
      assigneeId: body.assigneeId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    include: { assignee: { select: { id: true, name: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
