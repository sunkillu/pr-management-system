import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 推荐分配 PR：对采买工单的每条 item，按款式查 PR 的历史合作。
// 历史来源 = CooperationTicket（ticketKind=COOPERATION，style 包含该款式，
// assigneeId / creatorId 为该 PR），按最近一次合作时间倒序推荐。
// CooperationRecord 无款式字段，无法按款式过滤，不作为推荐依据。
// 返回：{ items: [{ itemId, style, recommended: [{prId, prName, lastCoopAt}], uncooperated: [{prId, prName}] }] }
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: { id: true, ticketKind: true },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "PROCUREMENT") {
    return NextResponse.json({ error: "仅采买工单可推荐分配" }, { status: 400 });
  }

  const [items, prs] = await Promise.all([
    prisma.procurementItem.findMany({
      where: { ticketId: params.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "PR" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const prIds = prs.map((p) => p.id);
  const prName = new Map(prs.map((p) => [p.id, p.name]));

  // 该批款式的历史合作：一次查询，按款式 + PR 聚合最近一次时间
  const styles = Array.from(new Set(items.map((it) => it.style)));
  const history = styles.length > 0
    ? await prisma.cooperationTicket.findMany({
        where: {
          ticketKind: "COOPERATION",
          style: { hasSome: styles },
          OR: [{ assigneeId: { in: prIds } }, { creatorId: { in: prIds } }],
        },
        select: { style: true, assigneeId: true, creatorId: true, updatedAt: true },
      })
    : [];
  // lastCoop[style][prId] = 最近一次合作时间
  const lastCoop = new Map<string, Map<string, Date>>();
  for (const h of history) {
    for (const s of h.style) {
      if (!styles.includes(s)) continue;
      const byPr = lastCoop.get(s) ?? new Map<string, Date>();
      for (const pid of [h.assigneeId, h.creatorId]) {
        if (!pid || !prName.has(pid)) continue;
        const prev = byPr.get(pid);
        if (!prev || h.updatedAt > prev) byPr.set(pid, h.updatedAt);
      }
      lastCoop.set(s, byPr);
    }
  }

  return NextResponse.json({
    items: items.map((it) => {
      const byPr = lastCoop.get(it.style) ?? new Map<string, Date>();
      const recommended = Array.from(byPr.entries())
        .sort((a, b) => b[1].getTime() - a[1].getTime())
        .map(([prId, lastCoopAt]) => ({ prId, prName: prName.get(prId) ?? "", lastCoopAt: lastCoopAt.toISOString() }));
      const uncooperated = prs
        .filter((p) => !byPr.has(p.id))
        .map((p) => ({ prId: p.id, prName: p.name }));
      return {
        itemId: it.id,
        style: it.style,
        status: it.status,
        quantity: it.quantity,
        approvedQty: it.approvedQty,
        allocatedTicketId: it.allocatedTicketId,
        recommended,
        uncooperated,
      };
    }),
  });
}
