import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";
import { classifyNode } from "@/lib/node-rules";
import { notifyUser } from "@/lib/feishu-notify";

// 标记进度节点完成（记录完成人/时间，可附推进说明记入日志）
// 仅创建人 / 审批链成员 / ADMIN 可操作
// 节点类型规则：寄品节点由仓库发货自动完成（禁止手动）；执行/内容节点 note 必填；
// 数据回收节点需先上传回收素材；MAKEUP 等其他类型保持原手动逻辑
export async function POST(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["APPROVED", "IN_PROGRESS", "AWAITING_DRAFT", "PENDING_REVIEW", "DRAFT_RETURNED", "REVIEWED", "PUBLISHED"].includes(ticket.status)) {
    return NextResponse.json({ error: "当前工单状态不可更新节点" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可推进节点" }, { status: 403 });
  }
  const node = await prisma.ticketNode.findFirst({
    where: { id: params.nodeId, ticketId: params.id },
    include: { dependsOn: { select: { id: true, name: true, completedAt: true } } },
  });
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
  if (node.completedAt) return NextResponse.json({ error: "该节点已完成" }, { status: 400 });

  // 前置依赖校验：前置未完成时不允许完成
  if (node.dependsOn && !node.dependsOn.completedAt) {
    return NextResponse.json(
      { error: `需先完成前置节点「${node.dependsOn.name}」` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").trim() || null;
  const kind = classifyNode(node.name);

  // 寄品节点：仓库发货自动完成，禁止手动
  if (kind === "SHIP") {
    return NextResponse.json({ error: "寄品节点由仓库发货自动完成，无需手动操作" }, { status: 400 });
  }
  // 执行 / 内容节点：推进信息必填
  if (kind === "EXEC" && !note) {
    return NextResponse.json({ error: "请填写执行信息（推进说明）" }, { status: 400 });
  }
  if (kind === "CONTENT" && !/^https?:\/\/\S+$/i.test(note ?? "")) {
    return NextResponse.json({ error: "内容发布必须填写有效的发布链接（以 http:// 或 https:// 开头）" }, { status: 400 });
  }
  // 数据回收节点：必须先上传回收素材
  if (kind === "DATA") {
    const materialCount = await prisma.materialRecord.count({ where: { ticketId: params.id } });
    if (materialCount === 0) {
      return NextResponse.json({ error: "请先上传回收素材，再确认数据回收" }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.ticketNode.update({
      where: { id: node.id },
      data: { completedAt: new Date(), completedById: auth.userId },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "APPROVE",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: ticket.status,
      note: `完成进度节点「${node.name}」${note ? `：${note}` : ""}`,
    });
    return u;
  });

  // 解锁通知：依赖本节点的后置节点，通知工单创建人"已解锁"
  try {
    const dependents = await prisma.ticketNode.findMany({
      where: { dependsOnId: node.id, ticketId: params.id, completedAt: null, unlockedNotifiedAt: null },
      select: { id: true, name: true },
    });
    for (const d of dependents) {
      await notifyUser(
        ticket.creatorId,
        `合作工单「${ticket.title}」的前置节点「${node.name}」已完成，节点「${d.name}」已解锁，可以继续推进。`,
        { type: "TICKET", id: params.id, title: "节点已解锁", kind: "REMIND" }
      );
      await prisma.ticketNode.update({
        where: { id: d.id },
        data: { unlockedNotifiedAt: new Date() },
      });
    }
  } catch (e) {
    console.error("节点解锁通知失败:", e);
  }

  return NextResponse.json(updated);
}
