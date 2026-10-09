import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 标记已发布：已通过 → 已发布
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.content.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (existing.status !== "APPROVED") {
    return NextResponse.json({ error: "仅已通过的内容可标记发布" }, { status: 400 });
  }
  const content = await prisma.content.update({
    where: { id: params.id },
    data: { status: "PUBLISHED" },
  });
  return NextResponse.json(content);
}
