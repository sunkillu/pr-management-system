import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser, notifyApprovers } from "@/lib/feishu-notify";

// 工单审批（或签）：任一审批人通过即通过；驳回需理由。
// 审批人 = 提交时多选的 PR负责人/管理员；ADMIN 可兜底审批。
// 通过后自动进入执行中（无需手动"开始执行"）。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const action = body.action as "APPROVE" | "REJECT";
  if (!["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "action 非法" }, { status: 400 });
  }
  if (action === "REJECT" && !body.comment?.trim()) {
    return NextResponse.json({ error: "驳回必须填写理由" }, { status: 400 });
  }

  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  const isProcurement = ticket.ticketKind === "PROCUREMENT";
  const pendingStatus = isProcurement ? "PENDING_PROCUREMENT" : "PENDING_APPROVAL";
  if (ticket.status !== pendingStatus) {
    return NextResponse.json({ error: "仅待审批的工单可审批" }, { status: 400 });
  }

  if (auth.role !== "ADMIN") {
    const assigned = await prisma.requestApprover.findUnique({
      where: {
        requestType_requestId_approverId: {
          requestType: "TICKET",
          requestId: params.id,
          approverId: auth.userId,
        },
      },
    });
    if (!assigned) return NextResponse.json({ error: "你不是该工单的审批人" }, { status: 403 });
  }

  // 采买工单：通过 → APPROVED（采买通过，可一键转合作工单）；合作工单：通过 → IN_PROGRESS
  const toStatus = action === "APPROVE" ? (isProcurement ? "APPROVED" : "IN_PROGRESS") : "REJECTED";
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.cooperationTicket.updateMany({
      where: {
        id: params.id,
        ticketKind: ticket.ticketKind,
        status: pendingStatus,
      },
      data: {
        status: toStatus,
        rejectReason: action === "REJECT" ? body.comment.trim() : null,
        escalatedAt: null, // 重新进入流转时清除超时标记
        ...(action === "APPROVE" && isProcurement ? { procurementApprovedAt: new Date() } : {}),
      },
    });
    if (result.count !== 1) return null;

    await tx.requestApprover.upsert({
      where: {
        requestType_requestId_approverId: {
          requestType: "TICKET",
          requestId: params.id,
          approverId: auth.userId,
        },
      },
      update: { status: action === "APPROVE" ? "APPROVED" : "REJECTED", decidedAt: new Date(), comment: body.comment?.trim() || null },
      create: {
        requestType: "TICKET",
        requestId: params.id,
        approverId: auth.userId,
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        decidedAt: new Date(),
        comment: body.comment?.trim() || null,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action,
      actorId: auth.userId,
      fromStatus: pendingStatus,
      toStatus: action === "APPROVE" ? "APPROVED" : "REJECTED",
      note: body.comment?.trim() || null,
    });
    // 合作工单审批通过后自动进入执行中；采买工单通过后停在 APPROVED（采买通过），等待转合作工单
    if (action === "APPROVE" && !isProcurement) {
      await writeLog(tx, {
        docType: "TICKET",
        docId: params.id,
        action: "APPROVE",
        actorId: auth.userId,
        fromStatus: "APPROVED",
        toStatus: "IN_PROGRESS",
        note: "审批通过，自动开始执行",
      });
    }
    return tx.cooperationTicket.findUnique({ where: { id: params.id } });
  });
  if (!updated) {
    return NextResponse.json({ error: "工单已由其他审批人处理或状态已变化" }, { status: 409 });
  }

  try {
    await notifyUser(
      ticket.creatorId,
      isProcurement
        ? `「${ticket.title}」${action === "APPROVE" ? "采买审批通过，可一键转为合作工单。" : `被驳回，理由：${body.comment.trim()}`}`
        : `「${ticket.title}」${action === "APPROVE" ? "审批通过，已自动开始执行。" : `被驳回，理由：${body.comment.trim()}`}`,
      { type: "TICKET", id: ticket.id, title: isProcurement ? "采买工单审批结果" : "合作工单审批结果", kind: action === "APPROVE" ? "APPROVED" : "REJECTED" }
    );
  } catch (error) {
    console.error("[ticket.approve.notification]", { ticketId: ticket.id, error });
  }

  // 审批通过且工单有寄品明细时，提醒提交人维护寄件信息并发起寄件请求（仅合作工单）
  if (action === "APPROVE" && !isProcurement) {
    const shipItems = ticket.shipItems as { style: string }[] | null;
    if (Array.isArray(shipItems) && shipItems.length > 0) {
      try {
        await notifyUser(
          ticket.creatorId,
          `工单「${ticket.title}」已通过审批，请维护寄件信息并发起寄件请求。`,
          { type: "SAMPLE", id: "", title: "寄件信息待维护", kind: "SYSTEM" }
        );
      } catch (error) {
        console.error("[ticket.approve.sample-notification]", { ticketId: ticket.id, error });
      }
    }
  }

  // 采买工单审批通过：记录通过时间 + 广播给所有 PR（待接单）
  if (action === "APPROVE" && isProcurement) {
    try {
      const prs = await prisma.user.findMany({
        where: { role: "PR" },
        select: { id: true },
      });
      await notifyApprovers(
        prs.map((p) => p.id),
        `采买工单「${ticket.title}」已通过审批，待接单。`,
        { type: "TICKET", id: ticket.id, title: "采买工单待接单", kind: "SYSTEM" },
      );
    } catch (error) {
      console.error("[ticket.approve.procurement-notification]", { ticketId: ticket.id, error });
    }
  }

  return NextResponse.json(updated);
}
