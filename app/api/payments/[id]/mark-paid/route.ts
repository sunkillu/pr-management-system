import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 标记已打款：财务（管理员兜底也有权限）。待打款 → 已打款。
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (existing.status !== "APPROVED") {
    return NextResponse.json({ error: "仅待打款的申请可标记已打款" }, { status: 400 });
  }
  const payment = await prisma.paymentRequest.update({
    where: { id: params.id },
    data: { status: "PAID" },
  });
  return NextResponse.json(payment);
}
