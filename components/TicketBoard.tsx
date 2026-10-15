"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { ticketStatusLabels, coopTypeLabels, formatMoney } from "@/lib/labels";
import { cn } from "@/lib/utils";
import RecordTimestamps from "@/components/RecordTimestamps";

export type BoardTicket = {
  id: string;
  ticketNo: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  budgetFee: unknown;
  influencer: { name: string } | null;
  makeupArtist: { name: string } | null;
  creator: { name: string } | null;
  overdue: boolean;
  subtasks: { status: string }[];
  nodes: { completedAt: string | null }[];
  paymentRequests: { id: string }[];
};

const MAIN_COLUMNS = [
  "PENDING_APPROVAL",
  "PENDING_PROCUREMENT",
  "IN_PROGRESS",
  "MATERIAL_REVIEW",
  "SETTLING",
  "FOLLOW_UP",
  "SETTLED",
] as const;
const EXTRA_COLUMNS = ["DRAFT", "REJECTED", "VOIDED"] as const;

// 进度条：子任务 DONE 数 / 子任务总数；无子任务时按节点完成比例
function SubtaskBar({
  subtasks,
  nodes,
}: {
  subtasks: { status: string }[];
  nodes: { completedAt: string | null }[];
}) {
  let done = 0;
  let total = 0;
  let label = "";
  if (subtasks.length > 0) {
    done = subtasks.filter((s) => s.status === "DONE").length;
    total = subtasks.length;
    label = `${done}/${total}`;
  } else if (nodes.length > 0) {
    done = nodes.filter((n) => n.completedAt).length;
    total = nodes.length;
    label = `${done}/${total} 节点`;
  } else {
    return null;
  }
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export default function TicketBoard({
  tickets,
  role,
}: {
  tickets: BoardTicket[];
  role: string;
}) {
  const router = useRouter();
  const [showExtra, setShowExtra] = useState(false);
  const [busyId, setBusyId] = useState("");

  const columns = showExtra
    ? [...MAIN_COLUMNS, ...EXTRA_COLUMNS]
    : [...MAIN_COLUMNS];

  const canApprove = ["ADMIN", "PR_MANAGER"].includes(role);

  async function postAction(ticketId: string, url: string, body?: Record<string, unknown>) {
    setBusyId(ticketId);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "操作失败");
        return;
      }
      router.refresh();
    } finally {
      setBusyId("");
    }
  }

  function approve(ticketId: string) {
    if (!confirm(`确定通过工单吗？`)) return;
    postAction(ticketId, `/api/tickets/${ticketId}/approve`, { action: "APPROVE" });
  }

  function reject(ticketId: string) {
    const reason = prompt("请输入驳回理由（必填）：");
    if (!reason || !reason.trim()) return;
    postAction(ticketId, `/api/tickets/${ticketId}/approve`, { action: "REJECT", comment: reason.trim() });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showExtra}
            onChange={(e) => setShowExtra(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          显示草稿 / 驳回 / 作废
        </label>
        <span className="text-xs text-muted-foreground">点击卡片标题进入详情页</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((status) => {
          const list = tickets.filter((t) => t.status === status);
          return (
            <Card key={status} className="w-72 shrink-0 bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
                <StatusBadge status={status} label={ticketStatusLabels[status]} />
                <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-1">
                {list.map((t) => {
                  const partner = t.influencer?.name ?? t.makeupArtist?.name ?? "-";
                  return (
                    <Card
                      key={t.id}
                      className={cn(
                        "min-w-0 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      )}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium" title={t.title}>
                          {t.title}
                        </div>
                        {t.overdue && (
                          <StatusBadge status="REJECTED" label="超时" className="shrink-0" />
                        )}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {t.ticketNo}
                        </Link>
                        <div className="truncate whitespace-nowrap" title={`${partner} · ${coopTypeLabels[t.type] ?? t.type}`}>{partner} · {coopTypeLabels[t.type] ?? t.type}</div>
                        <div className="truncate whitespace-nowrap tabular-nums" title={`¥${formatMoney(t.budgetFee)} · ${t.creator?.name ?? "-"}`}>¥{formatMoney(t.budgetFee)} · {t.creator?.name ?? "-"}</div>
                      </div>
                      <div className="mt-2">
                        <RecordTimestamps createdAt={t.createdAt} updatedAt={t.updatedAt} compact />
                      </div>
                      <SubtaskBar subtasks={t.subtasks} nodes={t.nodes} />
                      {/* 快捷操作 */}
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                        {(t.status === "PENDING_APPROVAL" || t.status === "PENDING_PROCUREMENT") && canApprove && (
                          <>
                            <Button
                              size="sm"
                              disabled={busyId === t.id}
                              onClick={() => approve(t.id)}
                            >
                              通过
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyId === t.id}
                              onClick={() => reject(t.id)}
                            >
                              驳回
                            </Button>
                          </>
                        )}
                        {t.status === "IN_PROGRESS" && (
                          <Button size="sm" asChild>
                            <Link href={`/tickets/${t.id}#approval-section`}>
                              标记完成
                            </Link>
                          </Button>
                        )}
                        {t.status === "MATERIAL_REVIEW" && (
                          <Button size="sm" asChild>
                            <Link href={`/tickets/${t.id}#approval-section`}>
                              去审批素材
                            </Link>
                          </Button>
                        )}
                        {t.status === "SETTLING" && (
                          <Button size="sm" variant="secondary" asChild>
                            <Link href={t.paymentRequests[0] ? `/payments/${t.paymentRequests[0].id}` : "/payments"}>
                              去打款单
                            </Link>
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
                {list.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">暂无</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
