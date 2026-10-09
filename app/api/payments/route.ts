import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 提交打款申请：运营 / 管理员，初始状态为待业务审批
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "金额必须大于 0" }, { status: 400 });
  if (!body.payeeName?.trim()) return NextResponse.json({ error: "收款方不能为空" }, { status: 400 });

  const payment = await prisma.paymentRequest.create({
    data: {
      title: body.title.trim(),
      amount: body.amount,
      payeeName: body.payeeName.trim(),
      payeeAccount: body.payeeAccount || null,
      reason: body.reason || null,
      outletId: body.outletId || null,
      campaignId: body.campaignId || null,
      contentId: body.contentId || null,
      requesterId: auth.userId,
      status: "PENDING_BIZ",
    },
  });
  return NextResponse.json(payment, { status: 201 });
}
