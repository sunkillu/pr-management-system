import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 更新：运营 / 管理员（关联内容全量替换）
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const contentIds: string[] = Array.isArray(body.contentIds) ? body.contentIds : [];
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
  }
  const campaign = await prisma.$transaction(async (tx) => {
    const current = await tx.campaign.findUniqueOrThrow({ where: { id: params.id } });
    const updated = await tx.campaign.update({
      where: { id: params.id },
      data: {
        name: body.name.trim(),
        description: body.description || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status,
        progressNotes: body.progressNotes || null,
        ownerId: body.ownerId || null,
        contents: { set: contentIds.map((id) => ({ id })) },
      },
    });
    if (current.status !== updated.status) {
      await writeLog(tx, {
        docType: "CAMPAIGN",
        docId: updated.id,
        action: "EDIT",
        actorId: auth.userId,
        fromStatus: current.status,
        toStatus: updated.status,
      });
    }
    return updated;
  });
  return NextResponse.json(campaign);
}

// 删除：运营 / 管理员（关联的效果报表会级联删除）
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  await prisma.campaign.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
