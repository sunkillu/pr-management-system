import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ENTITY_TYPES = ["INFLUENCER", "COOP_REQUEST", "MATERIAL"] as const;

// 当前用户打过的所有标签（去重），用于筛选下拉"我的标签优先"
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const where: Record<string, unknown> = { createdById: auth.userId };
  if (entityType) {
    if (!ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
      return NextResponse.json({ error: "entityType 参数不正确" }, { status: 400 });
    }
    where.entityType = entityType;
  }
  const mine = await prisma.tagging.findMany({
    where,
    select: {
      tag: {
        select: {
          id: true,
          name: true,
          category: { select: { name: true, key: true } },
        },
      },
    },
  });
  const seen = new Set<string>();
  const list: { id: string; name: string; category: { name: string; key: string } }[] = [];
  for (const m of mine) {
    if (!seen.has(m.tag.id)) {
      seen.add(m.tag.id);
      list.push({ id: m.tag.id, name: m.tag.name, category: m.tag.category });
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return NextResponse.json(list);
}
