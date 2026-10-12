import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

/**
 * 确认入库：按 accountId 比对总达人库
 * - 命中 → 老达人：关联现有达人，返回过往合作摘要
 * - 未命中 → 新达人：创建达人（直接 APPROVED 进入总库）
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const entry = await prisma.influencerLedger.findUnique({
    where: { id: params.id },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!entry) return NextResponse.json({ error: "台账不存在" }, { status: 404 });
  if (auth.role !== "ADMIN" && entry.ownerId !== auth.userId)
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (entry.status === "CONFIRMED")
    return NextResponse.json({ error: "已确认入库" }, { status: 400 });

  // 老/新识别：按 accountId（主页ID）比对
  let influencer = entry.accountId
    ? await prisma.influencer.findFirst({
        where: { homepageId: entry.accountId },
        include: {
          _count: { select: { tickets: true, cooperationRecords: true } },
        },
      })
    : null;

  const isNew = !influencer;
  if (!influencer) {
    // 新达人：创建并直接入库（APPROVED）
    influencer = await prisma.influencer.create({
      data: {
        name: entry.nickname || "待补充",
        homepageId: entry.accountId,
        platforms: entry.platforms.length > 0 ? entry.platforms : entry.platform ? [entry.platform] : [],
        contactInfo: entry.schedule ? `档期：${entry.schedule}` : null,
        bio: [
          entry.quote != null ? `报价：${entry.quote}` : null,
          entry.budget != null ? `预算：${entry.budget}` : null,
          entry.photoUrl ? `照片：${entry.photoUrl}` : null,
        ].filter(Boolean).join("；") || null,
        status: "APPROVED",
        registeredById: entry.ownerId,
        tags: [],
      },
      include: { _count: { select: { tickets: true, cooperationRecords: true } } },
    });
  }

  const updated = await prisma.influencerLedger.update({
    where: { id: params.id },
    data: { status: "CONFIRMED", influencerId: influencer.id },
    include: { influencer: { select: { id: true, name: true, homepageId: true } } },
  });

  // 老达人：返回过往记录摘要（一键查看）
  let history = null;
  if (!isNew) {
    const records = await prisma.cooperationRecord.findMany({
      where: { influencerId: influencer.id },
      select: { id: true, fee: true, coopDate: true, note: true },
      orderBy: { coopDate: "desc" },
      take: 5,
    });
    history = {
      coopCount: influencer._count.cooperationRecords,
      ticketCount: influencer._count.tickets,
      recentRecords: records,
    };
  }

  return NextResponse.json({ entry: updated, isNew, influencerId: influencer.id, history });
}
