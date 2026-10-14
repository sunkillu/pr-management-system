import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 按种类取标签（全部角色可读）
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("categoryKey");
  const categoryId = searchParams.get("categoryId");
  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  else if (key) where.category = { key };
  const list = await prisma.tag.findMany({
    where,
    include: { category: { select: { name: true, key: true } } },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(list);
}

// 新增标签（仅 ADMIN）
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const categoryId = String(body.categoryId ?? "");
  if (!name) return NextResponse.json({ error: "请填写标签名" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "请选择标签种类" }, { status: 400 });
  const cat = await prisma.tagCategory.findUnique({ where: { id: categoryId } });
  if (!cat) return NextResponse.json({ error: "标签种类不存在" }, { status: 404 });
  const dup = await prisma.tag.findUnique({ where: { categoryId_name: { categoryId, name } } });
  if (dup) return NextResponse.json({ error: "该种类下已有同名标签" }, { status: 400 });
  const created = await prisma.tag.create({
    data: { name, categoryId, sort: Number(body.sort ?? 0) },
  });
  return NextResponse.json(created, { status: 201 });
}
