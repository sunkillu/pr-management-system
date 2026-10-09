import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 内容作废：提交人可作废自己处于待审批状态的单；
// 管理员可作废任何非终态单（已发布/已作废不可作废）。作废需填理由，写入历史记录。
// 作废后单据不可再流转，只能查看。
const TERMINAL = ["PUBLISHED", "VOIDED"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "作废必须填写理由" }, { status: 400 });

  const existing = await prisma.content.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (existing.status === "VOIDED") return NextResponse.json({ error: "该单据已作废" }, { status: 400 });
  if (TERMINAL.includes(existing.status)) {
    return NextResponse.json({ error: "已发布的内容不可作废" }, { status: 400 });
  }

  const isAdmin = auth.role === "ADMIN";
  const isOwnerPending = existing.createdById === auth.userId && existing.status === "PENDING";
  if (!isAdmin && !isOwnerPending) {
    return NextResponse.json({ error: "仅管理员可作废该状态的单据" }, { status: 403 });
  }

  const [content] = await prisma.$transaction(async (tx) => {
    const updated = await tx.content.update({
      where: { id: params.id },
      data: { status: "VOIDED", voidReason: reason },
    });
    await writeLog(tx, {
      docType: "CONTENT",
      docId: params.id,
      action: "VOID",
      actorId: auth.userId,
      fromStatus: existing.status,
      toStatus: "VOIDED",
      note: reason,
    });
    return [updated];
  });
  return NextResponse.json(content);
}
