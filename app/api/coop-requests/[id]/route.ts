import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 详情：所有登录用户可查（含审批人、操作日志、通知记录）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const request = await prisma.cooperationRequest.findUnique({
    where: { id: params.id },
    include: { submitter: { select: { name: true } } },
  });
  if (!request) return NextResponse.json({ error: "合作需求不存在" }, { status: 404 });
  const approvers = await prisma.requestApprover.findMany({
    where: { requestType: "COOP_REQUEST", requestId: params.id },
    include: { approver: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const logs = await prisma.approvalLog.findMany({
    where: { docType: "COOP_REQUEST", docId: params.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const notifications = await prisma.notificationLog.findMany({
    where: { relatedType: "COOP_REQUEST", relatedId: params.id },
    include: { receiver: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ request, approvers, logs, notifications });
}

// 编辑：仅待审批/已驳回可编辑
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.cooperationRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "合作需求不存在" }, { status: 404 });
  if (!["PENDING", "REJECTED"].includes(existing.status)) {
    return NextResponse.json({ error: "仅待审批 / 已驳回的需求可编辑" }, { status: 400 });
  }
  const updated = await prisma.cooperationRequest.update({
    where: { id: params.id },
    data: {
      title: body.title?.trim() || undefined,
      reqType: body.reqType?.trim() || undefined,
      description: body.description?.trim() || undefined,
      attachments: body.attachments !== undefined ? body.attachments : undefined,
    },
  });
  return NextResponse.json(updated);
}
