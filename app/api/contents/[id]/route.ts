import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 编辑内容：仅草稿 / 已驳回可编辑；保存后版本号 +1 并回到草稿
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.content.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (!["DRAFT", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "仅草稿 / 已驳回的内容可编辑" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  const content = await prisma.content.update({
    where: { id: params.id },
    data: {
      title: body.title.trim(),
      type: body.type,
      body: body.body || null,
      outletId: body.outletId || null,
      version: { increment: 1 },
      status: "DRAFT",
      rejectReason: null,
    },
  });
  return NextResponse.json(content);
}

// 删除：运营 / 管理员
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  await prisma.content.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
