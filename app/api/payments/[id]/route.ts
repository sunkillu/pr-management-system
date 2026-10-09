import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 编辑打款申请：仅待业务审批 / 已驳回状态可编辑；驳回后编辑会重新回到待业务审批
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (!["PENDING_BIZ", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "当前状态不可编辑" }, { status: 400 });
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "金额必须大于 0" }, { status: 400 });
  if (!body.payeeName?.trim()) return NextResponse.json({ error: "收款方不能为空" }, { status: 400 });

  const payment = await prisma.paymentRequest.update({
    where: { id: params.id },
    data: {
      title: body.title.trim(),
      amount: body.amount,
      payeeName: body.payeeName.trim(),
      payeeAccount: body.payeeAccount || null,
      reason: body.reason || null,
      outletId: body.outletId || null,
      campaignId: body.campaignId || null,
      contentId: body.contentId || null,
      // 驳回后重新编辑，回到待业务审批
      status: existing.status === "REJECTED" ? "PENDING_BIZ" : existing.status,
      rejectReason: null,
    },
  });
  return NextResponse.json(payment);
}

// 删除：运营 / 管理员
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  await prisma.paymentRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
