import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 新建用户：仅管理员
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "邮箱不能为空" }, { status: 400 });
  if (!body.password || String(body.password).length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }
  if (!["ADMIN", "OPERATOR", "FINANCE", "VIEWER"].includes(body.role)) {
    return NextResponse.json({ error: "角色非法" }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "该邮箱已注册" }, { status: 400 });

  const user = await prisma.user.create({
    data: {
      name: body.name.trim(),
      email,
      passwordHash: await bcrypt.hash(String(body.password), 10),
      role: body.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
