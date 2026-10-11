import { prisma } from "@/lib/prisma";

/**
 * 工单状态推动权限：仅创建人、审批链上的人（RequestApprover）、ADMIN 可操作。
 * 用于：标记完成、作废、重提、子任务/节点推进、跟进记录等。
 */
export async function canOperateTicket(
  ticketId: string,
  userId: string,
  role: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: { creatorId: true },
  });
  if (!ticket) return false;
  if (ticket.creatorId === userId) return true;
  const approver = await prisma.requestApprover.findFirst({
    where: { requestType: "TICKET", requestId: ticketId, approverId: userId },
  });
  return !!approver;
}
