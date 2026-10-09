import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 提交审批：草稿 / 已驳回 → 待审批
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.content.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (!["DRAFT", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "当前状态不可提交审批" }, { status: 400 });
  }
  const content = await prisma.content.update({
    where: { id: params.id },
    data: { status: "PENDING", rejectReason: null },
  });
  return NextResponse.json(content);
}
