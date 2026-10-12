import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ALL_ROLES = ["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"] as const;

// 参与名单（全部角色可看）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const list = await prisma.lotteryEntry.findMany({
    where: { lotteryId: params.id },
    include: { influencer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(list);
}

// 参与登记（全部角色；仅进行中可报名）
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const lottery = await prisma.lottery.findUnique({ where: { id: params.id } });
  if (!lottery) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (lottery.status !== "ACTIVE") {
    return NextResponse.json({ error: "仅进行中的活动可参与" }, { status: 400 });
  }
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const contact = body.contact ? String(body.contact).trim() : null;
  const influencerId = body.influencerId ? String(body.influencerId) : null;
  if (!name) return NextResponse.json({ error: "姓名必填" }, { status: 400 });
  if (influencerId) {
    const inf = await prisma.influencer.findUnique({ where: { id: influencerId } });
    if (!inf) return NextResponse.json({ error: "关联达人不存在" }, { status: 400 });
  }
  const dup = await prisma.lotteryEntry.findFirst({
    where: { lotteryId: params.id, name, contact },
  });
  if (dup) return NextResponse.json({ error: "该参与者已登记，请勿重复" }, { status: 409 });
  const created = await prisma.lotteryEntry.create({
    data: { lotteryId: params.id, influencerId, name, contact },
  });
  return NextResponse.json(created);
}
