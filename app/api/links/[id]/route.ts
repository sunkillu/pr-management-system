import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 解除关联：关联创建人或管理员可操作，写入双方历史记录
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const link = await prisma.approvalLink.findUnique({ where: { id: params.id } });
  if (!link) return NextResponse.json({ error: "关联不存在" }, { status: 404 });
  if (link.createdById !== auth.userId && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "仅关联创建人或管理员可解除" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalLink.delete({ where: { id: params.id } });
    const note = `解除关联（由 ${auth.userName || auth.userId} 操作）`;
    await writeLog(tx, {
      docType: link.fromType,
      docId: link.fromId,
      action: "UNLINK",
      actorId: auth.userId,
      note: `${note}：${link.toType === "CONTENT" ? "内容" : "打款单"} ${link.toId}`,
    });
    await writeLog(tx, {
      docType: link.toType,
      docId: link.toId,
      action: "UNLINK",
      actorId: auth.userId,
      note: `${note}：${link.fromType === "CONTENT" ? "内容" : "打款单"} ${link.fromId}`,
    });
  });
  return NextResponse.json({ ok: true });
}
