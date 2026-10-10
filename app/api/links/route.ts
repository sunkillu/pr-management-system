import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canonicalLink, getLinksWithCounterparts } from "@/lib/approval-links";
import type { DocType } from "@prisma/client";

// 审批单关联：内容单 ↔ 打款单、打款单 ↔ 打款单等任意组合
// 关联无方向，创建时 canonical 化去重；关联操作写入双方历史记录

export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const docType = searchParams.get("docType") as DocType | null;
  const docId = searchParams.get("docId");
  if ((docType !== "CONTENT" && docType !== "PAYMENT") || !docId) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }
  const links = await getLinksWithCounterparts(docType, docId);
  return NextResponse.json(links);
}

async function assertDocExists(type: DocType, id: string) {
  if (type === "CONTENT") {
    return !!(await prisma.content.findUnique({ where: { id }, select: { id: true } }));
  }
  return !!(await prisma.paymentRequest.findUnique({ where: { id }, select: { id: true } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const { fromType, fromId, toType, toId } = body as {
    fromType: DocType;
    fromId: string;
    toType: DocType;
    toId: string;
  };
  if (!["CONTENT", "PAYMENT"].includes(fromType) || !["CONTENT", "PAYMENT"].includes(toType) || !fromId || !toId) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }
  let canon;
  try {
    canon = canonicalLink(fromType, fromId, toType, toId);
  } catch {
    return NextResponse.json({ error: "不能关联自己" }, { status: 400 });
  }
  const [aExists, bExists] = await Promise.all([
    assertDocExists(canon.fromType, canon.fromId),
    assertDocExists(canon.toType, canon.toId),
  ]);
  if (!aExists || !bExists) return NextResponse.json({ error: "关联的单据不存在" }, { status: 404 });

  const existing = await prisma.approvalLink.findUnique({
    where: {
      fromType_fromId_toType_toId: {
        fromType: canon.fromType,
        fromId: canon.fromId,
        toType: canon.toType,
        toId: canon.toId,
      },
    },
  });
  if (existing) return NextResponse.json({ error: "已经关联过了" }, { status: 400 });

  const [link] = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalLink.create({
      data: { ...canon, createdById: auth.userId },
    });
    const note = `关联单据（由 ${auth.userName || auth.userId} 操作）`;
    await writeLog(tx, {
      docType: canon.fromType,
      docId: canon.fromId,
      action: "LINK",
      actorId: auth.userId,
      note: `${note}：${canon.toType === "CONTENT" ? "内容" : "打款单"} ${canon.toId}`,
    });
    await writeLog(tx, {
      docType: canon.toType,
      docId: canon.toId,
      action: "LINK",
      actorId: auth.userId,
      note: `${note}：${canon.fromType === "CONTENT" ? "内容" : "打款单"} ${canon.fromId}`,
    });
    return [created];
  });
  return NextResponse.json(link, { status: 201 });
}
