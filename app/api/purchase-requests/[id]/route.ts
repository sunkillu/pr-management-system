import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { PURCHASE_VIEW_ROLES, canViewPurchaseRequest, sumQuantities } from "@/lib/purchase-shared";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...PURCHASE_VIEW_ROLES]);
  if (!auth.ok) return auth.res;

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
          reviewedAt: true,
          reviewNote: true,
          influencerId: true,
          assigneeId: true,
          assignedAt: true,
          ticketId: true,
          createdAt: true,
          updatedAt: true,
          reviewedBy: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          ticket: { select: { id: true, ticketNo: true, title: true } },
        },
      },
    },
  });
  if (!request) {
    return NextResponse.json({ error: "采买请求不存在" }, { status: 404 });
  }
  if (!canViewPurchaseRequest(auth.role, auth.userId, request.creatorId)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const logs = await prisma.approvalLog.findMany({
    where: {
      OR: [
        { docType: "PURCHASE", docId: request.id },
        { docType: "PURCHASE_LINE", docId: { in: request.lines.map((line) => line.id) } },
      ],
    },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    id: request.id,
    requestNo: request.requestNo,
    status: request.status,
    note: request.note,
    creatorId: request.creatorId,
    creator: request.creator,
    lineCount: request.lines.length,
    totalQuantity: sumQuantities(request.lines),
    reviewedAt: request.reviewedAt,
    assignedAt: request.assignedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    lines: request.lines,
    history: logs.map((log) => ({
      id: log.id,
      docType: log.docType,
      docId: log.docId,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      note: log.note,
      createdAt: log.createdAt,
      actor: log.actor ? { id: log.actor.id, name: log.actor.name } : null,
    })),
  });
}
