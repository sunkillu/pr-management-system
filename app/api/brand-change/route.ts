import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 品牌手动修改（需填原因，写入审计日志）
// targetType: TICKET / SAMPLE / PAYMENT / MATERIAL / DATA_TASK
const TARGETS = {
  TICKET: { model: "cooperationTicket" },
  SAMPLE: { model: "sampleShipment" },
  PAYMENT: { model: "paymentRequest" },
  MATERIAL: { model: "materialRecord" },
  DATA_TASK: { model: "dataCollectionTask" },
} as const;

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "FINANCE", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const targetType = String(body.targetType ?? "").trim() as keyof typeof TARGETS;
  const targetId = String(body.targetId ?? "").trim();
  const newBrandId = String(body.newBrandId ?? "").trim();
  const reason = String(body.reason ?? "").trim();

  if (!TARGETS[targetType]) return NextResponse.json({ error: "targetType 非法" }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "targetId 不能为空" }, { status: 400 });
  if (!newBrandId) return NextResponse.json({ error: "请选择新品牌" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "修改原因必填" }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: newBrandId, isActive: true } });
  if (!brand) return NextResponse.json({ error: "品牌不存在或已停用" }, { status: 400 });

  const model = TARGETS[targetType].model;
  const existing = await (prisma[model] as any).findUnique({
    where: { id: targetId },
    select: { id: true, brandId: true },
  });
  if (!existing) return NextResponse.json({ error: "目标记录不存在" }, { status: 404 });
  if (existing.brandId === newBrandId) {
    return NextResponse.json({ error: "品牌未变化" }, { status: 400 });
  }

  const oldBrand = existing.brandId
    ? await prisma.brand.findUnique({ where: { id: existing.brandId }, select: { name: true } })
    : null;

  await prisma.$transaction(async (tx) => {
    await (tx[model] as any).update({
      where: { id: targetId },
      data: { brandId: newBrandId },
    });
    await tx.brandChangeLog.create({
      data: {
        targetType,
        targetId,
        oldBrandId: existing.brandId,
        newBrandId,
        changedById: auth.userId,
        reason,
      },
    });
    await writeLog(tx, {
      docType: targetType === "TICKET" ? "TICKET" : targetType === "SAMPLE" ? "SAMPLE" : "PAYMENT",
      docId: targetId,
      action: "EDIT",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: null,
      note: `品牌变更：${oldBrand?.name ?? "（无）"} → ${brand.name}，原因：${reason}`,
    });
  });

  return NextResponse.json({ ok: true });
}

// 查询某目标的品牌变更记录
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType") ?? "";
  const targetId = searchParams.get("targetId") ?? "";
  if (!targetType || !targetId) return NextResponse.json({ error: "参数缺失" }, { status: 400 });

  const logs = await prisma.brandChangeLog.findMany({
    where: { targetType, targetId },
    include: {
      oldBrand: { select: { name: true } },
      newBrand: { select: { name: true } },
      changedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      oldBrandName: l.oldBrand?.name ?? null,
      newBrandName: l.newBrand?.name ?? null,
      changedByName: l.changedBy.name,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    }))
  );
}
