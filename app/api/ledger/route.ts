import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { fetchProfile } from "@/lib/ledger-fetch";

// 台账列表：PR 只看自己的，ADMIN 看全部
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const list = await prisma.influencerLedger.findMany({
    where: {
      ...(auth.role === "PR" ? { ownerId: auth.userId } : {}),
      ...(status ? { status: status as "DRAFT" | "CONFIRMED" } : {}),
    },
    include: {
      influencer: { select: { id: true, name: true, homepageId: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ list });
}

// 新增台账草稿：只填主页链接，自动抓取
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;

  const body = await req.json();
  const homeUrl = String(body.homeUrl || "").trim();
  if (!homeUrl) return NextResponse.json({ error: "主页链接必填" }, { status: 400 });

  const profile = await fetchProfile(homeUrl);
  const entry = await prisma.influencerLedger.create({
    data: {
      ownerId: auth.userId,
      homeUrl,
      platform: profile.platform,
      nickname: profile.nickname,
      accountId: profile.accountId,
      platforms: profile.platform ? [profile.platform] : [],
      status: "DRAFT",
    },
  });
  return NextResponse.json({ entry, mock: profile.mock });
}
