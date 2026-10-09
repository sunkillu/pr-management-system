import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 更新：运营 / 管理员
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.campaignId) {
    return NextResponse.json({ error: "请选择关联项目" }, { status: 400 });
  }
  const report = await prisma.report.update({
    where: { id: params.id },
    data: {
      campaignId: body.campaignId,
      contentId: body.contentId || null,
      impressions: Number(body.impressions) || 0,
      reads: Number(body.reads) || 0,
      likes: Number(body.likes) || 0,
      comments: Number(body.comments) || 0,
      conversions: Number(body.conversions) || 0,
      gmv: body.gmv ?? "0",
      recordDate: body.recordDate ? new Date(body.recordDate) : undefined,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(report);
}

// 删除：运营 / 管理员
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  await prisma.report.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
