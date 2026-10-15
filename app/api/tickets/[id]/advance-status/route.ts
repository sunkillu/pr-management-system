import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 工单进入待返稿：IN_PROGRESS / COMPLETED → PENDING_REVIEW（需确定档期 confirmedDate）。
// 后续两步走专用入口，不走这里：
//   已返稿 → POST /api/tickets/[id]/return-draft
//   已发布 → POST /api/tickets/[id]/publish
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可推进状态" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const to = String(body.to ?? "");
  if (to === "REVIEWED") {
    return NextResponse.json({ error: "标记已返稿请调用 return-draft 接口" }, { status: 400 });
  }
  if (to === "PUBLISHED") {
    return NextResponse.json({ error: "标记已发布请调用 publish 接口" }, { status: 400 });
  }
  if (to !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "目标状态非法" }, { status: 400 });
  }
  if (!["IN_PROGRESS", "COMPLETED"].includes(ticket.status)) {
    return NextResponse.json(
      { error: `当前状态「${ticket.status}」不可推进到「待返稿」` },
      { status: 400 }
    );
  }
  const cd = typeof body.confirmedDate === "string" ? body.confirmedDate.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cd)) {
    return NextResponse.json({ error: "填写确定档期后才能进入待返稿" }, { status: 400 });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "PENDING_REVIEW", confirmedDate: new Date(cd) },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: "PENDING_REVIEW",
      note: `填写确定档期 ${cd}，进入待返稿`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
