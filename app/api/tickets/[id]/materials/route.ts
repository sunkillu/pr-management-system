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
  if (ticket.status !== "IN_PROGRESS") {
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
  const record = await prisma.$transaction(async (tx) => {
    const r = await tx.materialRecord.create({
      data: {
        ticketId: params.id,
        type: type as "NOTE_LINK" | "VIDEO" | "IMAGE" | "OTHER",
        url,
        note: String(body.note ?? "").trim() || null,
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
    return r;
  });
  return NextResponse.json(record, { status: 201 });
}
