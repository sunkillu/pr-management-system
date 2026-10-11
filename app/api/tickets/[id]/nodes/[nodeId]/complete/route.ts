import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { canOperateTicket } from "@/lib/ticket-permission";
import { classifyNode } from "@/lib/node-rules";

// 标记进度节点完成（记录完成人/时间，可附推进说明记入日志）
// 仅创建人 / 审批链成员 / ADMIN 可操作
// 节点类型规则：寄品节点由仓库发货自动完成（禁止手动）；执行/内容节点 note 必填；
// 数据回收节点需先上传回收素材；MAKEUP 等其他类型保持原手动逻辑
export async function POST(req: NextRequest, { params }: { params: { id: string; nodeId: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (!["APPROVED", "IN_PROGRESS"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅待执行/执行中的工单可更新节点" }, { status: 400 });
  }
  if (!(await canOperateTicket(params.id, auth.userId, auth.role))) {
    return NextResponse.json({ error: "仅创建人、审批链成员或管理员可推进节点" }, { status: 403 });
  }
  const node = await prisma.ticketNode.findFirst({
    where: { id: params.nodeId, ticketId: params.id },
  });
  if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });
  if (node.completedAt) return NextResponse.json({ error: "该节点已完成" }, { status: 400 });

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
  if (kind === "CONTENT" && !note) {
    return NextResponse.json({ error: "请填写内容信息（如发布链接/平台）" }, { status: 400 });
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
  return NextResponse.json(updated);
}
