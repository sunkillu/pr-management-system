import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { getPagination } from "@/lib/pagination";

// 列表：ADMIN 全看；OPERATOR 看自己提的；PR 看分发给自己的（含待分发的可接单？仅看已分发的）
export async function GET(req: Request) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR", "PR_MANAGER", "FINANCE", "VIEWER"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const pagination = getPagination(searchParams.get("page") ?? undefined);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const mine = searchParams.get("mine") === "1";

  const where: Record<string, unknown> = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };
  if (auth.role === "OPERATOR" && !mine) {
    where.createdById = auth.userId;
  }
  if (auth.role === "PR" || mine) {
    where.tasks = { some: { assigneeId: auth.userId } };
  }

  const [list, total] = await Promise.all([
    prisma.procurementRequest.findMany({
      where: where as never,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.procurementRequest.count({ where: where as never }),
  ]);
  return NextResponse.json({ list, total, page: pagination.page, pageSize: 50 });
}

// 新建采买需求：OPERATOR / ADMIN
export async function POST(req: Request) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;

  const body = await req.json();
  const { title, type, styles, quantity, materialType, reason, publishLinks } = body ?? {};
  if (!title?.trim()) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  if (!["WEEKLY_STYLE", "LINK_SPECIFIC"].includes(type)) {
    return NextResponse.json({ error: "采买类型非法" }, { status: 400 });
  }
  if (type === "WEEKLY_STYLE") {
    if (!Array.isArray(styles) || styles.length === 0) {
      return NextResponse.json({ error: "周维度采买需选择款式（可多选）" }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "请填写需求数量" }, { status: 400 });
    }
  }
  if (type === "LINK_SPECIFIC") {
    if (!materialType?.trim()) return NextResponse.json({ error: "请填写素材类型" }, { status: 400 });
  }

  const created = await prisma.procurementRequest.create({
    data: {
      title: title.trim(),
      type,
      styles: type === "WEEKLY_STYLE" ? styles : [],
      quantity: type === "WEEKLY_STYLE" ? quantity : null,
      materialType: type === "LINK_SPECIFIC" ? materialType?.trim() : null,
      reason: type === "LINK_SPECIFIC" ? reason?.trim() || null : null,
      publishLinks: type === "LINK_SPECIFIC" && Array.isArray(publishLinks) ? publishLinks.filter((l: string) => l?.trim()) : [],
      createdById: auth.userId,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
