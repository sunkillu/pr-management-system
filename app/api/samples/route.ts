import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const WRITE = ["ADMIN", "PR", "PR_MANAGER"] as const;

// 列表：所有登录用户可查，支持搜索 / 状态筛选
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status");
  const list = await prisma.sampleShipment.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { productName: { contains: q, mode: "insensitive" as const } },
              { trackingNo: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      influencer: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

// 寄品登记：产品名称必填
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...WRITE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.productName?.trim()) {
    return NextResponse.json({ error: "产品名称不能为空" }, { status: 400 });
  }
  const sample = await prisma.sampleShipment.create({
    data: {
      influencerId: body.influencerId || null,
      productName: body.productName.trim(),
      quantity: Number(body.quantity) > 0 ? Number(body.quantity) : 1,
      courier: body.courier?.trim() || null,
      trackingNo: body.trackingNo || null,
      shippedDate: body.shippedDate ? new Date(body.shippedDate) : null,
      shippedBy: body.shippedBy?.trim() || null,
      status: body.status ?? "SHIPPED",
      createdById: auth.userId,
    },
  });
  return NextResponse.json(sample, { status: 201 });
}
