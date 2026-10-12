import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const AUTH_STATUS = ["AUTHORIZED", "COOPERATED_NO_AUTH", "NEW"];

// 任务推进：判定达人状态 / 反馈价格 / 确认价格 / 标记上传网盘 / 完成任务
export async function PATCH(req: Request, { params }: { params: { taskId: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR"]);
  if (!auth.ok) return auth.res;

  const task = await prisma.procurementTask.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  const isOwner = task.assigneeId === auth.userId;
  if (auth.role === "PR" && !isOwner) {
    return NextResponse.json({ error: "只能操作自己的任务" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  // 1) 判定达人状态（PR/ADMIN，接单后）
  if (body.influencerStatus !== undefined) {
    if (!isOwner && auth.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    if (!AUTH_STATUS.includes(body.influencerStatus)) {
      return NextResponse.json({ error: "达人状态非法" }, { status: 400 });
    }
    if (!["ACCEPTED", "IN_PROGRESS"].includes(task.status)) {
      return NextResponse.json({ error: "请先接单" }, { status: 400 });
    }
    data.influencerStatus = body.influencerStatus;
    data.influencerName = body.influencerName?.trim() || null;
    data.status = "IN_PROGRESS";
  }

  // 2) PR 反馈价格（无合作达人）
  if (body.priceFeedback !== undefined) {
    if (!isOwner && auth.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    if (!body.priceFeedback?.trim()) {
      return NextResponse.json({ error: "请填写反馈价格" }, { status: 400 });
    }
    data.priceFeedback = body.priceFeedback.trim();
    data.priceConfirmed = false;
  }

  // 3) 运营/管理员确认价格
  if (body.priceConfirmed !== undefined) {
    const a2 = await requireRoles(["ADMIN", "OPERATOR"]);
    if (!a2.ok) return a2.res;
    if (!task.priceFeedback) {
      return NextResponse.json({ error: "PR 尚未反馈价格" }, { status: 400 });
    }
    data.priceConfirmed = !!body.priceConfirmed;
  }

  // 4) 标记已上传网盘（有授权）
  if (body.netdiskUploaded !== undefined) {
    if (!isOwner && auth.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    data.netdiskUploaded = !!body.netdiskUploaded;
    if (body.netdiskUploaded) data.status = "DONE";
  }

  // 5) 备注
  if (body.note !== undefined) data.note = body.note?.trim() || null;

  // 6) 手动完成 / 取消
  if (body.status === "DONE") {
    if (!isOwner && auth.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    data.status = "DONE";
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "无有效更新" }, { status: 400 });
  }

  const updated = await prisma.procurementTask.update({ where: { id: params.taskId }, data: data as never });

  // 若该需求下所有任务都 DONE，需求置 DONE
  const remaining = await prisma.procurementTask.count({
    where: { requestId: task.requestId, status: { notIn: ["DONE", "CANCELLED"] } },
  });
  if (remaining === 0) {
    await prisma.procurementRequest.update({
      where: { id: task.requestId },
      data: { status: "DONE" },
    });
  }

  return NextResponse.json({ ok: true, task: updated });
}

// 生成授权费用打款单（已合作无授权）：PR/ADMIN
export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const task = await prisma.procurementTask.findUnique({ where: { id: params.taskId } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && task.assigneeId !== auth.userId) {
    return NextResponse.json({ error: "只能操作自己的任务" }, { status: 403 });
  }
  if (task.influencerStatus !== "COOPERATED_NO_AUTH") {
    return NextResponse.json({ error: "仅已合作无授权的任务可生成授权打款单" }, { status: 400 });
  }
  if (task.paymentId) {
    return NextResponse.json({ error: "已生成过打款单" }, { status: 400 });
  }

  const body = await req.json();
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "请填写授权费用金额" }, { status: 400 });
  }
  if (!task.influencerName?.trim() && !body?.payeeName?.trim()) {
    return NextResponse.json({ error: "请填写达人/收款方名称" }, { status: 400 });
  }

  const payment = await prisma.paymentRequest.create({
    data: {
      title: `素材授权费用-${task.influencerName || body.payeeName}`.slice(0, 100),
      amount,
      payeeName: (task.influencerName || body.payeeName).trim(),
      reason: `采买需求授权费用（任务 ${task.id.slice(-6)}）`,
      requesterId: auth.userId,
    },
  });
  await prisma.procurementTask.update({
    where: { id: params.taskId },
    data: { paymentId: payment.id, status: "IN_PROGRESS" },
  });
  return NextResponse.json({ ok: true, paymentId: payment.id });
}
