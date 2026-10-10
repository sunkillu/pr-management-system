import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const WRITE = ["ADMIN", "PR", "PR_MANAGER"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...WRITE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.makeupArtist.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "化妆师不存在" }, { status: 404 });
  const isLongTerm = body.isLongTerm ?? existing.isLongTerm;
  const onboardDate = body.onboardDate !== undefined
    ? body.onboardDate ? new Date(body.onboardDate) : null
    : existing.onboardDate;
  if (isLongTerm && !onboardDate) {
    return NextResponse.json({ error: "长期合作的化妆师必须填写入库日期" }, { status: 400 });
  }
  const updated = await prisma.makeupArtist.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim() || existing.name,
      contactInfo: body.contactInfo !== undefined ? body.contactInfo || null : undefined,
      isLongTerm,
      onboardDate,
      notes: body.notes !== undefined ? body.notes || null : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.makeupArtist.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "化妆师不存在" }, { status: 404 });
  await prisma.makeupArtist.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
