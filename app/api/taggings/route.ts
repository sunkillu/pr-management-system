import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const ALL_ROLES = ["ADMIN", "PR", "PR_MANAGER", "OPERATOR", "FINANCE", "VIEWER", "WAREHOUSE"] as const;
const ENTITY_TYPES = ["INFLUENCER", "COOP_REQUEST", "MATERIAL", "TICKET"] as const;

// 取某实体的打标签记录（全部角色可读）
export async function GET(req: NextRequest) {
  const auth = await requireRoles([...ALL_ROLES]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  if (!entityType || !ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
    return NextResponse.json({ error: "entityType 参数不正确" }, { status: 400 });
  }
  if (!entityId) {
    return NextResponse.json({ error: "entityId 参数缺失" }, { status: 400 });
  }
  const list = await prisma.tagging.findMany({
    where: { entityType: entityType as (typeof ENTITY_TYPES)[number], entityId },
    include: {
      tag: { include: { category: { select: { name: true, key: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

// 给实体打标签（ADMIN/PR/OPERATOR）
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const tagId = String(body.tagId ?? "");
  const entityType = String(body.entityType ?? "");
  const entityId = String(body.entityId ?? "");
  if (!tagId || !ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number]) || !entityId) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: { category: { select: { name: true, key: true } } },
  });
  if (!tag) return NextResponse.json({ error: "标签不存在" }, { status: 404 });
  try {
    const created = await prisma.tagging.create({
      data: {
        tagId,
        entityType: entityType as (typeof ENTITY_TYPES)[number],
        entityId,
        createdById: auth.userId,
      },
      include: {
        tag: { include: { category: { select: { name: true, key: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json({ error: "你已经给该实体打过这个标签" }, { status: 409 });
    }
    throw e;
  }
}
