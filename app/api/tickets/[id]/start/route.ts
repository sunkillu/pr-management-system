import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 开始执行：已通过 → 执行中（创建人或管理员），必须提交推进说明
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "APPROVED") {
    return NextResponse.json({ error: "仅已通过的工单可开始执行" }, { status: 400 });
  }
  if (auth.role !== "ADMIN" && ticket.creatorId !== auth.userId) {
    return NextResponse.json({ error: "仅创建人或管理员可开始执行" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();
  if (!note) {
    return NextResponse.json({ error: "开始执行必须填写推进说明" }, { status: 400 });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "IN_PROGRESS" },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "APPROVED",
      toStatus: "IN_PROGRESS",
      note: `开始执行：${note}`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
