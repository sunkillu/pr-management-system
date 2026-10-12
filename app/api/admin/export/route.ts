import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { toCSV, csvResponse } from "@/lib/csv";
import { platformTagLabels } from "@/lib/labels";

// 数据导出（仅 ADMIN）：GET /api/admin/export?type=influencers|tickets|payments|contents&from=YYYY-MM-DD&to=YYYY-MM-DD

function dateRange(searchParams: URLSearchParams): { gte?: Date; lte?: Date } {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const r: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from + "T00:00:00");
    if (!isNaN(d.getTime())) r.gte = d;
  }
  if (to) {
    const d = new Date(to + "T23:59:59");
    if (!isNaN(d.getTime())) r.lte = d;
  }
  return r;
}

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";
const fmtMoney = (v: unknown) => (v == null ? "" : Number(v).toFixed(2));
const fmtPlatforms = (ps: string[]) => ps.map((p) => platformTagLabels[p] ?? p).join("、");

export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") ?? "";
  const range = dateRange(sp);
  const createdAt =
    range.gte || range.lte ? { ...(range.gte ? { gte: range.gte } : {}), ...(range.lte ? { lte: range.lte } : {}) } : undefined;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  if (type === "influencers") {
    const list = await prisma.influencer.findMany({
      where: createdAt ? { createdAt } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 10000,
    });
    // 最近合作：取最近一条合作记录日期
    const csv = toCSV(
      ["姓名", "类型", "平台", "主页ID", "标签", "合作次数", "累计费用", "状态", "登记人", "创建时间"],
      list.map((e) => [
        e.name,
        e.influencerType ?? "",
        fmtPlatforms(e.platforms),
        e.homepageId ?? "",
        e.tags.join("、"),
        e.coopCount,
        fmtMoney(e.totalFee),
        e.status,
        "",
        fmtDate(e.createdAt),
      ])
    );
    return csvResponse(`达人导出_${stamp}.csv`, csv);
  }

  if (type === "tickets") {
    const list = await prisma.cooperationTicket.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: { influencer: { select: { name: true } }, makeupArtist: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCSV(
      ["工单号", "标题", "合作对象", "平台", "款式", "合作类目", "预算费用", "实际费用", "状态", "创建时间"],
      list.map((t) => [
        t.ticketNo,
        t.title,
        t.influencer?.name ?? t.makeupArtist?.name ?? "",
        fmtPlatforms(t.platform),
        t.style.join("、"),
        t.coopCategory.join("、"),
        fmtMoney(t.budgetFee),
        t.actualFee != null ? fmtMoney(t.actualFee) : "",
        t.status,
        fmtDate(t.createdAt),
      ])
    );
    return csvResponse(`工单导出_${stamp}.csv`, csv);
  }

  if (type === "payments") {
    const list = await prisma.paymentRequest.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: { requester: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCSV(
      ["标题", "金额", "收款人", "收款账号", "事由", "状态", "申请人", "创建时间"],
      list.map((p) => [
        p.title,
        fmtMoney(p.amount),
        p.payeeName,
        p.payeeAccount ?? "",
        (p.reason ?? "").slice(0, 100),
        p.status,
        p.requester?.name ?? "",
        fmtDate(p.createdAt),
      ])
    );
    return csvResponse(`打款导出_${stamp}.csv`, csv);
  }

  if (type === "contents") {
    const list = await prisma.content.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: {
        ticket: { select: { ticketNo: true, title: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCSV(
      ["标题", "类型", "所属工单", "平台", "款式", "花费", "链接", "状态", "创建人", "创建时间"],
      list.map((c) => [
        c.title,
        c.type,
        c.ticket ? `${c.ticket.ticketNo} ${c.ticket.title}` : "",
        c.platform ? (platformTagLabels[c.platform] ?? c.platform) : "",
        c.style ?? "",
        c.cost != null ? fmtMoney(c.cost) : "",
        c.link ?? "",
        c.status,
        c.createdBy?.name ?? "",
        fmtDate(c.createdAt),
      ])
    );
    return csvResponse(`内容导出_${stamp}.csv`, csv);
  }

  return new Response(
    JSON.stringify({ error: "type 仅支持 influencers / tickets / payments / contents" }),
    { status: 400 }
  );
}
