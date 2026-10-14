import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";
import { buildTicketTitle } from "@/lib/ticket-title";
import { nextTicketNumber } from "@/lib/ticket-number";
import { PURCHASE_PLATFORM_LABELS, PURCHASE_REVIEW_ROLES } from "@/lib/purchase-shared";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...PURCHASE_REVIEW_ROLES]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const assignments = Array.isArray(body?.assignments) ? body.assignments : null;
  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ error: "请至少提交一条分配记录" }, { status: 400 });
  }

  const lineIds = new Set<string>();
  let normalized: Array<{ lineId: string; assigneeId: string }>;
  try {
    normalized = assignments.map((item: Record<string, unknown>, index: number) => {
      const lineId = String(item?.lineId ?? "").trim();
      const assigneeId = String(item?.assigneeId ?? "").trim();
      if (!lineId || !assigneeId) {
        throw new Error(`第 ${index + 1} 条分配缺少 lineId 或 assigneeId`);
      }
      if (lineIds.has(lineId)) {
        throw new Error(`第 ${index + 1} 条重复选择了同一行`);
      }
      lineIds.add(lineId);
      return { lineId, assigneeId };
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "分配参数非法" },
      { status: 400 },
    );
  }

  const assignees = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(normalized.map((item) => item.assigneeId))) }, role: "PR" },
    select: { id: true, name: true },
  });
  if (assignees.length !== new Set(normalized.map((item) => item.assigneeId)).size) {
    return NextResponse.json({ error: "分配对象必须为 PR" }, { status: 400 });
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true } },
      lines: {
        orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sort: true,
          platform: true,
          link: true,
          style: true,
          quantity: true,
          status: true,
          influencerId: true,
          assigneeId: true,
          ticketId: true,
        },
      },
    },
  });
  if (!request) return NextResponse.json({ error: "采买请求不存在" }, { status: 404 });
  if (request.status !== "REVIEWED") {
    return NextResponse.json({ error: "仅待分配的采买请求可创建工单" }, { status: 400 });
  }

  const lineMap = new Map(request.lines.map((line) => [line.id, line]));
  for (const item of normalized) {
    if (!lineMap.has(item.lineId)) {
      return NextResponse.json({ error: "存在不属于该采买请求的行" }, { status: 400 });
    }
  }

  const invalidLine = normalized
    .map((item) => lineMap.get(item.lineId))
    .find((line) => !line || line.status !== "APPROVED" || !!line.ticketId);
  if (invalidLine) {
    return NextResponse.json({ error: "只能分配状态为已通过且未建单的行" }, { status: 409 });
  }

  const influencerIds = Array.from(
    new Set(
      normalized
        .map((item) => lineMap.get(item.lineId)?.influencerId)
        .filter((id): id is string => !!id),
    ),
  );
  const influencers = influencerIds.length > 0
    ? await prisma.influencer.findMany({ where: { id: { in: influencerIds } }, select: { id: true, name: true } })
    : [];
  const influencerMap = new Map(influencers.map((item) => [item.id, item]));
  const assigneeMap = new Map(assignees.map((item) => [item.id, item]));
  const now = new Date();

  let createdTickets: Array<{ lineId: string; ticketId: string; ticketNo: string; assigneeId: string }> = [];
  let requestMovedToAssigned = false;

  try {
    createdTickets = await prisma.$transaction(async (tx) => {
      const result: Array<{ lineId: string; ticketId: string; ticketNo: string; assigneeId: string }> = [];
      for (const item of normalized) {
        const line = lineMap.get(item.lineId)!;
        const assignee = assigneeMap.get(item.assigneeId)!;
        const influencer = line.influencerId ? influencerMap.get(line.influencerId) ?? null : null;
        const ticketNo = await nextTicketNumber(tx);
        const ticket = await tx.cooperationTicket.create({
          data: {
            ticketNo,
            ticketKind: "COOPERATION",
            status: "DRAFT",
            type: "INFLUENCER_POST",
            brandId: null,
            budgetFee: 0,
            platform: [line.platform],
            style: [line.style],
            coopCategory: [],
            estimatedSchedule: "",
            influencerId: line.influencerId,
            homepageId: null,
            note: `采买来源 ${request.requestNo}｜${PURCHASE_PLATFORM_LABELS[line.platform] ?? line.platform}｜${line.link}｜${line.style}×${line.quantity}`,
            creatorId: assignee.id,
            assigneeId: assignee.id,
            acceptedAt: now,
            title: buildTicketTitle({
              partnerName: influencer?.name ?? null,
              platforms: [line.platform],
              prName: assignee.name,
              fallback: line.link,
            }),
          },
        });
        await tx.ticketAssigneeLog.create({
          data: {
            ticketId: ticket.id,
            fromUserId: null,
            toUserId: assignee.id,
            changedById: auth.userId,
            action: "ASSIGN",
            reason: `采买请求 ${request.requestNo} 分配`,
          },
        });
        await writeLog(tx, {
          docType: "TICKET",
          docId: ticket.id,
          action: "CREATE",
          actorId: auth.userId,
          fromStatus: null,
          toStatus: "DRAFT",
          note: `由采买单 ${request.requestNo} 生成`,
        });
        const updated = await tx.purchaseLine.updateMany({
          where: { id: line.id, requestId: request.id, status: "APPROVED", ticketId: null },
          data: {
            status: "ASSIGNED",
            assigneeId: assignee.id,
            assignedAt: now,
            ticketId: ticket.id,
          },
        });
        if (updated.count !== 1) {
          throw new Error("CONFLICT");
        }
        await writeLog(tx, {
          docType: "PURCHASE_LINE",
          docId: line.id,
          action: "ASSIGN",
          actorId: auth.userId,
          fromStatus: "APPROVED",
          toStatus: "ASSIGNED",
          note: `分配给 ${assignee.name}，生成工单 ${ticket.ticketNo}`,
        });
        result.push({ lineId: line.id, ticketId: ticket.id, ticketNo: ticket.ticketNo, assigneeId: assignee.id });
      }

      const remainingApproved = await tx.purchaseLine.count({
        where: { requestId: request.id, status: "APPROVED" },
      });
      if (remainingApproved === 0) {
        const updated = await tx.purchaseRequest.updateMany({
          where: { id: request.id, status: "REVIEWED" },
          data: { status: "ASSIGNED", assignedAt: now },
        });
        if (updated.count !== 1) {
          throw new Error("CONFLICT");
        }
        await writeLog(tx, {
          docType: "PURCHASE",
          docId: request.id,
          action: "ASSIGN",
          actorId: auth.userId,
          fromStatus: "REVIEWED",
          toStatus: "ASSIGNED",
          note: `已为 ${result.length} 条采买行创建工单`,
        });
        requestMovedToAssigned = true;
      }
      return result;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return NextResponse.json({ error: "部分行状态已变化，请刷新后重试" }, { status: 409 });
    }
    throw error;
  }

  const grouped = new Map<string, { count: number; firstTicketId: string }>();
  for (const item of createdTickets) {
    const current = grouped.get(item.assigneeId);
    if (current) {
      current.count += 1;
    } else {
      grouped.set(item.assigneeId, { count: 1, firstTicketId: item.ticketId });
    }
  }

  await Promise.all(
    Array.from(grouped.entries()).map(async ([assigneeId, info]) => {
      try {
        await notifyUser(
          assigneeId,
          `你被分配了 ${info.count} 张工单，请补全信息并提交审批。`,
          { type: "TICKET", id: info.firstTicketId, title: "采买工单待补全", kind: "SYSTEM" },
        );
      } catch (error) {
        console.error("[purchase-request.assign.pr-notification]", { requestId: request.id, assigneeId, error });
      }
    }),
  );

  try {
    await notifyUser(
      request.creatorId,
      `采买请求 ${request.requestNo} 已分配并生成 ${createdTickets.length} 张工单。`,
      { type: "PURCHASE", id: request.id, title: requestMovedToAssigned ? "采买请求已分配" : "采买请求部分已分配", kind: "SYSTEM" },
    );
  } catch (error) {
    console.error("[purchase-request.assign.creator-notification]", { requestId: request.id, error });
  }

  return NextResponse.json(createdTickets);
}
