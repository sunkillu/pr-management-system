import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 提交发布链接：已返稿待发布 → 已发布
// body: { publishLink: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "PENDING_PUBLISH") {
    return NextResponse.json({ error: "仅已返稿待发布的工单可提交发布" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可操作" }, { status: 403 });
  }

  const body = await req.json();
  const link = String(body.publishLink ?? "").trim();
  if (!link) return NextResponse.json({ error: "请填写发布链接" }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "PUBLISHED", publishLink: link, publishAt: new Date() },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: "PENDING_PUBLISH",
      toStatus: "PUBLISHED",
      note: `已发布：${link}`,
    });
    return u;
  });
  return NextResponse.json(updated);
}
