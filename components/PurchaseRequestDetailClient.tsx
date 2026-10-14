"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import SearchableSelect from "@/components/SearchableSelect";
import PurchaseRequestStatusBadge from "@/components/PurchaseRequestStatusBadge";
import RecordTimestamps from "@/components/RecordTimestamps";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  btnPrimary,
  btnPrimarySm,
  btnSecondary,
  btnSecondarySm,
  linkCls,
} from "@/components/ui";
import {
  PURCHASE_LINE_STATUS_LABELS,
  PURCHASE_PLATFORM_LABELS,
  PURCHASE_REQUEST_STATUS_LABELS,
} from "@/lib/purchase-shared";
import { formatDateTime } from "@/lib/labels";

type LineItem = {
  id: string;
  sort: number;
  platform: string;
  link: string;
  style: string;
  quantity: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  assigneeId: string | null;
  assignedAt: string | null;
  ticketId: string | null;
  ticketNo: string | null;
  reviewedByName: string | null;
  assigneeName: string | null;
};

type PrOption = { id: string; name: string };

type RecommendationItem = {
  lineId: string;
  prId: string;
  prName: string;
  reason: "HISTORY" | "BALANCED_RANDOM";
  reasonText: string;
  influencerId: string | null;
  influencerName: string | null;
};

export default function PurchaseRequestDetailClient({
  requestId,
  requestNo,
  requestStatus,
  role,
  lines,
  prs,
}: {
  requestId: string;
  requestNo: string;
  requestStatus: string;
  role: string;
  lines: LineItem[];
  prs: PrOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejectingLine, setRejectingLine] = useState<LineItem | null>(null);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.id, line.assigneeId ?? ""])),
  );
  const [reasonTexts, setReasonTexts] = useState<Record<string, string>>({});
  const [loadingRecommend, setLoadingRecommend] = useState(false);

  const pendingLines = lines.filter((line) => line.status === "PENDING");
  const assignableLines = lines.filter((line) => line.status === "APPROVED" && !line.ticketId);
  const canReview = ["ADMIN", "PR_MANAGER"].includes(role) && requestStatus === "PENDING_REVIEW";
  const canAssign = ["ADMIN", "PR_MANAGER"].includes(role) && assignableLines.length > 0;
  const prOptions = prs.map((pr) => ({ value: pr.id, label: pr.name }));

  async function postJson(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "操作失败");
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function review(decisions: Array<{ lineId: string; action: "APPROVE" | "REJECT"; note?: string }>) {
    const data = await postJson(`/api/purchase-requests/${requestId}/review`, { decisions });
    if (!data) return;
    router.refresh();
  }

  async function fetchRecommendations() {
    setLoadingRecommend(true);
    setError("");
    try {
      const res = await fetch(`/api/purchase-requests/${requestId}/recommend`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "推荐失败");
        return;
      }
      const nextAssignments: Record<string, string> = {};
      const nextReasons: Record<string, string> = {};
      for (const item of (data.recommendations as RecommendationItem[] | undefined) ?? []) {
        nextAssignments[item.lineId] = item.prId;
        nextReasons[item.lineId] = item.reasonText;
      }
      setAssignments((current) => ({ ...current, ...nextAssignments }));
      setReasonTexts(nextReasons);
    } finally {
      setLoadingRecommend(false);
    }
  }

  const assignSummary = useMemo(() => {
    const selected = assignableLines.map((line) => ({ line, assigneeId: assignments[line.id] || "" }));
    if (selected.some((item) => !item.assigneeId)) return null;
    const counter = new Map<string, number>();
    for (const item of selected) {
      counter.set(item.assigneeId, (counter.get(item.assigneeId) ?? 0) + 1);
    }
    return Array.from(counter.entries()).map(([assigneeId, count]) => ({
      assigneeId,
      name: prs.find((pr) => pr.id === assigneeId)?.name ?? assigneeId,
      count,
    }));
  }, [assignableLines, assignments, prs]);

  return (
    <div className="space-y-4">
      {canReview && pendingLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <PurchaseRequestStatusBadge status={requestStatus} label={PURCHASE_REQUEST_STATUS_LABELS[requestStatus] ?? requestStatus} />
          <span className="text-sm text-muted-foreground">当前还有 {pendingLines.length} 条待审批</span>
          <button
            className={btnPrimarySm}
            disabled={busy}
            onClick={() => review(pendingLines.map((line) => ({ lineId: line.id, action: "APPROVE" as const })))}
          >
            本页全部待审批行 → 全部通过
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>序号</TableHead>
              <TableHead>平台</TableHead>
              <TableHead>链接</TableHead>
              <TableHead>款式</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>行状态</TableHead>
              <TableHead>审批信息</TableHead>
              <TableHead>分配 PR</TableHead>
              <TableHead>生成工单</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.sort + 1}</TableCell>
                <TableCell>{PURCHASE_PLATFORM_LABELS[line.platform] ?? line.platform}</TableCell>
                <TableCell className="max-w-[220px]">
                  <a href={line.link} target="_blank" rel="noreferrer" className={`${linkCls} break-all`}>
                    {line.link}
                  </a>
                </TableCell>
                <TableCell>{line.style}</TableCell>
                <TableCell>{line.quantity}</TableCell>
                <TableCell>
                  <PurchaseRequestStatusBadge status={line.status} label={PURCHASE_LINE_STATUS_LABELS[line.status] ?? line.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {line.reviewedByName ? (
                    <div>
                      <div>{line.reviewedByName}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.reviewedAt ? formatDateTime(line.reviewedAt) : "-"}
                      </div>
                      {line.reviewNote && <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{line.reviewNote}</div>}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {line.assigneeName ? (
                    <div>
                      <div>{line.assigneeName}</div>
                      <div className="text-xs text-muted-foreground">{line.assignedAt ? formatDateTime(line.assignedAt) : "-"}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {line.ticketId && line.ticketNo ? (
                    <Link href={`/tickets/${line.ticketId}`} className={linkCls}>
                      {line.ticketNo}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <RecordTimestamps createdAt={line.createdAt} updatedAt={line.updatedAt} compact />
                </TableCell>
                <TableCell>
                  {canReview && line.status === "PENDING" ? (
                    <div className="flex flex-wrap gap-2">
                      <button className={btnPrimarySm} disabled={busy} onClick={() => review([{ lineId: line.id, action: "APPROVE" }])}>通过</button>
                      <button className={btnSecondarySm} disabled={busy} onClick={() => setRejectingLine(line)}>驳回</button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canAssign && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold">分配并创建工单</div>
              <p className="text-sm text-muted-foreground">为所有已通过未分配的采买行选择 PR，并一次性生成合作工单草稿。</p>
            </div>
            <div className="flex gap-2">
              <button className={btnSecondary} disabled={loadingRecommend} onClick={fetchRecommendations}>
                {loadingRecommend ? "推荐中…" : "推荐分配"}
              </button>
              <button className={btnSecondary} disabled={loadingRecommend} onClick={fetchRecommendations}>
                重新随机
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {assignableLines.map((line) => (
              <div key={line.id} className="rounded border border-border p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-start">
                  <div>
                    <div className="text-sm font-medium">
                      第 {line.sort + 1} 行 · {PURCHASE_PLATFORM_LABELS[line.platform] ?? line.platform} · {line.style} × {line.quantity}
                    </div>
                    <a href={line.link} target="_blank" rel="noreferrer" className={`${linkCls} mt-1 block break-all text-sm`}>
                      {line.link}
                    </a>
                    {reasonTexts[line.id] && <div className="mt-2 text-xs text-muted-foreground">{reasonTexts[line.id]}</div>}
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">分配给 PR</div>
                    <SearchableSelect
                      options={prOptions}
                      value={assignments[line.id] || ""}
                      onChange={(value) => setAssignments((current) => ({ ...current, [line.id]: value }))}
                      placeholder="请选择 PR"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button
              className={btnPrimary}
              disabled={busy || !assignSummary}
              onClick={() => {
                if (!assignSummary) {
                  setError("请为所有待分配行选择 PR");
                  return;
                }
                setShowAssignConfirm(true);
              }}
            >
              确认分配并批量创建工单
            </button>
          </div>
        </div>
      )}

      {rejectingLine && (
        <ConfirmDialog
          title={`驳回第 ${rejectingLine.sort + 1} 行`}
          message={`请填写驳回理由：${rejectingLine.style} × ${rejectingLine.quantity}`}
          needReason
          reasonLabel="驳回理由"
          confirmText="确认驳回"
          busy={busy}
          onClose={() => setRejectingLine(null)}
          onConfirm={async (reason) => {
            await review([{ lineId: rejectingLine.id, action: "REJECT", note: reason }]);
            setRejectingLine(null);
          }}
        />
      )}

      {showAssignConfirm && assignSummary && (
        <ConfirmDialog
          title="确认批量创建工单"
          message={`将基于 ${requestNo} 创建 ${assignableLines.length} 张合作工单。\n${assignSummary.map((item) => `${item.name}：${item.count} 张`).join("\n")}`}
          confirmText="确认创建"
          busy={busy}
          onClose={() => setShowAssignConfirm(false)}
          onConfirm={async () => {
            const result = await postJson(`/api/purchase-requests/${requestId}/assign`, {
              assignments: assignableLines.map((line) => ({ lineId: line.id, assigneeId: assignments[line.id] })),
            });
            if (!result) return;
            setShowAssignConfirm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
