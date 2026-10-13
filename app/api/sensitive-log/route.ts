import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { LEVEL_A_FIELDS } from "@/lib/sensitive";

// A级敏感信息访问日志。
// 规范：日志只记录字段名（fields: ["phone","quoteAmount"]），绝不记录字段值；
// 普通业务日志（ApprovalLog 等）中也不得写入敏感字段值。

const TARGET_TYPES = ["INFLUENCER"] as const;
const ALL_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"] as const;

// POST 记录一次敏感字段查看：{ targetType, targetId, fields, source? }
// viewerId 强制取当前登录用户，不允许代他人记日志。
export async function POST(req: NextRequest) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const targetType = String(body.targetType ?? "");
  const targetId = String(body.targetId ?? "");
  const fields: string[] = Array.isArray(body.fields)
    ? body.fields.map((f: unknown) => String(f))
    : [];
  const source = body.source != null ? String(body.source).slice(0, 200) : null;

  if (!(TARGET_TYPES as readonly string[]).includes(targetType) || !targetId) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const validFields = Array.from(
    new Set(fields.filter((f) => (LEVEL_A_FIELDS as readonly string[]).includes(f)))
  );
  if (validFields.length === 0) {
    return NextResponse.json({ error: "fields 不能为空且必须为 A级字段" }, { status: 400 });
  }

  const log = await prisma.sensitiveAccessLog.create({
    data: {
      viewerId: auth.userId,
      targetType,
      targetId,
      fields: validFields,
      source,
    },
  });
  return NextResponse.json({ id: log.id }, { status: 201 });
}

// GET ?targetType=INFLUENCER&targetId=xxx：查询某对象的敏感访问日志，仅 ADMIN。
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const targetType = searchParams.get("targetType") ?? "";
  const targetId = searchParams.get("targetId") ?? "";
  if (!targetType || !targetId) {
    return NextResponse.json({ error: "缺少 targetType / targetId" }, { status: 400 });
  }
  const logs = await prisma.sensitiveAccessLog.findMany({
    where: { targetType, targetId },
    include: { viewer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(logs);
}
