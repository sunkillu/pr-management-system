import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

const MATERIAL_TYPES = ["NOTE_LINK", "VIDEO", "IMAGE", "OTHER"];

// 新增回收素材：执行中工单可上传（ADMIN/PR/PR_MANAGER，且为创建人/审批链成员/ADMIN）
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["PENDING_MANUSCRIPT", "PENDING_PUBLISH", "PUBLISHED", "MATERIAL_REVIEW"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅执行中的工单可回收素材" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可回收素材" }, { status: 403 });
  }
  const body = await req.json();
  const type = String(body.type ?? "");
  if (!MATERIAL_TYPES.includes(type)) {
    return NextResponse.json({ error: "素材类型不正确" }, { status: 400 });
  }
  const url = String(body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "请填写素材链接" }, { status: 400 });
  }
  // 标签：只接受 MATERIAL 种类下的合法 id
  const rawTagIds: unknown[] = Array.isArray(body.tagIds) ? body.tagIds : [];
  const tagIds: string[] = Array.from(
    new Set(rawTagIds.map((t) => String(t)).filter(Boolean))
  ).slice(0, 20);
  if (tagIds.length > 0) {
    const valid = await prisma.tag.findMany({
      where: { id: { in: tagIds }, category: { key: "MATERIAL" } },
      select: { id: true },
    });
    const validIds = new Set(valid.map((t) => t.id));
    for (const id of tagIds) {
      if (!validIds.has(id)) {
        return NextResponse.json({ error: "存在无效的素材标签" }, { status: 400 });
      }
    }
  }
  const record = await prisma.$transaction(async (tx) => {
    const r = await tx.materialRecord.create({
      data: {
        ticketId: params.id,
        type: type as "NOTE_LINK" | "VIDEO" | "IMAGE" | "OTHER",
        url,
        note: String(body.note ?? "").trim() || null,
        tagIds,
        uploadedById: auth.userId,
      },
      include: { uploadedBy: { select: { name: true } } },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "CREATE",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      note: `回收素材：${url}`,
    });
    // 同步写标签归属（谁给这条素材打了什么标签）；重复冲突自动跳过
    if (tagIds.length > 0) {
      await tx.tagging.createMany({
        data: tagIds.map((tagId) => ({
          tagId,
          entityType: "MATERIAL" as const,
          entityId: r.id,
          createdById: auth.userId,
        })),
        skipDuplicates: true,
      });
    }
    return r;
  });
  return NextResponse.json(record, { status: 201 });
}
