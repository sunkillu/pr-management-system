import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 超预算特批：仅管理员。实际费用超出预算时，管理员填写特批理由后放行，
// 后续标记完成不再拦截超预算。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["APPROVED", "PENDING_SAMPLE", "IN_PROGRESS", "SAMPLED", "PENDING_MANUSCRIPT", "PENDING_PUBLISH", "PUBLISHED"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅已通过/执行中的工单可特批" }, { status: 400 });
  }
  const body = await req.json();
  const reason = String(body.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "特批必须填写理由" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { budgetOverridden: true },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      note: `超预算特批：${reason}`,
    });
  });
  return NextResponse.json({ ok: true });
}
