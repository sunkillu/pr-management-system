import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 跟进记录：打款后15天内做3次数据跟进。集满3次 → 工单已结算（归档）。
// 仅创建人 / 审批链成员 / ADMIN 可操作
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可新增跟进记录" }, { status: 403 });
  }
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: { _count: { select: { followUps: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["PUBLISHED", "FOLLOW_UP"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅已发布或跟进中的工单可新增跟进记录" }, { status: 400 });
  }
  if (ticket._count.followUps >= 3) {
    return NextResponse.json({ error: "跟进已满3次" }, { status: 400 });
  }
  const body = await req.json();
  const toInt = (v: unknown) => {
    const n = Number(v);
    return v === null || v === undefined || v === "" || Number.isNaN(n) ? null : Math.round(n);
  };

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.followUpRecord.create({
      data: {
        ticketId: params.id,
        followNo: ticket._count.followUps + 1,
        noteUrl: String(body.noteUrl ?? "").trim() || null,
        views: toInt(body.views),
        impressions: toInt(body.impressions),
        likes: toInt(body.likes),
        favorites: toInt(body.favorites),
        comments: toInt(body.comments),
        shares: toInt(body.shares),
        note: String(body.note ?? "").trim() || null,
        createdById: auth.userId,
      },
    });
    const done = ticket._count.followUps + 1;
    let settled = false;
    if (done >= 3 && ticket.status === "FOLLOW_UP") {
      await tx.cooperationTicket.update({
        where: { id: params.id },
        data: { status: "SETTLED" },
      });
      await writeLog(tx, {
        docType: "TICKET",
        docId: params.id,
        action: "APPROVE",
        actorId: auth.userId,
        fromStatus: "FOLLOW_UP",
        toStatus: "SETTLED",
        note: `完成第3次跟进，工单归档`,
      });
      settled = true;
    }
    return { record, done, settled };
  });
  if (result.settled && ticket.parentId) {
    const siblings = await prisma.cooperationTicket.findMany({ where: { parentId: ticket.parentId }, select: { status: true } });
    const terminal = new Set(["SETTLED", "VOIDED"]);
    if (siblings.length > 0 && siblings.every((child) => terminal.has(child.status))) {
      await prisma.cooperationTicket.updateMany({ where: { id: ticket.parentId, status: "PROCUREMENT_GENERATED" }, data: { status: "PROCUREMENT_CLOSED" } });
    }
  }
  return NextResponse.json(result, { status: 201 });
}
