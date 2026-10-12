import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 删除打标签记录：本人删自己的；ADMIN 可删任何人的
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const rec = await prisma.tagging.findUnique({ where: { id: params.id } });
  if (!rec) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && rec.createdById !== auth.userId) {
    return NextResponse.json({ error: "只能删除自己打的标签" }, { status: 403 });
  }
  await prisma.tagging.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
