import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";
import { PURCHASE_REVIEW_ROLES } from "@/lib/purchase-shared";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...PURCHASE_REVIEW_ROLES]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const decisions = Array.isArray(body?.decisions) ? body.decisions : null;
  if (!decisions || decisions.length === 0) {
    return NextResponse.json({ error: "请至少提交一条审批决定" }, { status: 400 });
  }

  const lineIds = new Set<string>();
  let normalized: Array<{ lineId: string; action: "APPROVE" | "REJECT"; note: string | null }>;
  try {
    normalized = decisions.map((item: Record<string, unknown>, index: number) => {
      const lineId = String(item?.lineId ?? "").trim();
      const action = String(item?.action ?? "").trim().toUpperCase();
      const note = String(item?.note ?? "").trim() || null;
      if (!lineId) throw new Error(`第 ${index + 1} 条缺少 lineId`);
      if (lineIds.has(lineId)) throw new Error(`第 ${index + 1} 条重复选择了同一行`);
      lineIds.add(lineId);
      if (!["APPROVE", "REJECT"].includes(action)) throw new Error(`第 ${index + 1} 条 action 非法`);
      if (action === "REJECT" && !note) throw new Error(`第 ${index + 1} 条驳回必须填写理由`);
      return { lineId, action: action as "APPROVE" | "REJECT", note };
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "审批参数非法" },
      { status: 400 },
    );
  }

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.id },
    include: {
      lines: {
        orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
        select: { id: true, sort: true, status: true, platform: true, style: true, quantity: true, link: true },
      },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!request) return NextResponse.json({ error: "采买请求不存在" }, { status: 404 });
  if (request.status !== "PENDING_REVIEW") {
    return NextResponse.json({ error: "仅待审批的采买请求可处理" }, { status: 400 });
  }

  const lineMap = new Map(request.lines.map((line) => [line.id, line]));
  for (const decision of normalized) {
    if (!lineMap.has(decision.lineId)) {
      return NextResponse.json({ error: "存在不属于该采买请求的行" }, { status: 400 });
    }
  }

  const handledLines = normalized
    .map((decision) => lineMap.get(decision.lineId))
    .filter((line): line is NonNullable<typeof line> => !!line)
    .filter((line) => line.status !== "PENDING");
  if (handledLines.length > 0) {
    return NextResponse.json(
      { error: `以下行已处理，无法重复审批：${handledLines.map((line) => line.sort + 1).join("、")}` },
      { status: 409 },
    );
  }

  const now = new Date();
  let finalizedSummary: { approved: number; rejected: number; status: "REVIEWED" | "REJECTED" } | null = null;

  try {
    finalizedSummary = await prisma.$transaction(async (tx) => {
      for (const decision of normalized) {
        const nextStatus = decision.action === "APPROVE" ? "APPROVED" : "REJECTED";
        const result = await tx.purchaseLine.updateMany({
          where: { id: decision.lineId, requestId: params.id, status: "PENDING" },
          data: {
            status: nextStatus,
            reviewedById: auth.userId,
            reviewedAt: now,
            reviewNote: decision.note,
          },
        });
        if (result.count !== 1) {
          throw new Error("CONFLICT");
        }
        await writeLog(tx, {
          docType: "PURCHASE_LINE",
          docId: decision.lineId,
          action: decision.action,
          actorId: auth.userId,
          fromStatus: "PENDING",
          toStatus: nextStatus,
          note: decision.note,
        });
      }

      const allLines = await tx.purchaseLine.findMany({
        where: { requestId: params.id },
        select: { id: true, status: true },
      });
      const pendingCount = allLines.filter((line) => line.status === "PENDING").length;
      if (pendingCount === 0) {
        const approved = allLines.filter((line) => line.status === "APPROVED").length;
        const rejected = allLines.filter((line) => line.status === "REJECTED").length;
        const status = approved > 0 ? "REVIEWED" : "REJECTED";
        const updated = await tx.purchaseRequest.updateMany({
          where: { id: params.id, status: "PENDING_REVIEW" },
          data: { status, reviewedAt: now },
        });
        if (updated.count !== 1) {
          throw new Error("CONFLICT");
        }
        await writeLog(tx, {
          docType: "PURCHASE",
          docId: params.id,
          action: status === "REVIEWED" ? "APPROVE" : "REJECT",
          actorId: auth.userId,
          fromStatus: "PENDING_REVIEW",
          toStatus: status,
          note: `审批完成：通过 ${approved} 条，驳回 ${rejected} 条`,
        });
        return { approved, rejected, status };
      }
      return null;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return NextResponse.json({ error: "部分行已由其他审批人处理，请刷新后重试" }, { status: 409 });
    }
    throw error;
  }

  if (finalizedSummary) {
    try {
      await notifyUser(
        request.creatorId,
        `${request.requestNo} 审批完成：通过 ${finalizedSummary.approved} 条，驳回 ${finalizedSummary.rejected} 条。`,
        {
          type: "PURCHASE",
          id: request.id,
          title: finalizedSummary.status === "REVIEWED" ? "采买请求审批完成" : "采买请求已驳回",
          kind: finalizedSummary.status === "REVIEWED" ? "APPROVED" : "REJECTED",
        },
      );
    } catch (error) {
      console.error("[purchase-request.review.notification]", { requestId: request.id, error });
    }
  }

  return NextResponse.json({ ok: true, finalized: finalizedSummary });
}
