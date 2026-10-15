import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";
import { nextSampleNumber } from "@/lib/sample-number";

const WRITE = ["ADMIN", "PR", "PR_MANAGER"] as const;

// 列表：所有登录用户可查，支持搜索 / 状态筛选
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status");
  const brandId = searchParams.get("brandId");
  const list = await prisma.sampleShipment.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { sampleNo: { contains: q, mode: "insensitive" as const } },
              { productName: { contains: q, mode: "insensitive" as const } },
              { trackingNo: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status: status as never } : {}),
      ...(brandId ? { brandId } : {}),
    },
    include: {
      influencer: { select: { name: true } },
      createdBy: { select: { name: true } },
      brand: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

// 寄件请求登记：产品名称必填；新建默认待处理（PENDING），由仓库接单
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...WRITE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.productName?.trim()) {
    return NextResponse.json({ error: "产品名称不能为空" }, { status: 400 });
  }
  // 从工单一键生成时校验 ticketId 存在，且工单已审批通过（IN_PROGRESS 及之后）
  // 同时自动带入工单的 brandId
  let brandId: string | null = null;
  if (body.ticketId) {
    const ticket = await prisma.cooperationTicket.findUnique({ where: { id: body.ticketId }, select: { id: true, status: true, brandId: true } });
    if (!ticket) return NextResponse.json({ error: "关联工单不存在" }, { status: 400 });
    const SAMPLE_ALLOWED = ["APPROVED", "IN_PROGRESS", "MATERIAL_REVIEW", "COMPLETED", "SETTLING", "FOLLOW_UP", "SETTLED"];
    if (!SAMPLE_ALLOWED.includes(ticket.status)) {
      return NextResponse.json({ error: "工单尚未审批通过，不能发起寄件" }, { status: 400 });
    }
    brandId = ticket.brandId;
  }
  // 允许手动指定/覆盖品牌
  if (body.brandId) {
    const b = await prisma.brand.findFirst({ where: { id: String(body.brandId), isActive: true }, select: { id: true } });
    if (!b) return NextResponse.json({ error: "品牌不存在或已停用" }, { status: 400 });
    brandId = b.id;
  }
  const sample = await prisma.$transaction(async (tx) => {
    if (body.ticketId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sample-ticket:${body.ticketId}`}))`;
      const existing = await tx.sampleShipment.findFirst({
        where: { ticketId: body.ticketId },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return { record: existing, created: false };
    }
    const sampleNo = await nextSampleNumber(tx);
    const created = await tx.sampleShipment.create({
      data: {
        sampleNo,
        influencerId: body.influencerId || null,
        ticketId: body.ticketId || null,
        brandId,
        productName: body.productName.trim(),
        quantity: Number(body.quantity) > 0 ? Number(body.quantity) : 1,
        items: Array.isArray(body.items) ? body.items : null,
        receiverName: body.receiverName?.trim() || null,
        receiverPhone: body.receiverPhone?.trim() || null,
        receiverAddress: body.receiverAddress?.trim() || null,
        status: "PENDING",
        createdById: auth.userId,
      },
    });
    await writeLog(tx, {
      docType: "SAMPLE",
      docId: created.id,
      action: "CREATE",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: "PENDING",
      note: body.ticketId ? "由工单寄品明细一键生成" : null,
    });
    return { record: created, created: true };
  });
  // 创建后只通知提交人去维护收件信息，信息确认后才推给仓库
  if (sample.created) {
    try {
      await notifyUser(
        auth.userId,
        `【寄件请求已创建】${sample.record.sampleNo} ${sample.record.productName}，请先维护收件信息（收件人/电话/地址/明细），确认无误后推送仓库。`,
        { type: "SAMPLE", id: sample.record.id, title: "寄件信息待维护", kind: "SYSTEM" }
      );
    } catch (error) {
      console.error("[sample.create.notification]", { sampleId: sample.record.id, error });
    }
  }
  return NextResponse.json(sample.record, { status: sample.created ? 201 : 200 });
}
