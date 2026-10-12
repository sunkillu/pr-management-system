import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, tdCls, btnSecondary } from "@/components/ui";
import {
  procurementTypeLabels,
  procurementStatusLabels,
  badgeClass,
} from "@/lib/labels";
import Link from "next/link";
import ProcurementDistribute from "@/components/ProcurementDistribute";
import ProcurementTaskActions from "@/components/ProcurementTaskActions";
import ProcurementCancel from "@/components/ProcurementCancel";

export default async function ProcurementDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string; name: string };
  const role = me.role;

  const item = await prisma.procurementRequest.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!item) return <div className="rounded-2xl bg-white p-8 text-center text-gray-500">采买需求不存在</div>;

  const canDistribute = role === "ADMIN" && item.status === "PENDING";
  const canCancel = (role === "ADMIN" || item.createdById === me.id) && ["PENDING", "DISTRIBUTED"].includes(item.status);

  return (
    <div>
      <PageHeader
        title={item.title}
        desc={`${procurementTypeLabels[item.type]} · ${procurementStatusLabels[item.status]}`}
        action={
          <div className="flex gap-2">
            <Link href="/procurement" className={btnSecondary}>返回列表</Link>
            {canDistribute && (
              <ProcurementDistribute requestId={item.id} requestType={item.type} totalQuantity={item.quantity} />
            )}
            {canCancel && <ProcurementCancel requestId={item.id} />}
          </div>
        }
      />

      <div className="mb-4 rounded-2xl bg-white p-5">
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><span className="text-gray-400">类型：</span>{procurementTypeLabels[item.type]}</div>
          <div><span className="text-gray-400">状态：</span><span className={badgeClass(item.status)}>{procurementStatusLabels[item.status]}</span></div>
          <div><span className="text-gray-400">提交人：</span>{item.createdBy.name}</div>
          <div><span className="text-gray-400">提交时间：</span>{new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</div>
          {item.type === "WEEKLY_STYLE" ? (
            <>
              <div className="col-span-2"><span className="text-gray-400">款式：</span>{item.styles.join("、")}</div>
              <div><span className="text-gray-400">数量：</span>{item.quantity}</div>
            </>
          ) : (
            <>
              <div><span className="text-gray-400">素材类型：</span>{item.materialType}</div>
              <div className="col-span-2"><span className="text-gray-400">需求理由：</span>{item.reason || "—"}</div>
              <div className="col-span-4">
                <span className="text-gray-400">发布链接：</span>
                {item.publishLinks.length === 0 ? "—" : (
                  <ul className="mt-1 list-disc pl-5">
                    {item.publishLinks.map((l, i) => (
                      <li key={i}><a href={l} target="_blank" rel="noreferrer" className="break-all text-[#0071e3] hover:underline">{l}</a></li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          {item.status === "CANCELLED" && item.cancelReason && (
            <div className="col-span-4 text-red-600">取消原因：{item.cancelReason}</div>
          )}
        </div>
      </div>

      <h3 className="mb-2 text-base font-semibold">任务列表（{item.tasks.length}）</h3>
      {item.tasks.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-400">
          {item.status === "PENDING" ? "待管理员分发" : "暂无任务"}
        </div>
      ) : (
        <div className="space-y-3">
          {item.tasks.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{t.assignee.name}</span>
                {t.quantity != null && <span className="text-gray-500">负责数量：{t.quantity}</span>}
                {t.acceptedAt && (
                  <span className="text-xs text-gray-400">接单于 {new Date(t.acceptedAt).toLocaleString("zh-CN", { hour12: false })}</span>
                )}
                {t.influencerName && <span className="text-gray-600">达人：{t.influencerName}</span>}
                {t.note && <span className="w-full text-xs text-gray-500">备注：{t.note}</span>}
              </div>
              <ProcurementTaskActions task={t as never} meId={me.id} role={role} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
