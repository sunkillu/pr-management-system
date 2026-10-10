import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 录入效果数据：运营 / 管理员
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.campaignId) {
    return NextResponse.json({ error: "请选择关联项目" }, { status: 400 });
  }
  const report = await prisma.report.create({
    data: {
      campaignId: body.campaignId,
      contentId: body.contentId || null,
      impressions: Number(body.impressions) || 0,
      reads: Number(body.reads) || 0,
      likes: Number(body.likes) || 0,
      comments: Number(body.comments) || 0,
      conversions: Number(body.conversions) || 0,
      gmv: body.gmv ?? "0",
      recordDate: body.recordDate ? new Date(body.recordDate) : new Date(),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(report, { status: 201 });
}
