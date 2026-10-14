import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";
import { metricFieldsFor } from "@/lib/data-collection";
import { writeLog } from "@/lib/approval-log";

const READ_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"] as const;
const WRITE_ROLES = ["ADMIN", "PR", "PR_MANAGER"] as const;

// 列表：所有登录用户可查；status / platform / ticketId / overdue 筛选
export async function GET(req: NextRequest) {
  const auth = await requireRoles([...READ_ROLES]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING / COLLECTED / MISSING
  const platform = searchParams.get("platform"); // XIAOHONGSHU / DOUYIN
  const ticketId = searchParams.get("ticketId");
  const overdue = searchParams.get("overdue") === "1";

  const list = await prisma.dataCollectionTask.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(platform ? { platform } : {}),
      ...(ticketId ? { ticketId } : {}),
      ...(overdue ? { status: "PENDING", dueAt: { lt: new Date() } } : {}),
    },
    include: {
      ticket: { select: { id: true, ticketNo: true, title: true, platform: true, publishDate: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  return NextResponse.json({ list });
}

function sanitizeMetrics(platform: string, raw: unknown): Record<string, number> {
  const fields = metricFieldsFor(platform);
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`指标「${f}」必须为非负整数`);
    }
    out[f] = n;
  }
  return out;
}

// 更新：填写各平台指标
// 小红书：publishLink / views / likes / comments / favorites
// 抖音：publishLink / exposures / views / likes / comments / favorites
export async function PATCH(req: NextRequest) {
  const auth = await requireRoles([...WRITE_ROLES]);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });

  const task = await prisma.dataCollectionTask.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  const publishLink =
    body.publishLink === undefined ? undefined : String(body.publishLink ?? "").trim() || null;

  let metrics: Record<string, number> | undefined;
  if (body.metrics !== undefined) {
    try {
      const patch = sanitizeMetrics(task.platform, body.metrics);
      const prev = (task.metrics ?? {}) as Record<string, number>;
      metrics = { ...prev, ...patch };
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "指标格式错误" }, { status: 400 });
    }
  }

  // 状态：显式传入则校验；未传入但本次指标已填齐则自动置为 COLLECTED
  let status = task.status;
  if (body.status !== undefined && body.status !== null && body.status !== "") {
    const s = String(body.status);
    if (!["PENDING", "COLLECTED", "MISSING"].includes(s)) {
      return NextResponse.json({ error: "状态值非法" }, { status: 400 });
    }
    status = s as typeof status;
  } else if (metrics) {
    const fields = metricFieldsFor(task.platform);
    const allFilled = fields.every((f) => typeof metrics![f] === "number");
    const hasLink = (publishLink ?? task.publishLink) != null;
    if (allFilled && hasLink && task.status === "PENDING") status = "COLLECTED";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.dataCollectionTask.findUniqueOrThrow({ where: { id } });
    const result = await tx.dataCollectionTask.update({
      where: { id },
      data: {
        ...(publishLink !== undefined ? { publishLink } : {}),
        ...(metrics ? { metrics } : {}),
        status,
      },
    });
    if (current.status !== result.status) {
      await writeLog(tx, {
        docType: "DATA_TASK",
        docId: result.id,
        action: "EDIT",
        actorId: auth.userId,
        fromStatus: current.status,
        toStatus: result.status,
      });
    }
    return result;
  });

  return NextResponse.json({ task: updated });
}
