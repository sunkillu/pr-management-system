import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

async function getOwned(id: string, userId: string, role: string) {
  const entry = await prisma.influencerLedger.findUnique({ where: { id } });
  if (!entry) return null;
  if (role !== "ADMIN" && entry.ownerId !== userId) return null;
  return entry;
}

// 补充资料（仅 DRAFT 可编辑）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const entry = await getOwned(params.id, auth.userId, auth.role);
  if (!entry) return NextResponse.json({ error: "不存在或无权限" }, { status: 404 });
  if (entry.status !== "DRAFT")
    return NextResponse.json({ error: "已入库的台账不可编辑" }, { status: 400 });

  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (b.nickname !== undefined) data.nickname = String(b.nickname).slice(0, 100);
  if (b.platforms !== undefined)
    data.platforms = (Array.isArray(b.platforms) ? b.platforms : [])
      .filter((p: unknown) => ["XIAOHONGSHU", "DOUYIN"].includes(String(p)));
  if (b.photoUrl !== undefined) data.photoUrl = String(b.photoUrl).slice(0, 500) || null;
  if (b.budget !== undefined) data.budget = b.budget === "" || b.budget == null ? null : Number(b.budget);
  if (b.schedule !== undefined) data.schedule = String(b.schedule).slice(0, 200) || null;
  if (b.quote !== undefined) data.quote = b.quote === "" || b.quote == null ? null : Number(b.quote);
  if (b.sampleInfo !== undefined) data.sampleInfo = b.sampleInfo;

  const updated = await prisma.influencerLedger.update({ where: { id: params.id }, data });
  return NextResponse.json({ entry: updated });
}

// 删除草稿
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const entry = await getOwned(params.id, auth.userId, auth.role);
  if (!entry) return NextResponse.json({ error: "不存在或无权限" }, { status: 404 });
  if (entry.status !== "DRAFT")
    return NextResponse.json({ error: "已入库的台账不可删除" }, { status: 400 });

  await prisma.influencerLedger.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
