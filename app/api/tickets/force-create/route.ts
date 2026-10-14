import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyApprovers, notifyUser } from "@/lib/feishu-notify";
import { buildNodesForTicket } from "@/lib/ticket-nodes";

// POST /api/tickets/force-create — 管理员强制创建合作工单入口
// 场景：达人正被其他工单占用（或30天保护期内），普通创建会返回 409，
// 管理员仍决定创建时调用本接口：跳过占用冲突校验，直接覆盖占用，并记录
// forceCreated / forceReason / forceById / forceAt 留痕。
// 仅 ADMIN 可调用。body 同 POST /api/tickets，另加 forceReason（必填）。
// 注意：quoteAmount 为 A级敏感，本接口不输出、不记录报价相关数据到日志正文。
export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const forceReason = typeof body.forceReason === "string" ? body.forceReason.trim() : "";
  if (!forceReason) {
    return NextResponse.json({ error: "请填写强制创建原因" }, { status: 400 });
  }
  if (!body.title?.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });

  const type = body.type as "INFLUENCER_POST" | "INFLUENCER_LIVE" | "MAKEUP" | undefined;
  if (!type || !["INFLUENCER_POST", "INFLUENCER_LIVE", "MAKEUP"].includes(type)) {
    return NextResponse.json({ error: "合作类型非法" }, { status: 400 });
  }
  const budgetFee = Number(body.budgetFee);
  if (!budgetFee || budgetFee <= 0) {
    return NextResponse.json({ error: "预算费用必须大于 0" }, { status: 400 });
  }
  const platforms: string[] = Array.isArray(body.platform)
    ? body.platform.map((s: unknown) => String(s)).filter((s: string) => ["XIAOHONGSHU", "DOUYIN"].includes(s))
    : [];
  if (platforms.length === 0) {
    return NextResponse.json({ error: "请选择合作平台（可多选）" }, { status: 400 });
  }
  const styles: string[] = Array.isArray(body.style)
    ? body.style.map((s: unknown) => String(s)).filter(Boolean)
    : [];
  if (styles.length === 0) {
    return NextResponse.json({ error: "请选择款式（可多选）" }, { status: 400 });
  }
  const coopCategories: string[] = Array.isArray(body.coopCategory)
    ? body.coopCategory.map((s: unknown) => String(s)).filter(Boolean)
    : [];
  if (coopCategories.length === 0) {
    return NextResponse.json({ error: "请选择合作类目（可多选）" }, { status: 400 });
  }
  const estimatedSchedule = String(body.estimatedSchedule ?? "").trim();
  if (!estimatedSchedule) {
    return NextResponse.json({ error: "请填写预估档期" }, { status: 400 });
  }
  // v2: 预估发布年月（YYYY-MM）
  const estimatedPublishMonth =
    typeof body.estimatedPublishMonth === "string" && /^\d{4}-\d{2}$/.test(body.estimatedPublishMonth.trim())
      ? body.estimatedPublishMonth.trim()
      : null;

  const influencerId = typeof body.influencerId === "string" && body.influencerId ? body.influencerId : null;
  const makeupArtistId = typeof body.makeupArtistId === "string" && body.makeupArtistId ? body.makeupArtistId : null;
  if (type === "MAKEUP" && !makeupArtistId) {
    return NextResponse.json({ error: "化妆师合作必须选择化妆师" }, { status: 400 });
  }
  if (type !== "MAKEUP" && !influencerId) {
    return NextResponse.json({ error: "达人合作必须选择达人" }, { status: 400 });
  }
  if (influencerId) {
    const inf = await prisma.influencer.findUnique({ where: { id: influencerId } });
    if (!inf) return NextResponse.json({ error: "达人不存在" }, { status: 404 });
    if (inf.status !== "APPROVED") {
      return NextResponse.json({ error: "该达人尚未通过审核，不能发起合作" }, { status: 400 });
    }
  }

  let homepageId = String(body.homepageId ?? "").trim() || null;
  if (!homepageId && influencerId) {
    const inf = await prisma.influencer.findUnique({ where: { id: influencerId }, select: { homepageId: true } });
    if (inf?.homepageId) homepageId = inf.homepageId;
  }

  const submit = body.submit === true;
  const approverIds: string[] = Array.isArray(body.approverIds) ? body.approverIds : [];
  // 品牌必填
  const brandId = String(body.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "请选择所属品牌" }, { status: 400 });
  }
  const brand = await prisma.brand.findFirst({ where: { id: brandId, isActive: true }, select: { id: true } });
  if (!brand) {
    return NextResponse.json({ error: "品牌不存在或已停用" }, { status: 400 });
  }
  if (submit) {
    if (approverIds.length === 0) {
      return NextResponse.json({ error: "提交审批必须选择至少一位审批人" }, { status: 400 });
    }
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds }, role: { in: ["ADMIN", "PR_MANAGER"] } },
      select: { id: true },
    });
    if (approvers.length !== approverIds.length) {
      return NextResponse.json({ error: "审批人必须为 PR负责人 或 管理员" }, { status: 400 });
    }
  }

  const baseDate = body.startDate ? new Date(body.startDate) : new Date();
  const nodes = buildNodesForTicket(type, baseDate);
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter((a: unknown) => a && typeof (a as { fileUrl?: unknown }).fileUrl === "string").slice(0, 20)
    : undefined;
  const shipItems = Array.isArray(body.shipItems)
    ? body.shipItems
        .map((s: unknown) => ({
          style: String((s as { style?: unknown }).style ?? "").trim(),
          degree: String((s as { degree?: unknown }).degree ?? "").trim(),
          shelfLife: String((s as { shelfLife?: unknown }).shelfLife ?? "").trim(),
          boxCount: String((s as { boxCount?: unknown }).boxCount ?? "").trim(),
          note: String((s as { note?: unknown }).note ?? "").trim(),
        }))
        .filter((s: { style: string }) => s.style)
        .slice(0, 50)
    : undefined;

  // v2 档期报价（可选传入；齐全则强制开始占用）
  const q = Number(body.quoteAmount);
  const cd = typeof body.confirmedDate === "string" ? body.confirmedDate.trim() : "";
  const hasQuoteSchedule = q > 0 && /^\d{4}-\d{2}-\d{2}$/.test(cd);

  const ticket = await prisma.$transaction(async (tx) => {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayCount = await tx.cooperationTicket.count({ where: { createdAt: { gte: dayStart } } });
    const ticketNo = `${ymd}${String(todayCount + 1).padStart(4, "0")}`;

    const created = await tx.cooperationTicket.create({
      data: {
        ticketNo,
        title: body.title.trim(),
        type,
        brandId,
        budgetFee: body.budgetFee,
        actualFee: body.actualFee ? body.actualFee : null,
        platform: platforms,
        homepageId,
        style: styles,
        contentDirection: String(body.contentDirection ?? "").trim() || null,
        coopCategory: coopCategories,
        priceNote: String(body.priceNote ?? "").trim() || null,
        contentNote: String(body.contentNote ?? "").trim() || null,
        estimatedSchedule,
        estimatedPublishMonth,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        note: body.note?.trim() || null,
        status: submit ? "PENDING_APPROVAL" : "DRAFT",
        influencerId,
        makeupArtistId,
        creatorId: auth.userId,
        attachments: attachments ?? undefined,
        shipItems: shipItems && shipItems.length > 0 ? shipItems : undefined,
        nodes: { create: nodes },
        // 管理员强制创建留痕
        forceCreated: true,
        forceReason,
        forceById: auth.userId,
        forceAt: new Date(),
        ...(hasQuoteSchedule
          ? {
              quoteAmount: q,
              confirmedDate: new Date(`${cd}T00:00:00`),
              occupiesResource: true,
              resourceOccupiedAt: new Date(),
            }
          : {}),
      },
    });

    if (submit) {
      await tx.requestApprover.createMany({
        data: approverIds.map((approverId: string) => ({
          requestType: "TICKET" as const,
          requestId: created.id,
          approverId,
        })),
      });
      await writeLog(tx, {
        docType: "TICKET",
        docId: created.id,
        action: "SUBMIT",
        actorId: auth.userId,
        fromStatus: "DRAFT",
        toStatus: "PENDING_APPROVAL",
      });
    }

    // 强制占用：跳过冲突校验，直接覆盖（这正是"强制"的含义）
    if (influencerId && hasQuoteSchedule) {
      const prev = await tx.influencer.findUnique({
        where: { id: influencerId },
        select: { occupiedByTicketId: true },
      });
      const prevTicketId = prev?.occupiedByTicketId && prev.occupiedByTicketId !== created.id ? prev.occupiedByTicketId : null;
      if (prevTicketId) {
        await tx.cooperationTicket.update({
          where: { id: prevTicketId },
          data: { occupiesResource: false },
        });
      }
      await tx.influencer.update({
        where: { id: influencerId },
        data: { occupiedByTicketId: created.id },
      });
      await writeLog(tx, {
        docType: "TICKET",
        docId: created.id,
        action: "EDIT",
        actorId: auth.userId,
        note: `管理员强制创建并占用达人资源，原因：${forceReason}`,
      });
    } else {
      await writeLog(tx, {
        docType: "TICKET",
        docId: created.id,
        action: "CREATE",
        actorId: auth.userId,
        note: `管理员强制创建，原因：${forceReason}`,
      });
    }
    return created;
  });

  if (submit) {
    await notifyApprovers(
      approverIds,
      `${auth.userName}发起了合作工单「${ticket.title}」（管理员强制创建），请审批。`,
      { type: "TICKET", id: ticket.id, title: "合作工单待审批", kind: "APPROVAL_PENDING" }
    );
  }

  return NextResponse.json(ticket, { status: 201 });
}
