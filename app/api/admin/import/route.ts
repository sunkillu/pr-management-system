import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { parseCSV, rowsToObjects } from "@/lib/csv";

// 基础数据导入（仅 ADMIN）：达人库 / 历史合作记录
// 两步：confirmed=false → 解析预览；confirmed=true → 执行导入

const TYPE_MAP: Record<string, "KOL" | "KOC" | "AMATEUR" | "MAKEUP_ARTIST"> = {
  KOL: "KOL",
  KOC: "KOC",
  "素人": "AMATEUR",
  "化妆师": "MAKEUP_ARTIST",
};

const PLATFORM_MAP: Record<string, string> = {
  "小红书": "XIAOHONGSHU",
  "抖音": "DOUYIN",
  XIAOHONGSHU: "XIAOHONGSHU",
  DOUYIN: "DOUYIN",
};

function splitMulti(v: string): string[] {
  return v.split(/[、，,;；\/|]/).map((s) => s.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const kind = body.kind as string;
  const csvText = String(body.csv ?? "");
  const confirmed = body.confirmed === true;

  if (!["influencers", "records"].includes(kind)) {
    return NextResponse.json({ error: "kind 仅支持 influencers / records" }, { status: 400 });
  }
  if (!csvText.trim()) {
    return NextResponse.json({ error: "CSV 内容为空" }, { status: 400 });
  }

  const rows = rowsToObjects(parseCSV(csvText));
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV 没有数据行" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: "单次最多导入 5000 行" }, { status: 400 });
  }

  if (kind === "influencers") return importInfluencers(rows, confirmed, auth.userId);
  return importRecords(rows, confirmed, auth.userId);
}

async function importInfluencers(
  rows: Record<string, string>[],
  confirmed: boolean,
  adminId: string
) {
  // 达人去重键：姓名 + 平台（排序后拼接）
  const existing = await prisma.influencer.findMany({
    select: { id: true, name: true, platforms: true },
  });
  const existingKeys = new Set(
    existing.map((e) => `${e.name}||${[...e.platforms].sort().join(",")}`)
  );

  type Parsed = {
    row: number;
    name: string;
    influencerType: "KOL" | "KOC" | "AMATEUR" | "MAKEUP_ARTIST" | null;
    platforms: string[];
    homepageId: string;
    quote: string;
    tags: string[];
    bio: string;
    errors: string[];
    dupKey: string;
  };

  const parsed: Parsed[] = rows.map((r, i) => {
    const errors: string[] = [];
    const name = r["姓名"] ?? "";
    if (!name) errors.push("姓名必填");
    const typeRaw = r["类型"] ?? "";
    const influencerType = TYPE_MAP[typeRaw] ?? null;
    if (typeRaw && !influencerType) errors.push(`类型"${typeRaw}"无法识别（KOL/KOC/素人/化妆师）`);
    const platforms = splitMulti(r["平台"] ?? "")
      .map((p) => PLATFORM_MAP[p])
      .filter(Boolean) as string[];
    if ((r["平台"] ?? "").trim() && platforms.length === 0) errors.push("平台无法识别（小红书/抖音）");
    const dupKey = `${name}||${[...platforms].sort().join(",")}`;
    return {
      row: i + 2,
      name,
      influencerType,
      platforms,
      homepageId: r["主页ID"] ?? "",
      quote: r["报价"] ?? "",
      tags: splitMulti(r["标签"] ?? ""),
      bio: r["备注"] ?? "",
      errors,
      dupKey,
    };
  });

  const valid = parsed.filter((p) => p.errors.length === 0);
  const skipped = valid.filter((p) => existingKeys.has(p.dupKey));
  const toCreate = valid.filter((p) => !existingKeys.has(p.dupKey));

  if (!confirmed) {
    return NextResponse.json({
      total: rows.length,
      validCount: toCreate.length,
      skipCount: skipped.length,
      errorCount: parsed.length - valid.length,
      preview: parsed.slice(0, 10).map((p) => ({
        row: p.row,
        name: p.name,
        platforms: p.platforms,
        errors: p.errors,
        skipped: p.errors.length === 0 && existingKeys.has(p.dupKey),
      })),
      errors: parsed
        .filter((p) => p.errors.length > 0)
        .slice(0, 20)
        .map((p) => `第${p.row}行：${p.errors.join("；")}`),
    });
  }

  let created = 0;
  for (const p of toCreate) {
    await prisma.influencer.create({
      data: {
        name: p.name,
        influencerType: p.influencerType,
        platforms: p.platforms,
        homepageId: p.homepageId || null,
        contactInfo: p.quote ? `报价：${p.quote}` : null,
        bio: p.bio || null,
        tags: p.tags,
        status: "APPROVED",
        registeredById: adminId,
      },
    });
    created++;
  }
  return NextResponse.json({
    total: rows.length,
    created,
    skipped: skipped.length,
    failed: parsed.length - valid.length,
  });
}

async function importRecords(
  rows: Record<string, string>[],
  confirmed: boolean,
  adminId: string
) {
  const influencers = await prisma.influencer.findMany({
    select: { id: true, name: true },
  });
  const byName = new Map(influencers.map((e) => [e.name, e.id]));

  type Parsed = {
    row: number;
    influencerName: string;
    influencerId: string | null;
    platform: string | null;
    style: string;
    fee: number | null;
    coopDate: Date | null;
    note: string;
    errors: string[];
  };

  const parsed: Parsed[] = rows.map((r, i) => {
    const errors: string[] = [];
    const influencerName = r["达人名"] ?? "";
    const influencerId = byName.get(influencerName) ?? null;
    if (!influencerName) errors.push("达人名必填");
    else if (!influencerId) errors.push(`达人"${influencerName}"不在库中，请先导入达人`);
    const platformRaw = (r["平台"] ?? "").trim();
    const platform = PLATFORM_MAP[platformRaw] ?? null;
    if (platformRaw && !platform) errors.push(`平台"${platformRaw}"无法识别`);
    const feeRaw = (r["费用"] ?? "").trim();
    const fee = feeRaw === "" ? null : Number(feeRaw);
    if (feeRaw !== "" && (isNaN(fee as number) || (fee as number) < 0)) errors.push("费用必须是数字");
    const dateRaw = (r["日期"] ?? "").trim();
    let coopDate: Date | null = null;
    if (dateRaw) {
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) errors.push(`日期"${dateRaw}"无法识别（用 YYYY-MM-DD）`);
      else coopDate = d;
    } else {
      errors.push("日期必填");
    }
    return {
      row: i + 2,
      influencerName,
      influencerId,
      platform,
      style: r["款式"] ?? "",
      fee,
      coopDate,
      note: r["备注"] ?? "",
      errors,
    };
  });

  const valid = parsed.filter((p) => p.errors.length === 0);

  if (!confirmed) {
    return NextResponse.json({
      total: rows.length,
      validCount: valid.length,
      errorCount: parsed.length - valid.length,
      preview: parsed.slice(0, 10).map((p) => ({
        row: p.row,
        influencerName: p.influencerName,
        fee: p.fee,
        errors: p.errors,
      })),
      errors: parsed
        .filter((p) => p.errors.length > 0)
        .slice(0, 20)
        .map((p) => `第${p.row}行：${p.errors.join("；")}`),
    });
  }

  let created = 0;
  for (const p of valid) {
    await prisma.$transaction(async (tx) => {
      await tx.cooperationRecord.create({
        data: {
          type: "INFLUENCER_POST",
          fee: p.fee ?? 0,
          coopDate: p.coopDate as Date,
          note: [p.style ? `款式：${p.style}` : "", p.platform ? `平台：${p.platform}` : "", p.note]
            .filter(Boolean)
            .join("；") || null,
          influencerId: p.influencerId,
          createdById: adminId,
        },
      });
      // 同步更新达人累计
      await tx.influencer.update({
        where: { id: p.influencerId as string },
        data: {
          coopCount: { increment: 1 },
          totalFee: { increment: p.fee ?? 0 },
        },
      });
    });
    created++;
  }
  return NextResponse.json({
    total: rows.length,
    created,
    failed: parsed.length - valid.length,
  });
}
