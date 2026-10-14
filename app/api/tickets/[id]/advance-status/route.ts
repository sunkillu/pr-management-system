import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";

// 工单返稿/发布状态推进：
//   IN_PROGRESS / COMPLETED → PENDING_REVIEW（待返稿，需确定档期 confirmedDate）
//   PENDING_REVIEW → REVIEWED（已返稿）
//   REVIEWED → PUBLISHED（已发布，需发布链接 publishLink；同时记 publishDate=今天，供数据回收定时任务用）
const ALLOWED: Record<string, string[]> = {
  IN_PROGRESS: ["PENDING_REVIEW"],
  COMPLETED: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["REVIEWED"],
  REVIEWED: ["PUBLISHED"],
};

const TARGET_LABEL: Record<string, string> = {
  PENDING_REVIEW: "待返稿",
  REVIEWED: "已返稿",
  PUBLISHED: "已发布",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可推进状态" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const to = String(body.to ?? "");
  if (!["PENDING_REVIEW", "REVIEWED", "PUBLISHED"].includes(to)) {
    return NextResponse.json({ error: "目标状态非法" }, { status: 400 });
  }
  if (!(ALLOWED[ticket.status] ?? []).includes(to)) {
    return NextResponse.json(
      { error: `当前状态「${ticket.status}」不可推进到「${TARGET_LABEL[to] ?? to}」` },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = { status: to };
  let note = `状态推进到${TARGET_LABEL[to]}`;
  if (to === "PENDING_REVIEW") {
    const cd = typeof body.confirmedDate === "string" ? body.confirmedDate.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cd)) {
      return NextResponse.json({ error: "填写确定档期后才能进入待返稿" }, { status: 400 });
    }
    data.confirmedDate = new Date(cd);
    note = `填写确定档期 ${cd}，进入待返稿`;
  }
  if (to === "PUBLISHED") {
    const link = typeof body.publishLink === "string" ? body.publishLink.trim() : "";
    if (!link) {
      return NextResponse.json({ error: "填写发布链接后才能标记已发布" }, { status: 400 });
    }
    data.publishLink = link;
    // 发布日期记为今天：数据回收定时任务按 publishDate + 7 天建任务
    data.publishDate = new Date();
    note = `填写发布链接，进入已发布`;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.cooperationTicket.update({ where: { id: params.id }, data });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: to,
      note,
    });
    return u;
  });
  return NextResponse.json(updated);
}
