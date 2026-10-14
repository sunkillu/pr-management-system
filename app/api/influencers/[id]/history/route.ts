import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { filterInfluencer, canViewSensitive } from "@/lib/sensitive";
import { influencerOwnerFilter } from "@/lib/influencer-access";

// GET /api/influencers/[id]/history — 达人历史合作记录（提报表单用）
// A级字段（phone/wechat/email/quoteAmount）按 canViewSensitive 过滤；
// A级可见时写 SensitiveAccessLog（只记字段名，不记值）。
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const influencer = await prisma.influencer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      homepageId: true,
      influencerType: true,
      platforms: true,
      contactInfo: true,
      bio: true,
      status: true,
      phone: true,
      wechat: true,
      email: true,
      registeredById: true,
      registeredBy: { select: { name: true } },
      lastPublishDate: true,
    },
  });
  if (!influencer) return NextResponse.json({ error: "达人不存在" }, { status: 404 });

  // 对应 PR：关联工单的 assignee
  const assigned = await prisma.cooperationTicket.findMany({
    where: { influencerId: params.id, assigneeId: { not: null } },
    select: { assigneeId: true },
  });
  const assigneeIds = assigned.map((t) => t.assigneeId).filter(Boolean) as string[];
  const viewer = { role: auth.role, id: auth.userId };
  const canViewA = canViewSensitive(auth.role, auth.userId, {
    registeredById: influencer.registeredById,
    assigneeIds,
  });
  const filteredInfluencer = filterInfluencer({ ...influencer, assigneeIds }, viewer);

  // 历史合作记录：父工单（完整合作），最新 10 条
  const tickets = await prisma.cooperationTicket.findMany({
    where: { influencerId: params.id, parentId: null, ticketKind: "COOPERATION" },
    select: {
      id: true,
      ticketNo: true,
      title: true,
      type: true,
      style: true,
      platform: true,
      quoteAmount: true,
      publishDate: true,
      publishLink: true,
      status: true,
      assignee: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const [records, shipments, reviews] = await Promise.all([
    prisma.cooperationRecord.findMany({
      where: { influencerId: params.id },
      orderBy: { coopDate: "desc" },
      take: 10,
    }),
    prisma.sampleShipment.findMany({
      where: { influencerId: params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.cooperationReview.findMany({
      where: { influencerId: params.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // A级可见时写访问日志（只记字段名）
  if (canViewA) {
    await prisma.sensitiveAccessLog.create({
      data: {
        viewerId: auth.userId,
        targetType: "INFLUENCER",
        targetId: params.id,
        fields: ["phone", "wechat", "email", "quoteAmount"],
        source: new URL(req.url).pathname,
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    influencer: filteredInfluencer,
    canViewA,
    tickets: tickets.map((t) => ({
      ...t,
      // 报价 A级：无权限置 null
      quoteAmount: canViewA ? t.quoteAmount?.toString() ?? null : null,
    })),
    records: records.map((r) => ({
      ...r,
      // 费用 A级：无权限置 null
      fee: canViewA ? r.fee?.toString() ?? null : null,
    })),
    shipments,
    reviews: reviews.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
    })),
  });
}
