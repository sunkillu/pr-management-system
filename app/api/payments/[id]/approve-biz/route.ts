import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 一审 · 业务审批：仅管理员
// 通过 → 待财务审批；驳回 → 已驳回（需理由）。写入审批记录（阶段=业务审批）。
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
  const existing = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 404 });
  if (existing.status !== "PENDING_BIZ") {
    return NextResponse.json({ error: "仅待业务审批的申请可操作" }, { status: 400 });
  }

  const [payment] = await prisma.$transaction([
    prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: action === "APPROVE" ? "PENDING_FIN" : "REJECTED",
        rejectReason: action === "REJECT" ? body.comment.trim() : null,
      },
    }),
    prisma.approvalRecord.create({
      data: {
        stage: "BIZ",
        action,
        comment: body.comment?.trim() || null,
        approverId: auth.userId,
        paymentRequestId: params.id,
      },
    }),
  ]);
  return NextResponse.json(payment);
}
