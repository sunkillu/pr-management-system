import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";

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
  if (ticket.status !== "PENDING_APPROVAL") {
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

  const toStatus = action === "APPROVE" ? "IN_PROGRESS" : "REJECTED";
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: {
        status: toStatus,
        rejectReason: action === "REJECT" ? body.comment.trim() : null,
        escalatedAt: null, // 重新进入流转时清除超时标记
      },
    });
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
      fromStatus: "PENDING_APPROVAL",
      toStatus: action === "APPROVE" ? "APPROVED" : "REJECTED",
      note: body.comment?.trim() || null,
    });
    // 审批通过后自动进入执行中
    if (action === "APPROVE") {
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
    return u;
  });

  await notifyUser(
    ticket.creatorId,
    `「${ticket.title}」${action === "APPROVE" ? "审批通过，已自动开始执行。" : `被驳回，理由：${body.comment.trim()}`}`,
    { type: "TICKET", id: ticket.id, title: "合作工单审批结果", kind: action === "APPROVE" ? "APPROVED" : "REJECTED" }
  );

  return NextResponse.json(updated);
}
