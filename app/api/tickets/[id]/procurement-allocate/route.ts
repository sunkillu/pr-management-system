import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";
import { platformTagLabels } from "@/lib/labels";

// 采买分配：按已通过的 ProcurementItem 批量生成合作工单（ADMIN / PR负责人）。
// body: { allocations: [{ itemId, prId, quantity }] }
// 要求：采买工单为 PENDING_PROCUREMENT / APPROVED；每条 item 已通过且未分配；
// prId 必须是 PR 角色用户。分配完采买工单状态 → APPROVED。
// 子工单：ticketKind=COOPERATION，status=DRAFT，品牌/平台/款式继承，
// assigneeId=prId，parentId 指向采买工单，note 注明来源采买工单。
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const allocations: unknown[] = Array.isArray(body.allocations) ? body.allocations : [];
  if (allocations.length === 0) {
    return NextResponse.json({ error: "请至少分配一条采买请求" }, { status: 400 });
  }

  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: params.id },
    select: {
      id: true, ticketNo: true, title: true, ticketKind: true, status: true,
      brandId: true, platform: true, creatorId: true,
    },
  });
  if (!ticket) return NextResponse.json({ error: "工单不存在" }, { status: 404 });
  if (ticket.ticketKind !== "PROCUREMENT") {
    return NextResponse.json({ error: "仅采买工单可分配" }, { status: 400 });
  }
  if (!["PENDING_PROCUREMENT", "APPROVED"].includes(ticket.status)) {
    return NextResponse.json({ error: "仅待采买审批 / 已通过的采买工单可分配" }, { status: 400 });
  }

  // 校验每条分配：item 归属本单 + 已通过 + 未分配；prId 为 PR；itemId 不重复
  const parsed: { itemId: string; prId: string; quantity: number }[] = [];
  for (const raw of allocations) {
    const itemId = String((raw as { itemId?: unknown }).itemId ?? "").trim();
    const prId = String((raw as { prId?: unknown }).prId ?? "").trim();
    const quantity = Number((raw as { quantity?: unknown }).quantity ?? 0);
    if (!itemId || !prId || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "每条分配必须包含有效的 itemId、PR 和正整数数量" }, { status: 400 });
    }
    parsed.push({ itemId, prId, quantity });
  }
  const items = await prisma.procurementItem.findMany({
    where: { id: { in: parsed.map((p) => p.itemId) } },
  });
  if (items.length !== parsed.length) {
    return NextResponse.json({ error: "存在不存在的采买请求" }, { status: 404 });
  }
  for (const p of parsed) {
    const item = items.find((it) => it.id === p.itemId)!;
    if (item.ticketId !== params.id) {
      return NextResponse.json({ error: "采买请求不属于该工单" }, { status: 400 });
    }
    if (item.status !== "APPROVED") {
      return NextResponse.json({ error: `款式 ${item.style} 尚未通过审批，不可分配` }, { status: 400 });
    }
  }
  for (const item of items) {
    const requested = parsed.filter((p) => p.itemId === item.id).reduce((sum, p) => sum + p.quantity, 0);
    const existing = await prisma.procurementAllocation.aggregate({ where: { itemId: item.id }, _sum: { quantity: true } });
    const existingQty = existing._sum.quantity ?? 0;
    if (requested + existingQty > (item.approvedQty ?? item.quantity)) {
      return NextResponse.json({ error: `款式 ${item.style} 分配数量超出可分配数量，剩余 ${Math.max(0, (item.approvedQty ?? item.quantity) - existingQty)}` }, { status: 400 });
    }
  }
  const prIds = parsed.map((p) => p.prId).filter((v, i, a) => a.indexOf(v) === i);
  const prs = await prisma.user.findMany({
    where: { id: { in: prIds } },
    select: { id: true, name: true, role: true },
  });
  if (prs.length !== prIds.length) {
    return NextResponse.json({ error: "存在不存在的 PR" }, { status: 404 });
  }
  for (const pr of prs) {
    if (pr.role !== "PR") {
      return NextResponse.json({ error: `仅可分配给 PR 角色用户（${pr.name} 不是 PR）` }, { status: 400 });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const today = new Date();
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const baseCount = await tx.cooperationTicket.count({ where: { createdAt: { gte: dayStart } } });
    const platformLabel = platformTagLabels[ticket.platform[0]] ?? ticket.platform[0] ?? "";
    const out: { itemId: string; ticketId: string; ticketNo: string }[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const { itemId, prId, quantity } = parsed[i];
      const item = items.find((it) => it.id === itemId)!;
      const ticketNo = `${ymd}${String(baseCount + i + 1).padStart(4, "0")}`;
      const child = await tx.cooperationTicket.create({
        data: {
          ticketNo,
          title: `${platformLabel}+${ticketNo}`,
          type: "INFLUENCER_POST",
          brandId: ticket.brandId,
          ticketKind: "COOPERATION",
          parentId: ticket.id,
          // 采买分配建单无预算：budgetFee 列必填，存 0 占位（与维护工单一致），PR 补充合作信息时填写
          budgetFee: 0,
          platform: ticket.platform,
          style: [item.style],
          coopCategory: [],
          estimatedSchedule: "-",
          note: `由采买工单 ${ticket.ticketNo} 分配（款式：${item.style}，数量：${quantity}）`,
          status: "DRAFT",
          assigneeId: prId,
          creatorId: auth.userId,
        },
      });
      await tx.procurementAllocation.create({ data: { itemId, prId, quantity, ticketId: child.id } });
      const allocatedTotal = await tx.procurementAllocation.aggregate({ where: { itemId }, _sum: { quantity: true } });
      await tx.procurementItem.update({
        where: { id: itemId },
        data: { allocatedTicketId: (allocatedTotal._sum.quantity ?? 0) >= (item.approvedQty ?? item.quantity) ? child.id : item.allocatedTicketId },
      });
      await tx.ticketAssigneeLog.create({
        data: {
          ticketId: child.id,
          fromUserId: null,
          toUserId: prId,
          changedById: auth.userId,
          action: "ASSIGN",
          reason: `采买工单 ${ticket.ticketNo} 分配`,
        },
      });
      out.push({ itemId, ticketId: child.id, ticketNo });
    }
    await tx.cooperationTicket.update({
      where: { id: params.id },
      data: { status: "PROCUREMENT_GENERATED", procurementApprovedAt: new Date() },
    });
    await writeLog(tx, {
      docType: "TICKET",
      docId: params.id,
      action: "ASSIGN",
      actorId: auth.userId,
      fromStatus: ticket.status,
      toStatus: "PROCUREMENT_GENERATED",
      note: `采买分配：${out.length} 条请求已生成合作工单（${out.map((o) => o.ticketNo).join("、")}）`,
    });
    return out;
  });

  // 通知各被分配 PR
  for (const c of created) {
    const prId = parsed.find((p) => p.itemId === c.itemId)!.prId;
    await notifyUser(
      prId,
      `采买工单「${ticket.title}」已分配给你一张合作工单（${c.ticketNo}），请补充合作信息并提交。`,
      { type: "TICKET", id: c.ticketId, title: "采买分配", kind: "SYSTEM" },
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, allocated: created });
}
