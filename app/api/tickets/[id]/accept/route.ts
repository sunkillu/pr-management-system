import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";

// 采买工单接单：PR 点击接单，工单归属到该 PR，并同单转入合作工单流程
// （ticketKind: PROCUREMENT → COOPERATION，status: APPROVED → DRAFT，由接单PR补充合作信息后提交审批）
// 条件：ticketKind=PROCUREMENT、status=APPROVED、尚未被接单
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["PR", "ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, ticketKind: true, status: true, assigneeId: true, creatorId: true },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "PROCUREMENT") {
    return NextResponse.json({ error: "仅采买工单可接单" }, { status: 400 });
  }
  if (ticket.status !== "APPROVED") {
    return NextResponse.json({ error: "仅采买通过的工单可接单" }, { status: 400 });
  }
  if (ticket.assigneeId) {
    return NextResponse.json({ error: "该工单已被接单" }, { status: 400 });
  }

  const accepted = await prisma.$transaction(async (tx) => {
    const result = await tx.cooperationTicket.updateMany({
      where: {
        id: params.id,
        ticketKind: "PROCUREMENT",
        status: "APPROVED",
        assigneeId: null,
      },
      data: {
        assigneeId: auth.userId,
        acceptedAt: new Date(),
        // 同单转入合作工单流程：接单PR补充合作信息（合作对象/类目/档期）后提交审批
        ticketKind: "COOPERATION",
        status: "DRAFT",
      },
    });
    if (result.count !== 1) return false;

    await tx.ticketAssigneeLog.create({
      data: {
        ticketId: params.id,
        fromUserId: null,
        toUserId: auth.userId,
        changedById: auth.userId,
        action: "ACCEPT",
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "ACCEPT",
      actorId: auth.userId,
      fromStatus: "APPROVED",
      toStatus: "DRAFT",
      note: `${auth.userName}接单，转入合作工单流程`,
    });
    return true;
  });
  if (!accepted) {
    return NextResponse.json({ error: "该工单已被其他人接单或状态已变化" }, { status: 409 });
  }

  // 通知提交人
  try {
    await notifyUser(
      ticket.creatorId,
      `采买工单「${ticket.title}」已被 ${auth.userName} 接单，转入合作工单流程。`,
      { type: "TICKET", id: ticket.id, title: "采买工单已接单", kind: "SYSTEM" },
    );
  } catch (error) {
    console.error("[ticket.accept.notification]", { ticketId: ticket.id, error });
  }

  return NextResponse.json({ ok: true });
}
