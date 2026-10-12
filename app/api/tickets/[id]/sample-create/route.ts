import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";
import { notifyUser } from "@/lib/feishu-notify";

// 一键寄品：待寄品 → 生成寄品单（款式+盒数+度数）→ 自动创建寄件请求 → 进入执行中
// body: { items: [{ style, degree?, quantity, note? }] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: { influencer: { select: { id: true, name: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "PENDING_SAMPLE") {
    return NextResponse.json({ error: "仅待寄品的工单可一键寄品" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }

  const body = await req.json();
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "请填写寄品明细（款式+数量）" }, { status: 400 });
  }
  for (const it of items) {
    if (!it.style?.trim() || !(Number(it.quantity) > 0)) {
      return NextResponse.json({ error: "每行寄品需填写款式和数量" }, { status: 400 });
    }
  }

  const productName = items.map((it: any) => `${it.style}${it.degree ? `(${it.degree})` : ""}x${it.quantity}`).join("、");

  const result = await prisma.$transaction(async (tx) => {
    // 创建寄件请求（待处理，需提交人先维护收件信息）
    const sample = await tx.sampleShipment.create({
      data: {
        ticketId: params.id,
        influencerId: ticket.influencerId,
        productName,
        quantity: items.reduce((s: number, it: any) => s + Number(it.quantity), 0),
        items,
        status: "PENDING",
        createdById: auth.userId,
        infoConfirmed: false,
      },
    });
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "IN_PROGRESS" },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "PENDING_SAMPLE",
      toStatus: "IN_PROGRESS",
      note: `一键寄品生成寄品单（${productName}），寄件请求已创建，进入执行中`,
    });
    return { ticket: u, sample };
  });

  // 通知提交人维护收件信息（两段式第一段）
  await notifyUser(
    auth.userId,
    `「${ticket.title}」寄品单已生成，请先维护收件人、电话、地址、明细，确认无误后仓库才会接单。`
  );

  return NextResponse.json(result);
}
