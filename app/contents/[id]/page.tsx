import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Section} from "@/components/ui";
import {
  contentTypeLabels,
  contentStatusLabels,
  badgeClass,
} from "@/lib/labels";
import { getLinksWithCounterparts } from "@/lib/approval-links";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import ApprovalLinks from "@/components/ApprovalLinks";
import ContentsClient from "../ContentsClient";

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as unknown as { id: string; role: string };
  const role = sessionUser.role;
  const canWrite = role === "ADMIN" || role === "PR";

  const content = await prisma.content.findUnique({
    where: { id: params.id },
    include: {
      outlet: true,
      campaigns: { select: { id: true, name: true } },
    },
  });
  if (!content) notFound();

  const logs = await prisma.approvalLog.findMany({
    where: { docType: "CONTENT", docId: content.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });

  const links = await getLinksWithCounterparts("CONTENT", content.id);
  const isOwner = !!content.createdById && content.createdById === sessionUser.id;
  const canEditLinks = role !== "VIEWER";

  const outlets = canWrite
    ? await prisma.mediaOutlet.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const timeline: TimelineItem[] = logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor.name,
    createdAt: l.createdAt,
    note: l.note,
    fromStatusLabel: l.fromStatus ? contentStatusLabels[l.fromStatus] ?? l.fromStatus : null,
    toStatusLabel: l.toStatus ? contentStatusLabels[l.toStatus] ?? l.toStatus : null,
  }));

  return (
    <div>
      <PageHeader
        title={content.title}
        desc={`${contentTypeLabels[content.type]} · v${content.version}`}
        action={
          <Link href="/contents" className="text-sm text-[#0071e3] hover:underline">
            ← 返回列表
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-white rounded-2xl p-6 lg:col-span-2 h-fit">
          <div className="mb-3 flex items-center gap-3">
            <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(content.status)}`}>
              {contentStatusLabels[content.status]}
            </span>
            <span className="text-sm text-gray-500">关联资源：{content.outlet?.name ?? "-"}</span>
          </div>
          {content.status === "REJECTED" && content.rejectReason && (
            <div className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
              驳回理由：{content.rejectReason}
            </div>
          )}
          {content.status === "VOIDED" && content.voidReason && (
            <div className="mb-3 rounded bg-gray-100 p-3 text-sm text-gray-600">
              作废理由：{content.voidReason}
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {content.body || <span className="text-gray-400">暂无正文</span>}
          </div>
          <div className="mt-4 border-t pt-3 text-sm">
            <span className="text-gray-500">关联项目：</span>
            {content.campaigns.length > 0 ? (
              content.campaigns.map((c) => (
                <Link key={c.id} href={`/campaigns?`} className="mr-2 text-[#0071e3] hover:underline">
                  {c.name}
                </Link>
              ))
            ) : (
              <span className="text-gray-400">无</span>
            )}
          </div>
          <div className="mt-4" id="approval-section">
            <ContentsClient
              role={role}
              outlets={outlets}
              row={{
                id: content.id,
                status: content.status,
                isOwner,
                editTarget:
                  canWrite && (content.status === "DRAFT" || content.status === "REJECTED")
                    ? {
                        id: content.id,
                        title: content.title,
                        type: content.type,
                        body: content.body ?? "",
                        outletId: content.outletId ?? "",
                      }
                    : undefined,
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl h-fit [&>section:first-child]:border-t-0">
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>
          <Section>
            <ApprovalLinks
              docType="CONTENT"
              docId={content.id}
              initialLinks={links.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
              canEdit={canEditLinks}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
