import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { getOccupancyStatus } from "@/lib/occupancy";

// POST /api/tickets/:id/force-create — 管理员强制创建（强制占用）入口
// 场景：工单已存在（通常为草稿），达人正被其他工单占用，管理员仍决定让本工单开始占用。
// 与普通流程的区别：跳过占用冲突校验，直接覆盖 Influencer.occupiedByTicketId，
// 并记录 forceCreated / forceReason / forceById / forceAt 留痕。
// 仅 ADMIN 可调用。body: { forceReason: string（必填） }
// 注意：quoteAmount 为 A级敏感，本接口不输出、不记录报价相关数据。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const forceReason = typeof body.forceReason === "string" ? body.forceReason.trim() : "";
  if (!forceReason) {
    return NextResponse.json({ error: "请填写强制创建原因" }, { status: 400 });
  }

  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "COOPERATION") {
    return NextResponse.json({ error: "仅合作工单可强制占用" }, { status: 400 });
  }
  if (!ticket.influencerId) {
    return NextResponse.json({ error: "该工单未关联达人" }, { status: 400 });
  }
  // 开始占用规则：报价 + 确定档期齐全
  if (!ticket.quoteAmount || !ticket.confirmedDate) {
    return NextResponse.json({ error: "报价与确定档期未齐全，无法开始占用" }, { status: 400 });
  }

  // 记录被抢占的原占用工单（用于审计与清理其 occupiesResource 标记）
  const prevOccupancy = await getOccupancyStatus(ticket.influencerId);
  const prevTicketId =
    prevOccupancy.occupied && prevOccupancy.ticketId && prevOccupancy.ticketId !== ticket.id
      ? prevOccupancy.ticketId
      : null;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // 强制抢占：直接覆盖，不做占用冲突校验（这正是"强制"的含义）
    await tx.influencer.update({
      where: { id: ticket.influencerId! },
      data: { occupiedByTicketId: ticket.id },
    });
    if (prevTicketId) {
      await tx.cooperationTicket.update({
        where: { id: prevTicketId },
        data: { occupiesResource: false },
      });
    }
    await tx.cooperationTicket.update({
      where: { id: ticket.id },
      data: {
        occupiesResource: true,
        resourceOccupiedAt: now,
        forceCreated: true,
        forceReason,
        forceById: auth.userId,
        forceAt: now,
      },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: ticket.id,
      action: "EDIT",
      actorId: auth.userId,
      note: `管理员强制占用达人资源${
        prevTicketId && prevOccupancy.ticketTitle ? `（原占用工单：${prevOccupancy.ticketTitle}）` : ""
      }，原因：${forceReason}`,
    });
  });

  return NextResponse.json({ ok: true });
}
