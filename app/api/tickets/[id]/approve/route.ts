import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser, notifyApprovers } from "@/lib/feishu-notify";
import { ensureTicketSample } from "@/lib/ticket-sample";

// 工单审批（或签）：任一审批人通过即通过；驳回需理由。
// 审批人 = 提交时多选的 PR负责人/管理员；ADMIN 可兜底审批。
// 合作工单通过后自动进入执行中（无需手动"开始执行"）；采买/维护工单通过后停在 APPROVED，等待接单/转化。
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
  const isMaintenance = ticket.ticketKind === "MAINTENANCE";
  const pendingStatus = isProcurement ? "PENDING_PROCUREMENT" : "PENDING_APPROVAL";
  if (ticket.status !== pendingStatus) {
    return NextResponse.json({ error: "仅待审批的工单可审批" }, { status: 400 });
  }
  if (!isProcurement && action === "APPROVE") {
    if (!ticket.assigneeId) {
      return NextResponse.json({ error: "请先指定归属 PR，再审批通过" }, { status: 400 });
    }
    const owner = await prisma.user.findUnique({ where: { id: ticket.assigneeId }, select: { role: true } });
    if (!owner || !["PR", "PR_MANAGER"].includes(owner.role)) {
      return NextResponse.json({ error: "工单归属人必须是 PR 或 PR负责人" }, { status: 400 });
    }
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

  // 采买工单：通过 → APPROVED（采买通过，可一键转合作工单）；维护工单：通过 → APPROVED（可转为合作工单）；合作工单：通过 → IN_PROGRESS
  const toStatus = action === "APPROVE" ? (isProcurement || isMaintenance ? "APPROVED" : "IN_PROGRESS") : "REJECTED";
  const result = await prisma.$transaction(async (tx) => {
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
      fromStatus: pendingStatus,
      toStatus: action === "APPROVE" ? "APPROVED" : "REJECTED",
      note: body.comment?.trim() || null,
    });
    // 合作工单审批通过后自动进入执行中；采买/维护工单通过后停在 APPROVED（采买通过/可转合作工单），不自动执行
    if (action === "APPROVE" && !isProcurement && !isMaintenance) {
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
    // 审批通过后立即建立寄品单，但保持 PENDING + infoConfirmed=false，
    // 由提交人维护收件信息并确认后，才推送仓库接单。
    const sample = action === "APPROVE" && !isProcurement
      ? await ensureTicketSample(tx, params.id, auth.userId, "工单审批通过，系统自动创建寄品单，待维护寄件信息")
      : null;
    return { ticket: u, sample };
  });
  const updated = result.ticket;
  const sample = result.sample;

  await notifyUser(
    ticket.creatorId,
    isProcurement
      ? `「${ticket.title}」${action === "APPROVE" ? "采买审批通过，可一键转为合作工单。" : `被驳回，理由：${body.comment.trim()}`}`
      : isMaintenance
      ? `「${ticket.title}」${action === "APPROVE" ? "审批通过，可转为合作工单。" : `被驳回，理由：${body.comment.trim()}`}`
      : `「${ticket.title}」${action === "APPROVE" ? "审批通过，已自动开始执行。" : `被驳回，理由：${body.comment.trim()}`}`,
    { type: "TICKET", id: ticket.id, title: isProcurement ? "采买工单审批结果" : isMaintenance ? "维护工单审批结果" : "合作工单审批结果", kind: action === "APPROVE" ? "APPROVED" : "REJECTED" }
  );

  // 自动生成的寄品单先由提交人维护收件信息；确认后才推送仓库接单。
  if (action === "APPROVE" && sample) {
    await notifyUser(
      ticket.creatorId,
      `工单「${ticket.title}」已通过审批，已自动创建寄品单 ${sample.sampleNo}。请先维护收件人、电话和地址并确认，确认后才会推送给仓库。`,
      { type: "SAMPLE", id: sample.id, title: "寄品信息待维护", kind: "APPROVED" }
    );
    const warehouses = await prisma.user.findMany({
      where: { role: { in: ["WAREHOUSE", "ADMIN"] } },
      select: { id: true },
    });
    await notifyApprovers(
      warehouses.map((w) => w.id),
      `工单「${ticket.title}」已审批通过，寄品单 ${sample.sampleNo} 已创建，当前等待业务补齐寄件信息后接单。`,
      { type: "SAMPLE", id: sample.id, title: "寄品单已创建，待补齐信息", kind: "SYSTEM" },
    );
  }

  // 采买工单审批通过：记录通过时间 + 广播给所有 PR（待接单）
  if (action === "APPROVE" && isProcurement) {
    await prisma.cooperationTicket.update({
      where: { id: ticket.id },
      data: { procurementApprovedAt: new Date() },
    });
    const prs = await prisma.user.findMany({
      where: { role: "PR" },
      select: { id: true },
    });
    await notifyApprovers(
      prs.map((p) => p.id),
      `采买工单「${ticket.title}」已通过审批，待接单。`,
      { type: "TICKET", id: ticket.id, title: "采买工单待接单", kind: "SYSTEM" },
    );
  }

  return NextResponse.json({ ...updated, sampleShipmentId: sample?.id ?? null });
}
