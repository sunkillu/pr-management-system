import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { writeLog } from "@/lib/approval-log";
import { notifyUser } from "@/lib/feishu-notify";

// 去重处理列表：仅 ADMIN / PR_MANAGER
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const logs = await prisma.influencerSubmitLog.findMany({
    where: { result: "PENDING" },
    include: {
      newInfluencer: {
        include: { registeredBy: { select: { name: true } } },
      },
      existingInfluencer: {
        include: { registeredBy: { select: { name: true } } },
      },
      submittedBy: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
  return NextResponse.json(logs);
}

// 去重处理：三选一 —— MERGE（更新合并）/ KEEP（保留原有）/ REJECT（拒绝）
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const { logId, action, reason } = body as {
    logId: string;
    action: "MERGE" | "KEEP" | "REJECT";
    reason?: string;
  };
  if (!logId || !["MERGE", "KEEP", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }
  if (action === "REJECT" && !reason?.trim()) {
    return NextResponse.json({ error: "拒绝必须填写理由" }, { status: 400 });
  }

  const log = await prisma.influencerSubmitLog.findUnique({
    where: { id: logId },
    include: { newInfluencer: true, existingInfluencer: true },
  });
  if (!log) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  if (log.result !== "PENDING") {
    return NextResponse.json({ error: "该记录已处理" }, { status: 400 });
  }

  const { newInfluencer: fresh, existingInfluencer: existing } = log;
  const newData = log.newData as Record<string, unknown>;

  await prisma.$transaction(async (tx) => {
    if (action === "MERGE") {
      // 按字段合并：新提交的非空字段覆盖到原有记录；品牌取并集
      const patch: Record<string, unknown> = {};
      const fields = ["name", "influencerType", "platforms", "contactInfo", "homepageId", "bio", "tags"] as const;
      for (const f of fields) {
        const v = newData[f];
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && !v.trim()) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        patch[f] = v;
      }
      // 品牌合并：原有品牌 + 新提交品牌去重并集
      const existingBrands = Array.isArray(existing.brands) ? existing.brands : [];
      const newBrands = Array.isArray(newData.brands) ? (newData.brands as string[]) : [];
      const mergedBrands = Array.from(new Set([...existingBrands, ...newBrands]));
      if (mergedBrands.length > existingBrands.length) {
        patch.brands = mergedBrands;
      }
      if (Object.keys(patch).length > 0) {
        await tx.influencer.update({ where: { id: existing.id }, data: patch });
      }
      // 新提交的标记为已合并
      await tx.influencer.update({
        where: { id: fresh.id },
        data: { dupStatus: "MERGED" },
      });
      await tx.influencerSubmitLog.update({
        where: { id: logId },
        data: {
          result: "MERGED",
          handledById: auth.userId,
          handledAt: new Date(),
          reason: reason?.trim() || null,
        },
      });
      await writeLog(tx, {
        docType: "INFLUENCER",
        docId: existing.id,
        action: "DUP_MERGED",
        actorId: auth.userId,
        fromStatus: null,
        toStatus: null,
        note: `去重合并：新提交「${fresh.name}」的信息合并到「${existing.name}」`,
      });
    } else if (action === "KEEP") {
      // 保留原有，不做改动
      await tx.influencer.update({
        where: { id: fresh.id },
        data: { dupStatus: "KEPT" },
      });
      await tx.influencerSubmitLog.update({
        where: { id: logId },
        data: {
          result: "KEPT",
          handledById: auth.userId,
          handledAt: new Date(),
          reason: reason?.trim() || null,
        },
      });
      await writeLog(tx, {
        docType: "INFLUENCER",
        docId: existing.id,
        action: "DUP_KEPT",
        actorId: auth.userId,
        fromStatus: null,
        toStatus: null,
        note: `去重保留：保留原有「${existing.name}」，新提交「${fresh.name}」不合并`,
      });
    } else {
      // 拒绝新提交
      await tx.influencer.update({
        where: { id: fresh.id },
        data: { dupStatus: "REJECTED_DUP" },
      });
      await tx.influencerSubmitLog.update({
        where: { id: logId },
        data: {
          result: "REJECTED",
          handledById: auth.userId,
          handledAt: new Date(),
          reason: reason!.trim(),
        },
      });
      await writeLog(tx, {
        docType: "INFLUENCER",
        docId: fresh.id,
        action: "DUP_REJECTED",
        actorId: auth.userId,
        fromStatus: null,
        toStatus: null,
        note: `去重拒绝：${reason!.trim()}`,
      });
    }
  });

  // 通知提交人处理结果
  const actionLabel = action === "MERGE" ? "已合并到已有记录" : action === "KEEP" ? "保留原有记录" : "已被拒绝";
  await notifyUser(
    log.submittedById,
    `你提交的达人「${fresh.name}」去重处理完成：${actionLabel}。${reason?.trim() ? `理由：${reason.trim()}` : ""}`,
    { type: "INFLUENCER", id: fresh.id, title: "达人去重处理完成", kind: "SYSTEM" }
  );

  return NextResponse.json({ ok: true });
}
