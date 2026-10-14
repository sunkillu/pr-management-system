"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import { styleLabels, procurementItemStatusLabels } from "@/lib/labels";

type Item = {
  id: string;
  style: string;
  quantity: number;
  link: string | null;
  status: string;
  approvedQty: number | null;
  rejectReason: string | null;
  allocatedTicketId: string | null;
};

type RecommendItem = {
  itemId: string;
  style: string;
  status: string;
  recommended: { prId: string; prName: string; lastCoopAt: string }[];
  uncooperated: { prId: string; prName: string }[];
};

// 采买工单逐条审批 + 分配（仅当工单有 ProcurementItem 时渲染，无 items 的老单返回 null 走旧接单流程）
export default function ProcurementItems({
  ticketId,
  ticketTitle,
  ticketStatus,
  role,
}: {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  role: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [recommend, setRecommend] = useState<RecommendItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [qtyEdits, setQtyEdits] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAllocateConfirm, setShowAllocateConfirm] = useState(false);

  const isAdmin = role === "ADMIN";
  const canItemApprove = isAdmin && ["PENDING_PROCUREMENT", "APPROVED"].includes(ticketStatus);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/procurement-items`);
      const data = await res.json().catch(() => []);
      if (res.ok && Array.isArray(data)) {
        setItems(data);
        setQtyEdits((prev) => {
          const next = { ...prev };
          for (const it of data as Item[]) {
            if (next[it.id] == null) next[it.id] = String(it.quantity);
          }
          return next;
        });
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    if (isAdmin) {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/procurement-recommend`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.items)) setRecommend(data.items);
      } catch {
        setRecommend([]);
      }
    }
  }, [ticketId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  // 推荐加载后，默认选中每条 item 的第一个推荐 PR（无推荐则选第一个未合作 PR）
  useEffect(() => {
    if (recommend.length === 0) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const r of recommend) {
        if (!next[r.itemId]) {
          next[r.itemId] = r.recommended[0]?.prId ?? r.uncooperated[0]?.prId ?? "";
        }
      }
      return next;
    });
  }, [recommend]);

  async function patchItem(itemId: string, action: "approve" | "reject") {
    setError("");
    setBusy(true);
    try {
      const body: Record<string, unknown> = { itemId, action };
      if (action === "approve") body.approvedQty = Number(qtyEdits[itemId] ?? "");
      else body.rejectReason = rejectReasons[itemId] ?? "";
      const res = await fetch(`/api/tickets/${ticketId}/procurement-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "操作失败");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // 随机分配未合作：把未分配的已通过 item 按顺序轮流分给各条 item 自己的未合作 PR（数量均分）
  function randomAssignUncooperated() {
    const unallocated = (items ?? []).filter((it) => it.status === "APPROVED" && !it.allocatedTicketId);
    if (unallocated.length === 0) return;
    setSelections((prev) => {
      const next = { ...prev };
      let pointer = 0;
      for (const it of unallocated) {
        const rec = recommend.find((r) => r.itemId === it.id);
        const pool = rec?.uncooperated ?? [];
        if (pool.length === 0) continue;
        next[it.id] = pool[pointer % pool.length].prId;
        pointer++;
      }
      return next;
    });
  }

  async function doAllocate() {
    setError("");
    setBusy(true);
    try {
      const allocations = (items ?? [])
        .filter((it) => it.status === "APPROVED" && !it.allocatedTicketId && selections[it.id])
        .map((it) => ({ itemId: it.id, prId: selections[it.id] }));
      if (allocations.length === 0) {
        setError("没有可分配的已通过请求");
        return;
      }
      const res = await fetch(`/api/tickets/${ticketId}/procurement-allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "分配失败");
        return;
      }
      setShowAllocateConfirm(false);
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (items === null) return null;
  if (items.length === 0) return null; // 老单：走旧接单流程

  const pendingCount = items.filter((it) => it.status === "PENDING").length;
  const allocatable = items.filter((it) => it.status === "APPROVED" && !it.allocatedTicketId);
  const showAllocate = isAdmin && pendingCount === 0 && allocatable.length > 0;

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-medium">采买请求（逐条审批）</h4>
      <div className="space-y-2">
        {items.map((it, i) => {
          const rec = recommend.find((r) => r.itemId === it.id);
          return (
            <div key={it.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{i + 1}. {styleLabels[it.style] ?? it.style}</span>
                <span className="text-muted-foreground">申请数量：{it.quantity}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                  {procurementItemStatusLabels[it.status] ?? it.status}
                </span>
                {it.status === "APPROVED" && it.approvedQty != null && (
                  <span className="text-muted-foreground">通过数量：{it.approvedQty}</span>
                )}
                {it.status === "REJECTED" && it.rejectReason && (
                  <span className="text-xs text-red-600">驳回理由：{it.rejectReason}</span>
                )}
                {it.allocatedTicketId && (
                  <a href={`/tickets/${it.allocatedTicketId}`} className="text-xs text-primary hover:underline">
                    已分配 → 查看合作工单
                  </a>
                )}
              </div>
              {it.link && (
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  参考链接：<a href={it.link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{it.link}</a>
                </p>
              )}
              {canItemApprove && it.status === "PENDING" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-muted-foreground">通过数量</label>
                  <input
                    inputMode="numeric"
                    className={`${inputCls} w-20`}
                    value={qtyEdits[it.id] ?? String(it.quantity)}
                    onChange={(e) => setQtyEdits({ ...qtyEdits, [it.id]: e.target.value.replace(/[^\d]/g, "") })}
                  />
                  <button className={btnPrimary} disabled={busy} onClick={() => patchItem(it.id, "approve")}>
                    通过
                  </button>
                  <input
                    className={`${inputCls} w-48`}
                    value={rejectReasons[it.id] ?? ""}
                    onChange={(e) => setRejectReasons({ ...rejectReasons, [it.id]: e.target.value })}
                    placeholder="驳回理由（驳回时必填）"
                  />
                  <button className={btnSecondary} disabled={busy} onClick={() => patchItem(it.id, "reject")}>
                    驳回
                  </button>
                </div>
              )}
              {showAllocate && it.status === "APPROVED" && !it.allocatedTicketId && (
                <div className="mt-2">
                  <Field label="分配 PR">
                    <select
                      className={inputCls}
                      value={selections[it.id] ?? ""}
                      onChange={(e) => setSelections({ ...selections, [it.id]: e.target.value })}
                    >
                      <option value="">请选择 PR</option>
                      {rec && rec.recommended.length > 0 && (
                        <optgroup label="推荐（有该款式合作历史）">
                          {rec.recommended.map((r) => (
                            <option key={r.prId} value={r.prId}>
                              {r.prName}（最近合作：{new Date(r.lastCoopAt).toLocaleDateString("zh-CN")}）
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {rec && rec.uncooperated.length > 0 && (
                        <optgroup label="未合作">
                          {rec.uncooperated.map((r) => (
                            <option key={r.prId} value={r.prId}>{r.prName}（未合作）</option>
                          ))}
                        </optgroup>
                      )}
                      {(!rec || (rec.recommended.length === 0 && rec.uncooperated.length === 0)) && (
                        <option value="" disabled>暂无可选 PR</option>
                      )}
                    </select>
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showAllocate && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={btnSecondary} disabled={busy} onClick={randomAssignUncooperated}>
            随机分配未合作
          </button>
          <button className={btnPrimary} disabled={busy} onClick={() => setShowAllocateConfirm(true)}>
            确认分配（生成 {allocatable.length} 张合作工单）
          </button>
        </div>
      )}
      {pendingCount > 0 && isAdmin && (
        <p className="mt-2 text-xs text-muted-foreground">全部条目审批完成（无待审批）后可分配。</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {showAllocateConfirm && (
        <ConfirmDialog
          title="确认分配"
          message={`将为采买工单「${ticketTitle}」的 ${allocatable.length} 条已通过请求生成合作工单并分配给所选 PR，采买工单将进入已通过状态，确认吗？`}
          confirmText="确认分配"
          busy={busy}
          onClose={() => setShowAllocateConfirm(false)}
          onConfirm={doAllocate}
        />
      )}
    </div>
  );
}
