import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { LOGISTICS_STATUSES, ABNORMAL_FLAGS } from "@/lib/logistics";

const WRITE = ["ADMIN", "PR", "PR_MANAGER"] as const;

/** 解析物流相关字段：shippedAt / logisticsStatus / abnormalFlag，白名单校验 */
function parseLogisticsFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (body.shippedAt !== undefined) {
    out.shippedAt = body.shippedAt ? new Date(String(body.shippedAt)) : null;
    if (out.shippedAt && Number.isNaN((out.shippedAt as Date).getTime())) {
      return { error: "发货时间格式不正确" };
    }
  }
  if (body.logisticsStatus !== undefined) {
    const v = String(body.logisticsStatus ?? "").trim() || null;
    if (v && !(LOGISTICS_STATUSES as readonly string[]).includes(v)) {
      return { error: `物流状态仅允许：${LOGISTICS_STATUSES.join(" / ")}` };
    }
    out.logisticsStatus = v;
  }
  if (body.abnormalFlag !== undefined) {
    const v = String(body.abnormalFlag ?? "").trim() || null;
    if (v && !(ABNORMAL_FLAGS as readonly string[]).includes(v)) {
      return { error: `异常标记仅允许：${ABNORMAL_FLAGS.join(" / ")}` };
    }
    out.abnormalFlag = v;
  }
  return { data: out };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...WRITE, "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "寄品记录不存在" }, { status: 404 });
  // 物流字段（发货时间 / 物流状态 / 异常标记）：仓库与业务方均可维护，白名单校验
  const logistics = parseLogisticsFields(body as Record<string, unknown>);
  if ("error" in logistics) {
    return NextResponse.json({ error: logistics.error }, { status: 400 });
  }
  const logisticsData = logistics.data as Record<string, unknown>;
  const isWarehouseOnly = auth.role === "WAREHOUSE";
  const data: Record<string, unknown> = isWarehouseOnly
    ? {
        // 仓库仅允许维护寄件信息
        courier: body.courier !== undefined ? body.courier?.trim() || null : undefined,
        trackingNo: body.trackingNo !== undefined ? body.trackingNo || null : undefined,
        shippedDate:
          body.shippedDate !== undefined
            ? body.shippedDate
              ? new Date(body.shippedDate)
              : null
            : undefined,
        shippedBy: body.shippedBy !== undefined ? body.shippedBy?.trim() || null : undefined,
        status: body.status ?? undefined,
        ...logisticsData,
      }
    : {
        influencerId: body.influencerId !== undefined ? body.influencerId || null : undefined,
        productName: body.productName?.trim() || undefined,
        quantity: body.quantity !== undefined ? Number(body.quantity) || 1 : undefined,
        receiverName: body.receiverName !== undefined ? body.receiverName?.trim() || null : undefined,
        receiverPhone: body.receiverPhone !== undefined ? body.receiverPhone?.trim() || null : undefined,
        receiverAddress: body.receiverAddress !== undefined ? body.receiverAddress?.trim() || null : undefined,
        courier: body.courier !== undefined ? body.courier?.trim() || null : undefined,
        trackingNo: body.trackingNo !== undefined ? body.trackingNo || null : undefined,
        shippedDate:
          body.shippedDate !== undefined
            ? body.shippedDate
              ? new Date(body.shippedDate)
              : null
            : undefined,
        shippedBy: body.shippedBy !== undefined ? body.shippedBy?.trim() || null : undefined,
        status: body.status ?? undefined,
        ...logisticsData,
      };
  const updated = await prisma.sampleShipment.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "寄品记录不存在" }, { status: 404 });
  await prisma.sampleShipment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
