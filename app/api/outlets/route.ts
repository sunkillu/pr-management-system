import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 列表：所有登录用户可查
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type");
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  const outlets = await prisma.mediaOutlet.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(type ? { type: type as never } : {}),
      ...(platform ? { platform: platform as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(outlets);
}

// 新建：运营 / 管理员
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  }
  const outlet = await prisma.mediaOutlet.create({
    data: {
      name: body.name.trim(),
      type: body.type,
      platform: body.platform,
      followers: Number(body.followers) || 0,
      contactName: body.contactName || null,
      contactInfo: body.contactInfo || null,
      priceQuote: body.priceQuote ?? null,
      rating: body.rating != null && body.rating !== "" ? Number(body.rating) : null,
      notes: body.notes || null,
      status: body.status ?? "ACTIVE",
    },
  });
  return NextResponse.json(outlet, { status: 201 });
}
