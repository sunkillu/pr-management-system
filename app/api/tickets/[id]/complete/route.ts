import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 标记完成：执行中 → 已完成，同时写入合作评价（评分 1-5 + 文字评价），沉淀到达人/化妆师档案
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "仅执行中的工单可标记完成" }, { status: 400 });
  }
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人或管理员可标记完成" }, { status: 403 });
  }
  const body = await req.json();
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "请给出 1-5 星评价" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: {
        status: "COMPLETED",
        actualFee: body.actualFee ? body.actualFee : ticket.actualFee,
      },
    });
    await tx.cooperationReview.create({
      data: {
        ticketId: params.id,
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
      toStatus: "COMPLETED",
      note: `标记完成，评价 ${rating} 星`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
