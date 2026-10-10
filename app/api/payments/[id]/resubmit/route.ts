import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 重新提交：被驳回的打款单，申请人修改后重新提交 → 待业务审批，重新走完整审批链
// 仅申请人本人或管理员可操作；修改说明写入历史日志；重提次数不设限
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (existing.status !== "REJECTED") {
    return NextResponse.json({ error: "仅被驳回的申请可重新提交" }, { status: 400 });
  }
  if (existing.requesterId !== auth.userId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "仅申请人本人或管理员可重新提交" }, { status: 403 });
  }

  const [payment] = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentRequest.update({
      where: { id: params.id },
      data: { status: "PENDING_BIZ", rejectReason: null },
    });
    await writeLog(tx, {
      docType: "PAYMENT",
      docId: params.id,
      action: "RESUBMIT",
      actorId: auth.userId,
      fromStatus: "REJECTED",
      toStatus: "PENDING_BIZ",
      note: note || null,
    });
    return [updated];
  });
  return NextResponse.json(payment);
}
