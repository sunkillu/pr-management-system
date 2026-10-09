import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 内容审批：仅管理员。通过 → 已通过；驳回 → 已驳回（需理由），并写入审批记录与操作日志
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const action = body.action as "APPROVE" | "REJECT";
  if (!["APPROVE", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "action 非法" }, { status: 400 });
  }
  if (action === "REJECT" && !body.comment?.trim()) {
    return NextResponse.json({ error: "驳回必须填写理由" }, { status: 400 });
  }
  const existing = await prisma.content.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "仅待审批的内容可审批" }, { status: 400 });
  }

  const toStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  const [content] = await prisma.$transaction(async (tx) => {
    const updated = await tx.content.update({
      where: { id: params.id },
      data: {
        status: toStatus,
        rejectReason: action === "REJECT" ? body.comment.trim() : null,
      },
    });
    await tx.approvalRecord.create({
      data: {
        stage: "CONTENT",
        action,
        comment: body.comment?.trim() || null,
        approverId: auth.userId,
        contentId: params.id,
      },
    });
    await writeLog(tx, {
      docType: "CONTENT",
      docId: params.id,
      action,
      actorId: auth.userId,
      fromStatus: "PENDING",
      toStatus,
      note: body.comment?.trim() || null,
    });
    return [updated];
  });
  return NextResponse.json(content);
}
