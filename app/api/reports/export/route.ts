import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 导出 CSV：所有登录用户可导出（含 BOM，Excel 打开不乱码）
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  const reports = await prisma.report.findMany({
    where: campaignId ? { campaignId } : {},
    include: { campaign: true, content: true },
    orderBy: [{ campaign: { name: "asc" } }, { recordDate: "desc" }],
  });

  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ["项目", "关联内容", "曝光", "阅读", "点赞", "评论", "转化", "GMV(元)", "记录日期", "备注"];
  const lines = reports.map((r) =>
    [
      r.campaign.name,
      r.content?.title ?? "",
      r.impressions,
      r.reads,
      r.likes,
      r.comments,
      r.conversions,
      String(r.gmv),
      r.recordDate.toISOString().slice(0, 10),
      r.notes ?? "",
    ]
      .map(esc)
      .join(",")
  );

  const csv = "﻿" + [header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
