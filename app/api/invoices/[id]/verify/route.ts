import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 发票核验：财务（管理员兜底也有权限）。待核验 → 已核验 / 异常（异常需备注原因）
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "FINANCE"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const action = body.action as "VERIFY" | "INVALID";
  if (!["VERIFY", "INVALID"].includes(action)) {
    return NextResponse.json({ error: "action 非法" }, { status: 400 });
  }
  if (action === "INVALID" && !body.note?.trim()) {
    return NextResponse.json({ error: "标记异常必须填写原因" }, { status: 400 });
  }
  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "发票不存在" }, { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "仅待核验的发票可操作" }, { status: 400 });
  }
  const nextStatus = action === "VERIFY" ? "VERIFIED" : "INVALID";
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findUniqueOrThrow({ where: { id: params.id } });
    if (current.status !== "PENDING") return { conflict: true as const };
    const updated = await tx.invoice.update({
      where: { id: params.id },
      data: {
        status: nextStatus,
        note: body.note?.trim() || current.note,
      },
    });
    if (current.status !== updated.status) {
      await writeLog(tx, {
        docType: "INVOICE",
        docId: updated.id,
        action: action === "VERIFY" ? "APPROVE" : "REJECT",
        actorId: auth.userId,
        fromStatus: current.status,
        toStatus: updated.status,
        note: body.note,
      });
    }
    return { invoice: updated };
  });
  if ("conflict" in result) {
    return NextResponse.json({ error: "仅待核验的发票可操作" }, { status: 400 });
  }
  const invoice = result.invoice;
  return NextResponse.json(invoice);
}
