import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 确认发布档期：已返稿待发布（设置发布日期，进入倒计时）
// body: { publishScheduleDate: "YYYY-MM-DD" }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "PENDING_PUBLISH") {
    return NextResponse.json({ error: "仅已返稿待发布的工单可确认发布档期" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }

  const body = await req.json();
  const d = body.publishScheduleDate ? new Date(body.publishScheduleDate) : null;
  if (!d || isNaN(d.getTime())) {
    return NextResponse.json({ error: "请选择发布档期" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { publishScheduleDate: d, publishScheduleNotifiedAt: null },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "PENDING_PUBLISH",
      toStatus: "PENDING_PUBLISH",
      note: `确认发布档期 ${d.toISOString().slice(0, 10)}，进入发布倒计时`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
