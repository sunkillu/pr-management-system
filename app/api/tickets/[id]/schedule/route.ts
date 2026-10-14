import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { recalculateReminders } from "@/lib/reminders";

// PATCH /api/tickets/:id/schedule — 修改确定档期，并写入档期修改审计日志
// body: { confirmedDate?: string | null （YYYY-MM-DD，null/空串 = 暂不确认）, reason: string（必填）}
// 注意：quoteAmount 为 A级敏感，此接口不读取、不输出报价相关数据
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "COOPERATION") {
    return NextResponse.json({ error: "仅合作工单可修改档期" }, { status: 400 });
  }
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId && ticket.assigneeId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人、接单人或管理员可修改档期" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "修改原因不能为空" }, { status: 400 });
  }

  let newDate: Date | null = null;
  const rawDate = body.confirmedDate;
  if (rawDate != null && rawDate !== "") {
    if (typeof rawDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return NextResponse.json({ error: "确定档期格式不正确（应为 YYYY-MM-DD）" }, { status: 400 });
    }
    newDate = new Date(`${rawDate}T00:00:00`);
    if (isNaN(newDate.getTime())) {
      return NextResponse.json({ error: "确定档期不是有效日期" }, { status: 400 });
    }
  }

  const oldDate = ticket.confirmedDate;
  const oldTs = oldDate ? oldDate.getTime() : null;
  const newTs = newDate ? newDate.getTime() : null;
  if (oldTs === newTs) {
    return NextResponse.json({ error: "确定档期未发生变化" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { confirmedDate: newDate },
    });
    await tx.scheduleChangeLog.create({
      data: {
        ticketId: params.id,
        oldDate,
        newDate,
        changedById: auth.userId,
        reason,
      },
    });
  });

  // 档期变更后重算档期提醒（静默失败，不影响主流程）
  try {
    await recalculateReminders(params.id, auth.userId);
  } catch (e) {
    console.error("重算档期提醒失败:", e);
  }

  return NextResponse.json({ ok: true });
}
