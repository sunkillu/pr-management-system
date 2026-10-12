import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 标签种类列表（全部角色可读，用于打标签）
export async function GET() {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const list = await prisma.tagCategory.findMany({
    include: { tags: { orderBy: [{ sort: "asc" }, { name: "asc" }] } },
    orderBy: { sort: "asc" },
  });
  return NextResponse.json(list);
}

// 新增标签种类（仅 ADMIN）
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const key = String(body.key ?? "").trim().toUpperCase();
  if (!name) return NextResponse.json({ error: "请填写种类名称" }, { status: 400 });
  if (!key || !/^[A-Z0-9_]+$/.test(key)) {
    return NextResponse.json({ error: "key 只能用大写字母、数字、下划线" }, { status: 400 });
  }
  const exists = await prisma.tagCategory.findUnique({ where: { key } });
  if (exists) return NextResponse.json({ error: "该 key 已存在" }, { status: 400 });
  const created = await prisma.tagCategory.create({
    data: { name, key, sort: Number(body.sort ?? 0) },
  });
  return NextResponse.json(created, { status: 201 });
}
