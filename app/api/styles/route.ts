import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

const MANAGE = ["ADMIN", "PR_MANAGER"] as const;
const DEFAULT_SHELF_LIFE_OPTIONS = ["日抛", "月抛", "半年抛"];

function parseShelfLifeOptions(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[、,，\n]/);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean))).slice(0, 20);
}

// 款式列表：所有登录用户可读（工单表单下拉使用）；active=1 只返回启用项
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const params = new URL(req.url).searchParams;
  const activeOnly = params.get("active") === "1";
  const kind = params.get("kind") ?? "STYLE";
  const brandId = params.get("brandId");
  const styles = await prisma.styleOption.findMany({
    where: { kind, ...(brandId ? { brandId } : {}), ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(styles);
}

// 新增款式：ADMIN / PR负责人
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...MANAGE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const brandId = String(body.brandId ?? "").trim();
  const shelfLifeOptions = parseShelfLifeOptions(body.shelfLifeOptions);
  if (!name) return NextResponse.json({ error: "款式名称不能为空" }, { status: 400 });
  if (!brandId) return NextResponse.json({ error: "请选择所属品牌" }, { status: 400 });
  if (name.length > 50) return NextResponse.json({ error: "款式名称不能超过 50 个字" }, { status: 400 });
  try {
    const style = await prisma.$transaction(async (tx) => {
      const last = await tx.styleOption.aggregate({ where: { kind: "STYLE", brandId }, _max: { sort: true } });
      const created = await tx.styleOption.create({
        data: { kind: "STYLE", brandId, name, shelfLifeOptions: shelfLifeOptions.length ? shelfLifeOptions : DEFAULT_SHELF_LIFE_OPTIONS, sort: (last._max.sort ?? 0) + 1 },
      });
      await writeLog(tx, {
        docType: "STYLE",
        docId: created.id,
        action: "CREATE",
        actorId: auth.userId,
        toStatus: "ENABLED",
        note: `新增款式「${name}」`,
      });
      return created;
    });
    return NextResponse.json(style, { status: 201 });
  } catch {
    return NextResponse.json({ error: "款式已存在" }, { status: 400 });
  }
}
