import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 工单内新建内容：ADMIN / PR / PR_MANAGER，初始为草稿，自动关联工单
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  const content = await prisma.$transaction(async (tx) => {
    const c = await tx.content.create({
      data: {
        title: body.title.trim(),
        type: body.type ?? "CAO_TEXT",
        body: body.body?.trim() || null,
        link: body.link?.trim() || null,
        outletId: body.outletId || null,
        ticketId: params.id,
        createdById: auth.userId,
        status: "DRAFT",
        platform: ["XIAOHONGSHU", "DOUYIN"].includes(body.platform) ? body.platform : null,
        style: body.style?.trim() || null,
        cost: body.cost != null && !isNaN(Number(body.cost)) ? Number(body.cost) : null,
      },
    });
    await writeLog(tx, {
      docType: "CONTENT",
      docId: c.id,
      action: "CREATE",
      actorId: auth.userId,
      fromStatus: null,
      toStatus: "DRAFT",
      note: `工单「${ticket.title}」内新建`,
    });
    return c;
  });
  return NextResponse.json(content, { status: 201 });
}
