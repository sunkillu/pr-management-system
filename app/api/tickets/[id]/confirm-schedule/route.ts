import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 档期判定：已寄品 → 待返稿
// 已填档期（startDate/endDate）直接进入；未填则本次一起提交
// body: { startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD" }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "SAMPLED") {
    return NextResponse.json({ error: "仅已寄品的工单可确认档期" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const startDate = body.startDate ? new Date(body.startDate) : ticket.startDate;
  const endDate = body.endDate ? new Date(body.endDate) : ticket.endDate;
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "请确认档期（开始/结束日期）" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "PENDING_MANUSCRIPT", startDate, endDate },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "SAMPLED",
      toStatus: "PENDING_MANUSCRIPT",
      note: `档期确认（${startDate.toISOString().slice(0, 10)} ~ ${endDate.toISOString().slice(0, 10)}），进入待返稿`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
