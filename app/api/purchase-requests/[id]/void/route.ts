import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { PURCHASE_CREATE_ROLES } from "@/lib/purchase-shared";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...PURCHASE_CREATE_ROLES]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const note = String(body?.note ?? "").trim() || null;

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: { lines: { select: { id: true, status: true } } },
  });
  if (!request) return NextResponse.json({ error: "采买请求不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && request.creatorId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (request.status !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "仅待审批的采买请求可作废" }, { status: 400 });
  }
  if (request.lines.some((line) => line.status !== "PENDING")) {
    return NextResponse.json({ error: "仅全部未审批的采买请求可作废" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.purchaseRequest.updateMany({
      where: { id: request.id, status: "PENDING_REVIEW" },
      data: { status: "VOIDED" },
    });
    if (result.count !== 1) return false;
    await writeLog(tx, {
      docType: "PURCHASE",
      docId: request.id,
      action: "VOID",
      actorId: auth.userId,
      fromStatus: "PENDING_REVIEW",
      toStatus: "VOIDED",
      note,
    });
    return true;
  });

  if (!updated) {
    return NextResponse.json({ error: "采买请求状态已变化，请刷新后重试" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
