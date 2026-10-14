import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";
import { nextPurchaseNumber } from "@/lib/purchase-number";
import {
  PURCHASE_CREATE_ROLES,
  PURCHASE_VIEW_ROLES,
  buildPurchaseRequestWhere,
  isPurchasePlatform,
  isValidPurchaseLink,
  parsePurchaseQuantity,
  sumQuantities,
} from "@/lib/purchase-shared";

function toSummary(item: {
  id: string;
  requestNo: string;
  status: string;
  note: string | null;
  creatorId: string;
  creator: { id: string; name: string };
  lines: Array<{ id: string; quantity: number; status: string }>;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  assignedAt: Date | null;
}) {
  return {
    id: item.id,
    requestNo: item.requestNo,
    status: item.status,
    note: item.note,
    creatorId: item.creatorId,
    creator: item.creator,
    lineCount: item.lines.length,
    totalQuantity: sumQuantities(item.lines),
    pendingLineCount: item.lines.filter((line) => line.status === "PENDING").length,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    reviewedAt: item.reviewedAt,
    assignedAt: item.assignedAt,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireRoles([...PURCHASE_VIEW_ROLES]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 100;
  const where = buildPurchaseRequestWhere(auth.role, auth.userId);

  const list = await prisma.purchaseRequest.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      lines: { select: { id: true, quantity: true, status: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  return NextResponse.json({ items: list.map(toSummary) });
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles([...PURCHASE_CREATE_ROLES]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const rawNote = String(body?.note ?? "").trim();
  if (rawNote.length > 2000) {
    return NextResponse.json({ error: "备注不能超过 2000 个字" }, { status: 400 });
  }
  const note = rawNote || null;

  const rawLines = Array.isArray(body?.lines) ? body.lines : null;
  if (!rawLines || rawLines.length < 1 || rawLines.length > 100) {
    return NextResponse.json({ error: "请提交 1 到 100 行采买需求" }, { status: 400 });
  }

  let parsedLines: Array<{ platform: string; link: string; style: string; quantity: number; sort: number }>;
  try {
    parsedLines = rawLines.map((line: Record<string, unknown>, index: number) => {
      const platform = String(line?.platform ?? "").trim().toUpperCase();
      const link = String(line?.link ?? "").trim();
      const style = String(line?.style ?? "").trim();
      const quantity = parsePurchaseQuantity(line?.quantity);
      if (!isPurchasePlatform(platform)) {
        throw new Error(`第 ${index + 1} 行平台非法`);
      }
      if (!isValidPurchaseLink(link)) {
        throw new Error(`第 ${index + 1} 行链接需为 http(s):// 开头且不超过 500 字`);
      }
      if (!style) {
        throw new Error(`第 ${index + 1} 行款式不能为空`);
      }
      if (quantity === null) {
        throw new Error(`第 ${index + 1} 行数量必须为 1~9999 的正整数`);
      }
      return { platform, link, style, quantity, sort: index };
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "采买行校验失败" },
      { status: 400 },
    );
  }

  const styleNames = Array.from(new Set(parsedLines.map((line) => line.style)));
  const styles = await prisma.styleOption.findMany({
    where: { kind: "STYLE", isActive: true, name: { in: styleNames } },
    select: { name: true },
  });
  const styleSet = new Set(styles.map((style) => style.name));
  const invalidStyle = parsedLines.find((line) => !styleSet.has(line.style));
  if (invalidStyle) {
    return NextResponse.json({ error: `款式不存在或已停用：${invalidStyle.style}` }, { status: 400 });
  }

  const approvers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "PR_MANAGER"] } },
    select: { id: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const requestNo = await nextPurchaseNumber(tx);
    const request = await tx.purchaseRequest.create({
      data: {
        requestNo,
        status: "PENDING_REVIEW",
        note,
        creatorId: auth.userId,
        lines: {
          create: parsedLines.map((line) => ({
            sort: line.sort,
            platform: line.platform,
            link: line.link,
            style: line.style,
            quantity: line.quantity,
            status: "PENDING",
          })),
        },
      },
      include: {
        creator: { select: { id: true, name: true } },
        lines: { select: { id: true, quantity: true, status: true } },
      },
    });
    await writeLog(tx, {
      docType: "PURCHASE",
      docId: request.id,
      action: "CREATE",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: "PENDING_REVIEW",
      note: `创建采买请求，共 ${parsedLines.length} 行`,
    });
    return request;
  });

  if (approvers.length > 0) {
    try {
      await notifyApprovers(
        approvers.map((user) => user.id),
        `有新的采买请求待审批：${created.requestNo}`,
        { type: "PURCHASE", id: created.id, title: "采买请求待审批", kind: "APPROVAL_PENDING" },
      );
    } catch (error) {
      console.error("[purchase-request.create.notification]", { requestId: created.id, error });
    }
  }

  return NextResponse.json(
    toSummary({
      ...created,
      creatorId: auth.userId,
      note,
      reviewedAt: null,
      assignedAt: null,
    }),
    { status: 201 },
  );
}
