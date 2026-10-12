import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { toCSV, csvResponse } from "@/lib/csv";
import { platformTagLabels } from "@/lib/labels";

// 工单汇总单：导出该工单的子内容明细 CSV（标题/平台/款式/花费/链接/状态 + 合计）
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER", "FINANCE", "PR", "VIEWER"]);
  if (!auth.ok) return auth.res;

  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    include: {
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
      contents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });

  // 数据权限：PR 只能导出自己创建的工单
  if (auth.role === "PR") {
    const mine = await prisma.cooperationTicket.findFirst({
      where: { id: params.id, creatorId: auth.userId },
      select: { id: true },
    });
    if (!mine) return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const partner = ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "";
  const totalCost = ticket.contents.reduce((s, c) => s + (c.cost != null ? Number(c.cost) : 0), 0);

  const csv = toCSV(
    ["工单号", "工单标题", "合作对象", "子内容标题", "平台", "款式", "花费(元)", "链接", "状态"],
    [
      ...ticket.contents.map((c) => [
        ticket.ticketNo,
        ticket.title,
        partner,
        c.title,
        c.platform ? (platformTagLabels[c.platform] ?? c.platform) : "",
        c.style ?? "",
        c.cost != null ? Number(c.cost).toFixed(2) : "",
        c.link ?? "",
        c.status,
      ]),
      ["", "", "", "合计", "", "", totalCost.toFixed(2), "", ""],
    ]
  );
  return csvResponse(`汇总单_${ticket.ticketNo}.csv`, csv);
}
