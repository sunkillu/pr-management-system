import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import {
  contentTypeLabels,
  contentStatusLabels,
  badgeClass,
  approvalStageLabels,
  approvalActionLabels,
  formatDateTime,
} from "@/lib/labels";
import ContentsClient from "../ContentsClient";

export default async function ContentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = role === "ADMIN" || role === "OPERATOR";

  const content = await prisma.content.findUnique({
    where: { id: params.id },
    include: {
      outlet: true,
      approvalRecords: { include: { approver: true }, orderBy: { createdAt: "desc" } },
      campaigns: { select: { id: true, name: true } },
    },
  });
  if (!content) notFound();

  const outlets = canWrite
    ? await prisma.mediaOutlet.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <PageHeader
        title={content.title}
        desc={`${contentTypeLabels[content.type]} · v${content.version}`}
        action={
          <Link href="/contents" className="text-sm text-blue-600 hover:underline">
            ← 返回列表
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 lg:col-span-2">
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
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {content.body || <span className="text-gray-400">暂无正文</span>}
          </div>
          <div className="mt-4 border-t pt-3 text-sm">
            <span className="text-gray-500">关联项目：</span>
            {content.campaigns.length > 0 ? (
              content.campaigns.map((c) => (
                <Link key={c.id} href={`/campaigns?`} className="mr-2 text-blue-600 hover:underline">
                  {c.name}
                </Link>
              ))
            ) : (
              <span className="text-gray-400">无</span>
            )}
          </div>
          <div className="mt-4">
            <ContentsClient
              role={role}
              outlets={outlets}
              row={{
                id: content.id,
                status: content.status,
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

        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h3 className="mb-3 font-semibold">审批记录</h3>
          {content.approvalRecords.length === 0 && (
            <p className="text-sm text-gray-400">暂无审批记录</p>
          )}
          <ol className="space-y-3">
            {content.approvalRecords.map((r) => (
              <li key={r.id} className="border-l-2 border-gray-200 pl-3 text-sm">
                <div>
                  <span className="font-medium">{approvalStageLabels[r.stage]}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                      r.action === "APPROVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {approvalActionLabels[r.action]}
                  </span>
                </div>
                <div className="text-gray-500">
                  {r.approver.name} · {formatDateTime(r.createdAt)}
                </div>
                {r.comment && <div className="mt-1 text-gray-700">意见：{r.comment}</div>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
