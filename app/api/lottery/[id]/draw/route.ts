import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import type { PrizeItem } from "@/lib/lottery";

const MANAGERS = ["ADMIN", "PR"] as const;

// Fisher-Yates 洗牌
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 开奖（ADMIN/PR；仅进行中、仅一次；开奖后活动自动结束）
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...MANAGERS]);
  if (!auth.ok) return auth.res;
  const lottery = await prisma.lottery.findUnique({
    where: { id: params.id },
    include: { _count: { select: { entries: true, winners: true } } },
  });
  if (!lottery) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (lottery.status !== "ACTIVE") {
    return NextResponse.json({ error: "仅进行中的活动可开奖" }, { status: 400 });
  }
  if (lottery._count.winners > 0) {
    return NextResponse.json({ error: "已开过奖，不可重复" }, { status: 409 });
  }
  if (lottery._count.entries === 0) {
    return NextResponse.json({ error: "暂无参与者，无法开奖" }, { status: 400 });
  }
  const prizes = lottery.prizeItems as unknown as PrizeItem[];
  const pool = shuffle(
    (await prisma.lotteryEntry.findMany({ where: { lotteryId: params.id }, select: { id: true } })).map((e) => e.id)
  );
  const winnerRows: { lotteryId: string; entryId: string; prizeName: string; drawnById: string }[] = [];
  for (const p of prizes) {
    for (let i = 0; i < p.quantity && pool.length > 0; i++) {
      winnerRows.push({ lotteryId: params.id, entryId: pool.pop() as string, prizeName: p.name, drawnById: auth.userId });
    }
  }
  await prisma.$transaction([
    prisma.lotteryWinner.createMany({ data: winnerRows }),
    prisma.lottery.update({ where: { id: params.id }, data: { status: "ENDED" } }),
  ]);
  const winners = await prisma.lotteryWinner.findMany({
    where: { lotteryId: params.id },
    include: { entry: { select: { name: true, contact: true } } },
    orderBy: { drawnAt: "asc" },
  });
  return NextResponse.json({ winners, total: winnerRows.length });
}
