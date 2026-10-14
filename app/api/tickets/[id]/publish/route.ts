import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { createDataTask } from "@/lib/data-collection";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const publishLink = String(body.publishLink ?? "").trim();
  if (!/^https?:\/\//i.test(publishLink)) return NextResponse.json({ error: "请填写有效的发布链接" }, { status: 400 });
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id }, select: { status: true, creatorId: true, title: true } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.status !== "DRAFT_RETURNED") return NextResponse.json({ error: "仅已返稿工单可标记发布" }, { status: 400 });
  const published = await prisma.$transaction(async (tx) => {
    const result = await tx.cooperationTicket.updateMany({ where: { id: params.id, status: ticket.status }, data: { status: "PUBLISHED", publishLink, publishDate: new Date() } });
    if (result.count !== 1) return null;
    await writeLog(tx, { docType: "TICKET", docId: params.id, action: "PUBLISH", actorId: auth.userId, fromStatus: ticket.status, toStatus: "PUBLISHED", note: `发布链接：${publishLink}` });
    return tx.cooperationTicket.findUnique({ where: { id: params.id } });
  });
  if (!published) return NextResponse.json({ error: "状态已变化，请刷新后重试" }, { status: 409 });
  await createDataTask(params.id);
  return NextResponse.json(published);
}
