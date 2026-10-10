import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 跟进记录：打款后15天内做3次数据跟进。集满3次 → 工单已结算（归档）。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: { _count: { select: { followUps: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "FOLLOW_UP") {
    return NextResponse.json({ error: "仅跟进中的工单可新增跟进记录" }, { status: 400 });
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
        likes: toInt(body.likes),
        comments: toInt(body.comments),
        note: String(body.note ?? "").trim() || null,
        createdById: auth.userId,
      },
    });
    const done = ticket._count.followUps + 1;
    let settled = false;
    if (done >= 3) {
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
  return NextResponse.json(result, { status: 201 });
}
