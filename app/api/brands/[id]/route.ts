import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 更新品牌（改名/启用停用）：仅管理员
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "品牌名称不能为空" }, { status: 400 });
    data.name = name;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  try {
    const brand = await prisma.$transaction(async (tx) => {
      const current = await tx.brand.findUniqueOrThrow({ where: { id: params.id } });
      const updated = await tx.brand.update({ where: { id: params.id }, data });
      if (current.isActive !== updated.isActive) {
        await writeLog(tx, {
          docType: "BRAND",
          docId: updated.id,
          action: "EDIT",
          actorId: auth.userId,
          fromStatus: String(current.isActive),
          toStatus: String(updated.isActive),
        });
      }
      return updated;
    });
    return NextResponse.json(brand);
  } catch {
    return NextResponse.json({ error: "品牌不存在或名称重复" }, { status: 400 });
  }
}

// 删除品牌：仅管理员；有关联工单时禁止删除
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const count = await prisma.cooperationTicket.count({ where: { brandId: params.id } });
  if (count > 0) {
    return NextResponse.json({ error: `该品牌下有 ${count} 张工单，不可删除` }, { status: 400 });
  }
  await prisma.brand.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
