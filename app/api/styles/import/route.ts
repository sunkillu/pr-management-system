import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { parseCSV, rowsToObjects, toCSV, csvResponse } from "@/lib/csv";
import { writeLog } from "@/lib/approval-log";

const MANAGE = ["ADMIN", "PR_MANAGER"] as const;

function parseActive(value: string): boolean | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return true;
  if (["启用", "有效", "ACTIVE", "ENABLED", "1", "是"].includes(normalized)) return true;
  if (["停用", "禁用", "无效", "DISABLED", "INACTIVE", "0", "否"].includes(normalized)) return false;
  return null;
}

export async function GET() {
  const auth = await requireRoles([...MANAGE]);
  if (!auth.ok) return auth.res;
  return csvResponse(
    "合作款式导入模板.csv",
    toCSV(["款式名称", "状态", "排序"], [["春季新品", "启用", 1], ["清仓款", "停用", 2]])
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles([...MANAGE]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const csv = String(body.csv ?? "");
  const confirmed = body.confirmed === true;
  if (!csv.trim()) return NextResponse.json({ error: "CSV 内容为空" }, { status: 400 });

  const rows = rowsToObjects(parseCSV(csv));
  if (!rows.length) return NextResponse.json({ error: "CSV 没有数据行" }, { status: 400 });
  if (rows.length > 5000) return NextResponse.json({ error: "单次最多导入 5000 行" }, { status: 400 });

  const existing = await prisma.styleOption.findMany({
    where: { kind: "STYLE" },
    select: { id: true, name: true, isActive: true, sort: true },
  });
  const existingByName = new Map(existing.map((style) => [style.name.toLowerCase(), style]));
  const seen = new Set<string>();
  const parsed = rows.map((row, index) => {
    const errors: string[] = [];
    const name = (row["款式名称"] ?? row["款式"] ?? row["名称"] ?? "").trim();
    const key = name.toLowerCase();
    if (!name) errors.push("款式名称必填");
    if (name.length > 50) errors.push("款式名称不能超过 50 个字");
    if (name && seen.has(key)) errors.push("文件内重复");
    if (name) seen.add(key);
    const active = parseActive(row["状态"] ?? "");
    if (active === null) errors.push("状态只能填写启用/停用");
    const sortRaw = (row["排序"] ?? "").trim();
    const sort = sortRaw ? Number(sortRaw) : null;
    if (sortRaw && (!Number.isInteger(sort) || (sort as number) < 0)) errors.push("排序必须是大于等于 0 的整数");
    return {
      row: index + 2,
      name,
      active: active ?? true,
      sort,
      action: existingByName.has(key) ? "更新" : "新增",
      errors,
    };
  });
  const valid = parsed.filter((row) => row.errors.length === 0);

  if (!confirmed) {
    return NextResponse.json({
      total: parsed.length,
      validCount: valid.length,
      createCount: valid.filter((row) => row.action === "新增").length,
      updateCount: valid.filter((row) => row.action === "更新").length,
      errorCount: parsed.length - valid.length,
      preview: parsed.slice(0, 10),
      errors: parsed.filter((row) => row.errors.length).slice(0, 20).map((row) => `第${row.row}行：${row.errors.join("；")}`),
    });
  }

  let created = 0;
  let updated = 0;
  let nextSort = Math.max(0, ...existing.map((style) => style.sort)) + 1;
  await prisma.$transaction(async (tx) => {
    for (const row of valid) {
      const current = existingByName.get(row.name.toLowerCase());
      if (current) {
        const style = await tx.styleOption.update({
          where: { id: current.id },
          data: { isActive: row.active, ...(row.sort === null ? {} : { sort: row.sort }) },
        });
        await writeLog(tx, {
          docType: "STYLE",
          docId: style.id,
          action: "EDIT",
          actorId: auth.userId,
          fromStatus: current.isActive ? "ENABLED" : "DISABLED",
          toStatus: style.isActive ? "ENABLED" : "DISABLED",
          note: `文件维护款式「${style.name}」`,
        });
        updated++;
      } else {
        const style = await tx.styleOption.create({
          data: { kind: "STYLE", name: row.name, isActive: row.active, sort: row.sort ?? nextSort++ },
        });
        await writeLog(tx, {
          docType: "STYLE",
          docId: style.id,
          action: "CREATE",
          actorId: auth.userId,
          toStatus: style.isActive ? "ENABLED" : "DISABLED",
          note: `文件导入款式「${style.name}」`,
        });
        created++;
      }
    }
  });
  return NextResponse.json({ total: parsed.length, created, updated, failed: parsed.length - valid.length });
}
