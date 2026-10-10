import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const WRITE = ["ADMIN", "PR", "PR_MANAGER"] as const;

// 列表：所有登录用户可查
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const longTerm = searchParams.get("longTerm");
  const list = await prisma.makeupArtist.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(longTerm === "1" ? { isLongTerm: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(list);
}

// 入库：长期合作的化妆师必须入库（isLongTerm=true 时入库日期必填）
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...WRITE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "化妆师姓名不能为空" }, { status: 400 });
  }
  const isLongTerm = !!body.isLongTerm;
  if (isLongTerm && !body.onboardDate) {
    return NextResponse.json({ error: "长期合作的化妆师必须填写入库日期" }, { status: 400 });
  }
  const artist = await prisma.makeupArtist.create({
    data: {
      name: body.name.trim(),
      contactInfo: body.contactInfo || null,
      isLongTerm,
      onboardDate: body.onboardDate ? new Date(body.onboardDate) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(artist, { status: 201 });
}
