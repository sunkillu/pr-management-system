import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";

// 维护工单转为合作工单：同单翻转 ticketKind，状态回到 DRAFT，
// 由归属 PR 补充合作信息（合作类目/档期/预算）后提交审批，走完整合作流程。
// 条件：ticketKind=MAINTENANCE、status=DRAFT/APPROVED/AWAITING_DRAFT
// 权限：ADMIN / PR_MANAGER / 归属 PR（有 assignee 时为 assignee，未分配时为创建人）
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER", "PR"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, ticketKind: true, status: true, assigneeId: true, creatorId: true },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "MAINTENANCE") {
    return NextResponse.json({ error: "仅维护工单可转为合作工单" }, { status: 400 });
  }
  if (!["DRAFT", "APPROVED", "AWAITING_DRAFT"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅草稿、已通过或寄品已签收的维护工单可转为合作工单" }, { status: 400 });
  }
  const isOwner = ticket.assigneeId ? ticket.assigneeId === auth.userId : ticket.creatorId === auth.userId;
  if (auth.role === "PR" && !isOwner) {
    return NextResponse.json({ error: "仅管理员、PR负责人或归属 PR 可转化" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: {
        ticketKind: "COOPERATION",
        status: "DRAFT",
      },
    });
    // 操作历史：LogAction 无 CONVERT，用 EDIT + note 记录转化（详情页推进记录可见）
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "EDIT",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: "DRAFT",
      note: "由维护工单转化为合作工单",
    });
    return u;
  });

  // 通知创建人
  await notifyUser(
    ticket.creatorId,
    `维护工单「${ticket.title}」已由 ${auth.userName} 转为合作工单，请补充合作信息后提交审批。`,
    { type: "TICKET", id: ticket.id, title: "维护工单已转为合作工单", kind: "SYSTEM" },
  );

  return NextResponse.json(updated);
}
