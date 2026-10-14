import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, InfoRow, Section } from "@/components/ui";
import { formatDateTime, sampleStatusLabels } from "@/lib/labels";
import { logisticsStatusLabels, abnormalFlagLabels } from "@/lib/logistics";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import RecordTimestamps from "@/components/RecordTimestamps";

export default async function SampleDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) notFound();

  const sample = await prisma.sampleShipment.findUnique({
    where: { id: params.id },
    include: {
      influencer: { select: { name: true } },
      brand: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!sample) notFound();

  const logs = await prisma.approvalLog.findMany({
    where: { docType: "SAMPLE", docId: sample.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const timeline: TimelineItem[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
    createdAt: log.createdAt,
    note: log.note,
    fromStatusLabel: log.fromStatus
      ? sampleStatusLabels[log.fromStatus] ?? logisticsStatusLabels[log.fromStatus] ?? log.fromStatus
      : null,
    toStatusLabel: log.toStatus
      ? sampleStatusLabels[log.toStatus] ?? logisticsStatusLabels[log.toStatus] ?? log.toStatus
      : null,
  }));

  return (
    <div>
      <PageHeader
        title={sample.sampleNo}
        desc={`${sample.productName} · ${sampleStatusLabels[sample.status] ?? sample.status}`}
        action={<Link href="/samples" className="text-sm text-primary hover:underline">← 返回寄品管理</Link>}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg bg-card p-6 lg:col-span-2">
          <div className="mb-4 border-b pb-3">
            <RecordTimestamps createdAt={sample.createdAt} updatedAt={sample.updatedAt} />
          </div>
          <Section title="寄品信息">
            <dl>
              <InfoRow label="产品名称">{sample.productName}</InfoRow>
              <InfoRow label="数量">{sample.quantity}</InfoRow>
              <InfoRow label="关联品牌">{sample.brand?.name ?? "-"}</InfoRow>
              <InfoRow label="达人">{sample.influencer?.name ?? "-"}</InfoRow>
              <InfoRow label="记录人">{sample.createdBy.name}</InfoRow>
              <InfoRow label="收件人">{sample.receiverName ?? "-"}</InfoRow>
              <InfoRow label="联系电话">{sample.receiverPhone ?? "-"}</InfoRow>
              <InfoRow label="收件地址">{sample.receiverAddress ?? "-"}</InfoRow>
              <InfoRow label="物流状态">
                {sample.logisticsStatus ? logisticsStatusLabels[sample.logisticsStatus] ?? sample.logisticsStatus : "-"}
              </InfoRow>
              <InfoRow label="异常标记">
                {sample.abnormalFlag ? abnormalFlagLabels[sample.abnormalFlag] ?? sample.abnormalFlag : "-"}
              </InfoRow>
              <InfoRow label="快递公司">{sample.courier ?? "-"}</InfoRow>
              <InfoRow label="快递单号">{sample.trackingNo ?? "-"}</InfoRow>
              <InfoRow label="发货时间">{sample.shippedAt ? formatDateTime(sample.shippedAt) : "-"}</InfoRow>
              <InfoRow label="签收时间">{sample.signedAt ? formatDateTime(sample.signedAt) : "-"}</InfoRow>
            </dl>
          </Section>
        </div>
        <div className="rounded-lg bg-card [&>section:first-child]:border-t-0">
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>
        </div>
      </div>
    </div>
  );
}
