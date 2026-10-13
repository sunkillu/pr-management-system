import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 品牌列表（所有登录用户可见，用于表单选择）
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "1";
  const brands = await prisma.brand.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { name: "asc" },
  });
  return NextResponse.json(brands);
}

// 新增品牌：仅管理员
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "品牌名称不能为空" }, { status: 400 });
  try {
    const brand = await prisma.brand.create({ data: { name } });
    return NextResponse.json(brand, { status: 201 });
  } catch {
    return NextResponse.json({ error: "品牌已存在" }, { status: 400 });
  }
}
