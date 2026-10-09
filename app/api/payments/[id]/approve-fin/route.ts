import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 二审 · 财务审批：财务（管理员兜底也有权限）
// 通过 → 待打款；驳回 → 已驳回（需理由）。写入审批记录（阶段=财务审批）。
// 注意：发票为选填，无发票不阻塞审批。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "FINANCE"]);
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
  if (!existing) return NextResponse.json({ error: "打款申请不存在" }, { status: 400 });
  if (existing.status !== "PENDING_FIN") {
    return NextResponse.json({ error: "仅待财务审批的申请可操作" }, { status: 400 });
  }

  const [payment] = await prisma.$transaction([
    prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        rejectReason: action === "REJECT" ? body.comment.trim() : null,
      },
    }),
    prisma.approvalRecord.create({
      data: {
        stage: "FIN",
        action,
        comment: body.comment?.trim() || null,
        approverId: auth.userId,
        paymentRequestId: params.id,
      },
    }),
  ]);
  return NextResponse.json(payment);
}
