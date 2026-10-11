import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 达人轻量预览（供悬浮卡片用）：所有登录用户可查，但 PR 只能预览自己登记的
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
      status: true,
      tags: true,
      coopCount: true,
      totalFee: true,
      registeredById: true,
    },
  });
  if (!influencer) return NextResponse.json({ error: "达人不存在" }, { status: 404 });
  // 数据权限：PR 只能看自己登记的
  if (auth.role === "PR" && influencer.registeredById !== auth.userId) {
    return NextResponse.json({ error: "无权查看" }, { status: 403 });
  }
  return NextResponse.json({
    id: influencer.id,
    name: influencer.name,
    homepageId: influencer.homepageId,
    influencerType: influencer.influencerType,
    platforms: influencer.platforms,
    status: influencer.status,
    tags: influencer.tags,
    coopCount: influencer.coopCount,
    totalFee: influencer.totalFee.toString(),
  });
}
