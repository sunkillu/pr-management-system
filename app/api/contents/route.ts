import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 新建内容：运营 / 管理员，初始为草稿
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  const content = await prisma.content.create({
    data: {
      title: body.title.trim(),
      type: body.type ?? "CAO_TEXT",
      body: body.body || null,
      outletId: body.outletId || null,
      status: "DRAFT",
    },
  });
  return NextResponse.json(content, { status: 201 });
}
