import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 列表：所有登录用户可查
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const list = await prisma.cooperationRecord.findMany({
    where: { ...(type ? { type: type as never } : {}) },
    include: {
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { coopDate: "desc" },
  });
  return NextResponse.json(list);
}

// 新增合作记录：保存后自动累计对应达人/化妆师的合作次数与累计费用（同事务）
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const type = body.type as "INFLUENCER_POST" | "INFLUENCER_LIVE" | "MAKEUP" | undefined;
  if (!type || !["INFLUENCER_POST", "INFLUENCER_LIVE", "MAKEUP"].includes(type)) {
    return NextResponse.json({ error: "合作类型非法" }, { status: 400 });
  }
  const fee = Number(body.fee);
  if (!fee || fee <= 0) {
    return NextResponse.json({ error: "合作费用必须大于 0" }, { status: 400 });
  }
  if (!body.coopDate) {
    return NextResponse.json({ error: "合作日期不能为空" }, { status: 400 });
  }
  const influencerId: string | null = body.influencerId || null;
  const makeupArtistId: string | null = body.makeupArtistId || null;
  if (type === "MAKEUP" && !makeupArtistId) {
    return NextResponse.json({ error: "化妆师合作必须选择化妆师" }, { status: 400 });
  }
  if (type !== "MAKEUP" && !influencerId) {
    return NextResponse.json({ error: "达人合作必须选择达人" }, { status: 400 });
  }
  // 达人合作要求达人已通过审核
  if (influencerId) {
    const inf = await prisma.influencer.findUnique({ where: { id: influencerId } });
    if (!inf) return NextResponse.json({ error: "达人不存在" }, { status: 404 });
    if (inf.status !== "APPROVED") {
      return NextResponse.json({ error: "该达人尚未通过审核，不能记录合作" }, { status: 400 });
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.cooperationRecord.create({
      data: {
        type,
        fee: body.fee,
        coopDate: new Date(body.coopDate),
        note: body.note || null,
        influencerId,
        makeupArtistId,
        createdById: auth.userId,
      },
    });
    if (influencerId) {
      await tx.influencer.update({
        where: { id: influencerId },
        data: { coopCount: { increment: 1 }, totalFee: { increment: fee } },
      });
    }
    if (makeupArtistId) {
      await tx.makeupArtist.update({
        where: { id: makeupArtistId },
        data: { coopCount: { increment: 1 }, totalFee: { increment: fee } },
      });
    }
    return created;
  });
  return NextResponse.json(record, { status: 201 });
}
