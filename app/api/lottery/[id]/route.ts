import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { parsePrizeItems } from "@/lib/lottery";

const ALL_ROLES = ["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"] as const;
const MANAGERS = ["ADMIN", "PR"] as const;
const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["ENDED"],
  ENDED: [],
};

// 活动详情（全部角色可看）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const lottery = await prisma.lottery.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      winners: {
        include: {
          entry: { select: { id: true, name: true, contact: true } },
          drawnBy: { select: { name: true } },
        },
        orderBy: { drawnAt: "asc" },
      },
      _count: { select: { entries: true } },
    },
  });
  if (!lottery) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  return NextResponse.json(lottery);
}

// 编辑活动（ADMIN/PR；已结束不可改）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...MANAGERS]);
  if (!auth.ok) return auth.res;
  const lottery = await prisma.lottery.findUnique({ where: { id: params.id } });
  if (!lottery) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (lottery.status === "ENDED") {
    return NextResponse.json({ error: "已结束的活动不可修改" }, { status: 400 });
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "活动名称不能为空" }, { status: 400 });
    data.title = title;
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.prizeItems !== undefined) {
    const prizes = parsePrizeItems(body.prizeItems);
    if (!prizes) return NextResponse.json({ error: "奖品列表不正确" }, { status: 400 });
    data.prizeItems = prizes;
  }
  if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.status !== undefined) {
    const next = String(body.status);
    if (!STATUS_FLOW[lottery.status].includes(next)) {
      return NextResponse.json({ error: `状态不能从 ${lottery.status} 流转到 ${next}` }, { status: 400 });
    }
    data.status = next;
  }
  const updated = await prisma.lottery.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}
