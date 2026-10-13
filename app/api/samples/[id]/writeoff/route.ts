import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 核销：SIGNED → WRITTEN_OFF（样品赠送/损耗）
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!sample) return NextResponse.json({ error: "寄件请求不存在" }, { status: 404 });
  if (sample.status !== "SIGNED") {
    return NextResponse.json({ error: "仅已签收的请求可核销" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.sampleShipment.update({
      where: { id: params.id },
      data: { status: "WRITTEN_OFF" },
    });
    await writeLog(tx, {
      docType: "SAMPLE",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "SIGNED",
      toStatus: "WRITTEN_OFF",
      note: body.note?.trim() ? `核销：${body.note.trim()}` : "样品核销",
    });
    return u;
  });
  return NextResponse.json(updated);
}
