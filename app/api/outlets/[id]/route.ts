import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 更新：运营 / 管理员
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  }
  const outlet = await prisma.$transaction(async (tx) => {
    const current = await tx.mediaOutlet.findUniqueOrThrow({ where: { id: params.id } });
    const updated = await tx.mediaOutlet.update({
      where: { id: params.id },
      data: {
        name: body.name.trim(),
        type: body.type,
        platform: body.platform,
        followers: Number(body.followers) || 0,
        contactName: body.contactName || null,
        contactInfo: body.contactInfo || null,
        priceQuote: body.priceQuote ?? null,
        rating: body.rating != null && body.rating !== "" ? Number(body.rating) : null,
        notes: body.notes || null,
        status: body.status,
      },
    });
    if (current.status !== updated.status) {
      await writeLog(tx, {
        docType: "OUTLET",
        docId: updated.id,
        action: "EDIT",
        actorId: auth.userId,
        fromStatus: current.status,
        toStatus: updated.status,
      });
    }
    return updated;
  });
  return NextResponse.json(outlet);
}

// 删除：运营 / 管理员
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  await prisma.mediaOutlet.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
