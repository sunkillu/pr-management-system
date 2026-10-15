import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

const MANAGE = ["ADMIN", "PR_MANAGER"] as const;

// 改名 / 启用停用。改名会同步更新已使用该款式的工单，保证历史数据不丢
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...MANAGE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const data: { name?: string; isActive?: boolean; shelfLifeOptions?: string[] } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "款式名称不能为空" }, { status: 400 });
    if (name.length > 50) return NextResponse.json({ error: "款式名称不能超过 50 个字" }, { status: 400 });
    data.name = name;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.shelfLifeOptions !== undefined) {
    const values: unknown[] = Array.isArray(body.shelfLifeOptions) ? body.shelfLifeOptions : String(body.shelfLifeOptions ?? "").split(/[、,，\n]/);
    const shelfLifeOptions = Array.from(new Set(values.map((item: unknown) => String(item).trim()).filter((item): item is string => Boolean(item)))).slice(0, 20);
    if (shelfLifeOptions.length === 0) return NextResponse.json({ error: "至少配置一个抛期" }, { status: 400 });
    data.shelfLifeOptions = shelfLifeOptions;
  }

  try {
    const style = await prisma.$transaction(async (tx) => {
      const current = await tx.styleOption.findUniqueOrThrow({ where: { id: params.id } });
      const updated = await tx.styleOption.update({ where: { id: params.id }, data });
      if (updated.name !== current.name) {
        await tx.$executeRaw`UPDATE "CooperationTicket" SET "style" = array_replace("style", ${current.name}, ${updated.name}) WHERE ${current.name} = ANY("style")`;
        await tx.$executeRaw`UPDATE "MaterialRecord" SET "style" = array_replace("style", ${current.name}, ${updated.name}) WHERE ${current.name} = ANY("style")`;
        await writeLog(tx, {
          docType: "STYLE",
          docId: updated.id,
          action: "EDIT",
          actorId: auth.userId,
          note: `改名：${current.name} → ${updated.name}`,
        });
      }
      if (updated.isActive !== current.isActive) {
        await writeLog(tx, {
          docType: "STYLE",
          docId: updated.id,
          action: "EDIT",
          actorId: auth.userId,
          fromStatus: current.isActive ? "ENABLED" : "DISABLED",
          toStatus: updated.isActive ? "ENABLED" : "DISABLED",
        });
      }
      return updated;
    });
    return NextResponse.json(style);
  } catch {
    return NextResponse.json({ error: "款式不存在或名称重复" }, { status: 400 });
  }
}

// 删除：被工单使用过的款式只能停用，不能删除
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...MANAGE]);
  if (!auth.ok) return auth.res;
  const current = await prisma.styleOption.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "款式不存在" }, { status: 404 });
  const used = await prisma.cooperationTicket.count({ where: { style: { has: current.name } } });
  if (used > 0) {
    return NextResponse.json({ error: `该款式已被 ${used} 张工单使用，请改为停用` }, { status: 400 });
  }
  await prisma.$transaction(async (tx) => {
    await tx.styleOption.delete({ where: { id: params.id } });
    await writeLog(tx, {
      docType: "STYLE",
      docId: params.id,
      action: "EDIT",
      actorId: auth.userId,
      fromStatus: current.isActive ? "ENABLED" : "DISABLED",
      toStatus: "DELETED",
      note: `删除款式「${current.name}」`,
    });
  });
  return NextResponse.json({ ok: true });
}
