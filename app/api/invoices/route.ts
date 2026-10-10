import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 新建发票记录：运营 / 管理员（文件与关联打款单均为选填）
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.invoiceNo?.trim()) return NextResponse.json({ error: "发票号码不能为空" }, { status: 400 });
  if (!body.issuer?.trim()) return NextResponse.json({ error: "开票方不能为空" }, { status: 400 });
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return NextResponse.json({ error: "金额必须大于 0" }, { status: 400 });
  if (!body.issueDate) return NextResponse.json({ error: "请选择开票日期" }, { status: 400 });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo: body.invoiceNo.trim(),
      issuer: body.issuer.trim(),
      amount: body.amount,
      issueDate: new Date(body.issueDate),
      type: body.type ?? "E_INVOICE",
      fileUrl: body.fileUrl || null,
      fileName: body.fileName || null,
      note: body.note || null,
      paymentRequestId: body.paymentRequestId || null,
      uploadedById: auth.userId,
      status: "PENDING",
    },
  });
  return NextResponse.json(invoice, { status: 201 });
}
