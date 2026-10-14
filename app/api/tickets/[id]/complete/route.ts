import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 标记完成：执行中 → 待素材审批，同时写入合作评价（评分 1-5 + 文字评价），沉淀到达人/化妆师档案
// 必须先回收至少 1 条素材；PR负责人审批素材通过后才自动生成打款单
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: {
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "仅执行中的工单可标记完成" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可标记完成" }, { status: 403 });
  }
  // 素材回收门槛：至少回收 1 条素材
  const materialCount = await prisma.materialRecord.count({ where: { ticketId: params.id } });
  if (materialCount === 0) {
    return NextResponse.json({ error: "请先回收素材" }, { status: 400 });
  }
  // 寄件门槛：工单有寄品明细时，必须有关联寄件请求且已签收/已核销
  const shipItems = ticket.shipItems as { style: string }[] | null;
  if (Array.isArray(shipItems) && shipItems.length > 0) {
    const doneSample = await prisma.sampleShipment.findFirst({
      where: { ticketId: params.id, status: { in: ["SIGNED", "WRITTEN_OFF"] } },
      select: { id: true },
    });
    if (!doneSample) {
      return NextResponse.json({ error: "寄品尚未签收，请先完成寄件流程" }, { status: 400 });
    }
  }
  const body = await req.json();
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "请给出 1-5 星评价" }, { status: 400 });
  }
  const executionSummary = String(body.executionSummary ?? "").trim();
  if (!executionSummary) {
    return NextResponse.json({ error: "标记完成必须填写执行总结" }, { status: 400 });
  }
  // PR 二次确认打款金额
  if (body.amountConfirmed !== true) {
    return NextResponse.json({ error: "请确认以上金额为最终打款金额" }, { status: 400 });
  }

  const finalFee = body.actualFee ? body.actualFee : ticket.actualFee;

  // 打款金额管控：实际费用不能超过预算，超了需管理员特批
  const effectiveFee = Number(finalFee ?? ticket.budgetFee);
  const budget = Number(ticket.budgetFee);
  if (effectiveFee > budget && !ticket.budgetOverridden) {
    const over = (effectiveFee - budget).toFixed(2);
    return NextResponse.json(
      { error: `实际费用超出预算 ${over} 元，请作废重提或请管理员特批`, overBudget: true },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: {
        status: "MATERIAL_REVIEW",
        actualFee: finalFee,
      },
    });
    await tx.cooperationReview.upsert({
      where: { ticketId: params.id },
      create: {
        ticketId: params.id,
        influencerId: ticket.influencerId,
        makeupArtistId: ticket.makeupArtistId,
        rating,
        comment: body.reviewComment?.trim() || null,
        reviewerId: auth.userId,
      },
      update: {
        influencerId: ticket.influencerId,
        makeupArtistId: ticket.makeupArtistId,
        rating,
        comment: body.reviewComment?.trim() || null,
        reviewerId: auth.userId,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "IN_PROGRESS",
      toStatus: "MATERIAL_REVIEW",
      note: `标记完成，评价 ${rating} 星；执行总结：${executionSummary}；已回收 ${materialCount} 条素材，待PR负责人审批`,
    });
    return u;
  });

  return NextResponse.json(updated);
}
