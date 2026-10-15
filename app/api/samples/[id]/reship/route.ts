import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";

// 异常重寄：已寄出（SHIPPED）且被标记异常（abnormalFlag = 拒收 / 退回 / 异常）的寄品，
// 退回待寄出，等待仓库用新快递单号重新寄出。
// 重寄时清空旧物流信息（快递公司 / 单号 / 发货时间 / 物流状态 / 检测与预警标记），
// 避免旧单号、旧预警标记污染新一次寄送；重寄原因写入 ApprovalLog 留痕。
// 仅提交人或管理员可操作；理由必填。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!sample) return NextResponse.json({ error: "寄件请求不存在" }, { status: 404 });
  if (sample.status !== "SHIPPED") {
    return NextResponse.json({ error: "仅已寄出的请求可异常重寄" }, { status: 400 });
  }
  if (!sample.abnormalFlag) {
    return NextResponse.json({ error: "该寄品未标记异常（拒收 / 退回 / 异常），不可重寄" }, { status: 400 });
  }
  if (auth.role !== "ADMIN" && sample.createdById !== auth.userId) {
    return NextResponse.json({ error: "仅提交人或管理员可操作重寄" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json({ error: "重寄必须填写理由" }, { status: 400 });
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.sampleShipment.update({
      where: { id: params.id },
      data: {
        status: "PENDING",
        abnormalFlag: null,
        courier: null,
        trackingNo: null,
        shippedDate: null,
        shippedAt: null,
        shippedBy: null,
        logisticsStatus: null,
        logisticsCheckedAt: null,
        overdueWarnedAt: null,
        scheduleRemindedAt: null,
      },
    });
    await writeLog(tx, {
      docType: "SAMPLE",
      docId: params.id,
      action: "EDIT",
      actorId: auth.userId,
      fromStatus: "SHIPPED",
      toStatus: "PENDING",
      note: `异常重寄（原异常：${sample.abnormalFlag}，原单号：${sample.trackingNo ?? "-"}）：${reason}`,
    });
    return u;
  });
  // 通知仓库重新备货寄出
  const warehouses = await prisma.user.findMany({
    where: { role: { in: ["WAREHOUSE", "ADMIN"] } },
    select: { id: true },
  });
  for (const w of warehouses) {
    await notifyUser(
      w.id,
      `${sample.productName} 已异常重寄（原异常：${sample.abnormalFlag}），请仓库重新备货寄出。`,
      { type: "SAMPLE", id: sample.id, title: "寄品异常重寄", kind: "SYSTEM" },
    );
  }
  return NextResponse.json(updated);
}
