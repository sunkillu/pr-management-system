import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 提交审批：草稿 → 待审批；被驳回 → 重新提交（回到待审批，重新走完整审批链）
// 重新提交仅限创建人本人或管理员；操作写入历史日志
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const existing = await prisma.content.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (!["DRAFT", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "当前状态不可提交审批" }, { status: 400 });
  }

  const isResubmit = existing.status === "REJECTED";
  if (isResubmit) {
    const isOwner = existing.createdById === auth.userId;
    if (!isOwner && auth.role !== "ADMIN") {
      return NextResponse.json({ error: "仅创建人本人或管理员可重新提交" }, { status: 403 });
    }
  }

  const [content] = await prisma.$transaction(async (tx) => {
    const updated = await tx.content.update({
      where: { id: params.id },
      data: {
        status: "PENDING",
        rejectReason: null,
        // 首次提交时记录创建人，作为后续重新提交的权限依据
        ...(existing.createdById ? {} : { createdById: auth.userId }),
      },
    });
    await writeLog(tx, {
      docType: "CONTENT",
      docId: params.id,
      action: isResubmit ? "RESUBMIT" : "SUBMIT",
      actorId: auth.userId,
      fromStatus: existing.status,
      toStatus: "PENDING",
      note: isResubmit ? note || null : null,
    });
    return [updated];
  });
  return NextResponse.json(content);
}
