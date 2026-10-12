import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { parsePrizeItems } from "@/lib/lottery";

const ALL_ROLES = ["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"] as const;
const MANAGERS = ["ADMIN", "PR"] as const;

// 活动列表（全部角色可看）
export async function GET() {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const list = await prisma.lottery.findMany({
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { entries: true, winners: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(list);
}

// 创建活动（ADMIN/PR）
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...MANAGERS]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const prizes = parsePrizeItems(body.prizeItems);
  if (!title) return NextResponse.json({ error: "活动名称必填" }, { status: 400 });
  if (!prizes) return NextResponse.json({ error: "奖品列表不正确：每项需填写名称和数量（≥1）" }, { status: 400 });
  const created = await prisma.lottery.create({
    data: {
      title,
      description: body.description ? String(body.description) : null,
      prizeItems: prizes,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      createdById: auth.userId,
    },
  });
  return NextResponse.json(created);
}
