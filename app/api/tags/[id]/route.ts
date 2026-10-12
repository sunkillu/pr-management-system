import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 改名/排序（仅 ADMIN）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "请填写标签名" }, { status: 400 });
    data.name = name;
  }
  if (body.sort !== undefined) data.sort = Number(body.sort ?? 0);
  try {
    const updated = await prisma.tag.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "标签不存在或重名" }, { status: 400 });
  }
}

// 删除标签（仅 ADMIN；素材/达人存的是 id/名快照，不级联影响）
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  await prisma.tag.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
