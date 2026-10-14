import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { canOperateTicket } from "@/lib/ticket-permission";
import { writeLog } from "@/lib/approval-log";

const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;
const TERMINAL = ["VOIDED", "SETTLED", "FOLLOW_UP"];
const STATUS = ["TODO", "DOING", "DONE", "BLOCKED"] as const;

async function getSubtask(ticketId: string, subtaskId: string) {
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "工单不存在", status: 404 } as const;
  const subtask = await prisma.ticketSubtask.findFirst({
    where: { id: subtaskId, ticketId },
  });
  if (!subtask) return { error: "子任务不存在", status: 404 } as const;
  return { ticket, subtask };
}

// 更新子任务（标题/状态/负责人/截止日期/排序）：仅创建人 / 审批链成员 / ADMIN
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const found = await getSubtask(params.id, params.subtaskId);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作子任务" }, { status: 403 });
  }
  if (TERMINAL.includes(found.ticket.status)) {
    return NextResponse.json({ error: "终态工单不可增改子任务" }, { status: 400 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.status === "string" && (STATUS as readonly string[]).includes(body.status)) {
    const nextStatus = body.status;
    // 标为阻塞：原因必填，记录阻塞开始时间
    if (nextStatus === "BLOCKED") {
      const reason = String(body.blockedReason ?? "").trim();
      if (!reason) {
        return NextResponse.json({ error: "请填写阻塞原因" }, { status: 400 });
      }
      data.status = "BLOCKED";
      data.blockedReason = reason;
      data.blockedAt = new Date();
      data.blockedNotifiedAt = null;
    } else {
      // 离开阻塞状态：清空阻塞信息
      if (found.subtask.status === "BLOCKED") {
        data.blockedReason = null;
        data.blockedAt = null;
        data.blockedNotifiedAt = null;
      }
      data.status = nextStatus;
    }
  }
  if ("assigneeId" in body) data.assigneeId = body.assigneeId || null;
  if ("dueDate" in body) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.ticketSubtask.findUniqueOrThrow({ where: { id: found.subtask.id } });
    const result = await tx.ticketSubtask.update({
      where: { id: found.subtask.id },
      data,
      include: { assignee: { select: { id: true, name: true } } },
    });
    if (current.status !== result.status) {
      await writeLog(tx, {
        docType: "SUBTASK",
        docId: result.id,
        action: "EDIT",
        actorId: auth.userId,
        fromStatus: current.status,
        toStatus: result.status,
      });
    }
    return result;
  });
  return NextResponse.json(updated);
}

// 删除子任务：仅创建人 / 审批链成员 / ADMIN
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;
  const found = await getSubtask(params.id, params.subtaskId);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作子任务" }, { status: 403 });
  }
  if (TERMINAL.includes(found.ticket.status)) {
    return NextResponse.json({ error: "终态工单不可增改子任务" }, { status: 400 });
  }
  await prisma.ticketSubtask.delete({ where: { id: found.subtask.id } });
  return NextResponse.json({ ok: true });
}
