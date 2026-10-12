import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";

// 工单内内容维护：EDIT 编辑 / SUBMIT 提交审批 / APPROVE 通过 / REJECT 驳回 / PUBLISH 标记已发布
// 权限：ADMIN / PR / PR_MANAGER；审批类动作仅 ADMIN / PR_MANAGER
// 所有动作先校验 content.ticketId === 工单 id
export async function PATCH(req: NextRequest, { params }: { params: { id: string; contentId: string } }) {
  const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const action = body.action as "EDIT" | "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH";
  if (!["EDIT", "SUBMIT", "APPROVE", "REJECT", "PUBLISH"].includes(action)) {
    return NextResponse.json({ error: "action 非法" }, { status: 400 });
  }

  const existing = await prisma.content.findUnique({ where: { id: params.contentId } });
  if (!existing) return NextResponse.json({ error: "内容不存在" }, { status: 404 });
  if (existing.ticketId !== params.id) {
    return NextResponse.json({ error: "该内容不属于此工单" }, { status: 400 });
  }

  const isApprover = auth.role === "ADMIN" || auth.role === "PR_MANAGER";
  if ((action === "APPROVE" || action === "REJECT") && !isApprover) {
    return NextResponse.json({ error: "仅管理员 / PR负责人可审批" }, { status: 403 });
  }
  if (action === "REJECT" && !body.comment?.trim()) {
    return NextResponse.json({ error: "驳回必须填写理由" }, { status: 400 });
  }

  try {
    const [content] = await prisma.$transaction(async (tx) => {
    let updated;
    if (action === "EDIT") {
      if (!["DRAFT", "REJECTED"].includes(existing.status)) {
        throw new Error("仅草稿 / 已驳回的内容可编辑");
      }
      if (!body.title?.trim()) throw new Error("标题不能为空");
      updated = await tx.content.update({
        where: { id: params.contentId },
        data: {
          title: body.title.trim(),
          type: body.type ?? existing.type,
          body: body.body?.trim() || null,
          link: body.link?.trim() || null,
          outletId: body.outletId || null,
          platform: ["XIAOHONGSHU", "DOUYIN"].includes(body.platform) ? body.platform : null,
          style: body.style?.trim() || null,
          cost: body.cost != null && !isNaN(Number(body.cost)) ? Number(body.cost) : null,
          version: { increment: 1 },
          status: "DRAFT",
          rejectReason: null,
        },
      });
      await writeLog(tx, {
        docType: "CONTENT",
        docId: params.contentId,
        action: "EDIT",
        actorId: auth.userId,
        fromStatus: existing.status,
        toStatus: "DRAFT",
        note: null,
      });
    } else if (action === "SUBMIT") {
      if (!["DRAFT", "REJECTED"].includes(existing.status)) {
        throw new Error("当前状态不可提交审批");
      }
      const isResubmit = existing.status === "REJECTED";
      if (isResubmit && existing.createdById !== auth.userId && auth.role !== "ADMIN") {
        throw new Error("仅创建人本人或管理员可重新提交");
      }
      updated = await tx.content.update({
        where: { id: params.contentId },
        data: { status: "PENDING", rejectReason: null },
      });
      await writeLog(tx, {
        docType: "CONTENT",
        docId: params.contentId,
        action: isResubmit ? "RESUBMIT" : "SUBMIT",
        actorId: auth.userId,
        fromStatus: existing.status,
        toStatus: "PENDING",
        note: body.note?.trim() || null,
      });
    } else if (action === "APPROVE" || action === "REJECT") {
      if (existing.status !== "PENDING") throw new Error("仅待审批的内容可审批");
      const toStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      updated = await tx.content.update({
        where: { id: params.contentId },
        data: {
          status: toStatus,
          rejectReason: action === "REJECT" ? body.comment.trim() : null,
        },
      });
      await tx.approvalRecord.create({
        data: {
          stage: "CONTENT",
          action,
          comment: body.comment?.trim() || null,
          approverId: auth.userId,
          contentId: params.contentId,
        },
      });
      await writeLog(tx, {
        docType: "CONTENT",
        docId: params.contentId,
        action,
        actorId: auth.userId,
        fromStatus: "PENDING",
        toStatus,
        note: body.comment?.trim() || null,
      });
    } else {
      // PUBLISH
      if (existing.status !== "APPROVED") throw new Error("仅已通过的内容可标记发布");
      updated = await tx.content.update({
        where: { id: params.contentId },
        data: { status: "PUBLISHED" },
      });
      await writeLog(tx, {
        docType: "CONTENT",
        docId: params.contentId,
        action: "PUBLISH",
        actorId: auth.userId,
        fromStatus: "APPROVED",
        toStatus: "PUBLISHED",
        note: null,
      });
    }
    return [updated];
    });
    return NextResponse.json(content);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "操作失败" },
      { status: 400 }
    );
  }
}
