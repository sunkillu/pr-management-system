import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 改名（仅 ADMIN）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "请填写种类名称" }, { status: 400 });
    data.name = name;
  }
  if (body.sort !== undefined) data.sort = Number(body.sort ?? 0);
  const updated = await prisma.tagCategory.update({
    where: { id: params.id },
    data,
  }).catch(() => null);
  if (!updated) return NextResponse.json({ error: "种类不存在" }, { status: 404 });
  return NextResponse.json(updated);
}

// 删除种类（仅 ADMIN，级联删标签）
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  await prisma.tagCategory.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
