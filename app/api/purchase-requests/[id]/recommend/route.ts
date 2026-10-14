import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { formatDate } from "@/lib/labels";
import { matchInfluencerByPlatformLink } from "@/lib/purchase-match";
import { recommendAssignees, type PrHistory } from "@/lib/purchase-recommend";
import { PURCHASE_PLATFORM_LABELS, PURCHASE_REVIEW_ROLES } from "@/lib/purchase-shared";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...PURCHASE_REVIEW_ROLES]);
  if (!auth.ok) return auth.res;

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        where: { status: "APPROVED", ticketId: null },
        orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sort: true,
          platform: true,
          link: true,
          style: true,
          quantity: true,
          influencerId: true,
        },
      },
    },
  });
  if (!request) return NextResponse.json({ error: "采买请求不存在" }, { status: 404 });
  if (request.lines.length === 0) {
    return NextResponse.json({ error: "没有待分配的通过行" }, { status: 400 });
  }

  const [prs, influencers] = await Promise.all([
    prisma.user.findMany({ where: { role: "PR" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.influencer.findMany({
      select: { id: true, name: true, homepageId: true, xhsUrl: true, douyinUrl: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
  ]);

  if (prs.length === 0) {
    return NextResponse.json({ error: "没有可分配的 PR" }, { status: 400 });
  }

  const matchedLines = request.lines.map((line) => {
    const influencer = matchInfluencerByPlatformLink(line.platform, line.link, influencers);
    return { line, influencer };
  });

  const matchedInfluencerIds = Array.from(
    new Set(matchedLines.map((item) => item.influencer?.id).filter((id): id is string => !!id)),
  );

  const historyTickets = matchedInfluencerIds.length > 0
    ? await prisma.cooperationTicket.findMany({
        where: {
          influencerId: { in: matchedInfluencerIds },
          status: { not: "VOIDED" },
        },
        select: {
          influencerId: true,
          assigneeId: true,
          creatorId: true,
          createdAt: true,
          confirmedDate: true,
          publishDate: true,
          assignee: { select: { role: true } },
          creator: { select: { role: true } },
        },
      })
    : [];

  const historyMap = new Map<string, Map<string, Date>>();
  for (const ticket of historyTickets) {
    if (!ticket.influencerId) continue;
    const chosenUser = ticket.assigneeId
      ? (ticket.assignee?.role === "PR" ? ticket.assigneeId : null)
      : ticket.creator.role === "PR"
        ? ticket.creatorId
        : null;
    if (!chosenUser) continue;
    const lastAt = ticket.publishDate ?? ticket.confirmedDate ?? ticket.createdAt;
    const byPr = historyMap.get(ticket.influencerId) ?? new Map<string, Date>();
    const previous = byPr.get(chosenUser);
    if (!previous || previous.getTime() < lastAt.getTime()) {
      byPr.set(chosenUser, lastAt);
    }
    historyMap.set(ticket.influencerId, byPr);
  }

  const history: PrHistory = {};
  Array.from(historyMap.entries()).forEach(([influencerId, byPr]) => {
    history[influencerId] = Array.from(byPr.entries()).map(([prId, lastAt]) => ({ prId, lastAt }));
  });

  let recommendations;
  try {
    recommendations = recommendAssignees(
      matchedLines.map((item) => ({
        id: item.line.id,
        quantity: item.line.quantity,
        influencerId: item.influencer?.id ?? null,
      })),
      prs,
      history,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "推荐分配失败" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      matchedLines.map((item) =>
        tx.purchaseLine.updateMany({
          where: { id: item.line.id, requestId: params.id, status: "APPROVED", ticketId: null },
          data: { influencerId: item.influencer?.id ?? null },
        }),
      ),
    );
  });

  const prMap = new Map(prs.map((pr) => [pr.id, pr]));
  const matchMap = new Map(matchedLines.map((item) => [item.line.id, item]));

  return NextResponse.json({
    prs,
    recommendations: recommendations.map((item) => {
      const pr = prMap.get(item.prId);
      const matched = matchMap.get(item.lineId);
      const influencer = matched?.influencer ?? null;
      return {
        lineId: item.lineId,
        prId: item.prId,
        prName: pr?.name ?? item.prId,
        reason: item.reason,
        reasonText:
          item.reason === "HISTORY" && item.lastCooperationAt
            ? `最近合作 ${formatDate(item.lastCooperationAt)}`
            : "未合作过，按数量均衡随机分配",
        influencerId: influencer?.id ?? null,
        influencerName: influencer?.name ?? null,
        platformLabel: matched ? PURCHASE_PLATFORM_LABELS[matched.line.platform] ?? matched.line.platform : null,
      };
    }),
  });
}
