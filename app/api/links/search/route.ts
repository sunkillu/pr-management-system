import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 关联单据搜索：type=CONTENT|PAYMENT，q=标题关键字，返回 id/标题/状态（供关联选择器用）
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const q = (searchParams.get("q") || "").trim();
  if (type !== "CONTENT" && type !== "PAYMENT") {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }
  if (type === "CONTENT") {
    const rows = await prisma.content.findMany({
      where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return NextResponse.json(rows);
  }
  const rows = await prisma.paymentRequest.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return NextResponse.json(rows);
}
