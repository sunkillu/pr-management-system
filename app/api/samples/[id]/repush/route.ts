import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers } from "@/lib/feishu-notify";

// 重新推送仓库：寄件信息修改后，提交人/管理员可再次推送给仓库
// 仅待处理（PENDING）的请求可重推；重推保持 infoConfirmed=true，通知仓库重新接单。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!sample) return NextResponse.json({ error: "寄件请求不存在" }, { status: 404 });
  if (sample.status !== "PENDING") {
    return NextResponse.json({ error: "仅待处理的请求可重新推送" }, { status: 400 });
  }
  // 仅提交人或管理员可重推
  if (auth.role !== "ADMIN" && sample.createdById !== auth.userId) {
    return NextResponse.json({ error: "仅提交人或管理员可重新推送" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.sampleShipment.update({
      where: { id: params.id },
      data: { infoConfirmed: true },
    });
    await writeLog(tx, {
      docType: "SAMPLE",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "PENDING",
      toStatus: "PENDING",
      note: body.note?.trim() ? `寄件信息已修改，重新推送仓库：${body.note.trim()}` : "寄件信息已修改，重新推送仓库",
    });
    return u;
  });
  // 通知仓库（仓库角色 + 管理员兜底，与 confirm-info 一致）
  const warehouses = await prisma.user.findMany({
    where: { role: { in: ["WAREHOUSE", "ADMIN"] } },
    select: { id: true },
  });
  await notifyApprovers(
    warehouses.map((w) => w.id),
    `${sample.productName}（收件人：${sample.receiverName ?? "-"}），寄件信息已修改并重新推送，请仓库重新确认接单。`,
    { type: "SAMPLE", id: sample.id, title: "寄件请求重新推送", kind: "APPROVAL_PENDING" }
  );
  return NextResponse.json(updated);
}
