import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 更新用户：仅管理员（密码留空则不修改）
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  if (!["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"].includes(body.role)) {
    return NextResponse.json({ error: "角色非法" }, { status: 400 });
  }
  const data: Record<string, unknown> = { name: body.name.trim(), role: body.role };
  if (body.feishuUserId !== undefined) data.feishuUserId = body.feishuUserId?.trim() || null;
  if (body.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(String(body.password), 10);
  }
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json(user);
}

// 删除用户：仅管理员，不能删除自己
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  if (params.id === auth.userId) {
    return NextResponse.json({ error: "不能删除自己的账号" }, { status: 400 });
  }
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
