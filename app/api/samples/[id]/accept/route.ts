import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers, notifyUser} from "@/lib/feishu-notify";

// 兼容旧入口：仓库接单只留痕，不新增“备货中”状态
// 信息不全时仓库可在 note 留痕说明缺什么（退回 PR 补充）
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "WAREHOUSE"]);
if (!auth.ok) return auth.res;
const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id}});
if (!sample) return NextResponse.json({ error: "寄件请求不存在"}, { status: 404});
if (sample.status!== "PENDING") {
return NextResponse.json({ error: "仅待处理的请求可接单"}, { status: 400});
}
if (!sample.infoConfirmed) {
return NextResponse.json({ error: "寄件信息尚未确认，请先让提交人确认信息"}, { status: 400});
}
const body = await req.json().catch(() => ({}));
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.sampleShipment.findUnique({ where: { id: params.id } });
await writeLog(tx, {
docType: "SAMPLE",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "PENDING",
  toStatus: "PENDING",
note: body.note?.trim()? `仓库接单：${body.note.trim()}`: "仓库接单，开始备货",
});
return u;
});
// 通知创建人
await notifyUser(
sample.createdById,
`${sample.productName} 仓库已接单，正在备货。`,
{ type: "SAMPLE", id: sample.id, title: "寄件备货中", kind: "APPROVED"}
);
return NextResponse.json(updated);
}
