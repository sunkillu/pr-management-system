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
  allocations?: { id: string; prId: string; quantity: number; ticket?: { id: string; ticketNo: string; status: string }; pr?: { id: string; name: string } }[];
};

type AllocationDraft = { prId: string; quantity: string };

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
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, AllocationDraft[]>>({});
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

  // 推荐加载后，为每条请求准备一行分配草稿。
  useEffect(() => {
    if (recommend.length === 0) return;
    setAllocationDrafts((prev) => {
      const next = { ...prev };
      for (const r of recommend) {
        if (!next[r.itemId]) {
          const prId = r.recommended[0]?.prId ?? r.uncooperated[0]?.prId ?? "";
          next[r.itemId] = [{ prId, quantity: "" }];
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

  function addAllocation(itemId: string) {
    setAllocationDrafts((prev) => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), { prId: "", quantity: "" }] }));
  }
  function updateAllocation(itemId: string, index: number, patch: Partial<AllocationDraft>) {
    setAllocationDrafts((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? []).map((row, i) => i === index ? { ...row, ...patch } : row) }));
  }
  function removeAllocation(itemId: string, index: number) {
    setAllocationDrafts((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? []).filter((_, i) => i !== index) }));
  }

  // 随机分配未合作：把通过数量均分给未合作 PR，数量可再手工调整。
  function randomAssignUncooperated() {
    const unallocated = (items ?? []).filter((it) => it.status === "APPROVED" && !it.allocatedTicketId);
    if (unallocated.length === 0) return;
    setAllocationDrafts((prev) => {
      const next = { ...prev };
      let pointer = 0;
      for (const it of unallocated) {
        const rec = recommend.find((r) => r.itemId === it.id);
        const pool = rec?.uncooperated ?? [];
        if (pool.length === 0) continue;
        const prId = pool[pointer % pool.length].prId;
        const remaining = Math.max(0, (it.approvedQty ?? it.quantity) - (it.allocations ?? []).reduce((sum, a) => sum + a.quantity, 0));
        next[it.id] = [{ prId, quantity: String(remaining) }];
        pointer++;
      }
      return next;
    });
  }

  async function doAllocate() {
    setError("");
    setBusy(true);
    try {
      const payloadAllocations = (items ?? []).flatMap((it) => (allocationDrafts[it.id] ?? [])
        .filter((row) => row.prId && Number(row.quantity) > 0)
        .map((row) => ({ itemId: it.id, prId: row.prId, quantity: Number(row.quantity) })));
      if (payloadAllocations.length === 0) {
        setError("没有可分配的已通过请求");
        return;
      }
      const res = await fetch(`/api/tickets/${ticketId}/procurement-allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations: payloadAllocations }),
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
  // 分配：管理员 / PR负责人均可（逐条审批仍仅管理员）
  const showAllocate = (role === "ADMIN" || role === "PR_MANAGER") && pendingCount === 0 && allocatable.length > 0;

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
              {showAllocate && it.status === "APPROVED" && (
                <div className="mt-3 rounded-lg bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">拆分分配（可分给多人）</span>
                    <span className="text-muted-foreground">已通过 {it.approvedQty ?? it.quantity}，已分配 {(it.allocations ?? []).reduce((sum, a) => sum + a.quantity, 0)}</span>
                  </div>
                  {(allocationDrafts[it.id] ?? []).map((row, rowIndex) => (
                    <div key={`${it.id}-${rowIndex}`} className="mb-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                      <select className={inputCls} value={row.prId} onChange={(e) => updateAllocation(it.id, rowIndex, { prId: e.target.value })}>
                        <option value="">请选择 PR</option>
                        {rec?.recommended.map((r) => <option key={`r-${r.prId}`} value={r.prId}>{r.prName}（推荐）</option>)}
                        {rec?.uncooperated.map((r) => <option key={`u-${r.prId}`} value={r.prId}>{r.prName}（未合作）</option>)}
                      </select>
                      <input inputMode="numeric" className={inputCls} placeholder="分配数量" value={row.quantity} onChange={(e) => updateAllocation(it.id, rowIndex, { quantity: e.target.value.replace(/[^\d]/g, "") })} />
                      <button className={btnSecondary} type="button" onClick={() => removeAllocation(it.id, rowIndex)}>移除</button>
                    </div>
                  ))}
                  <button className={btnSecondary} type="button" onClick={() => addAllocation(it.id)}>＋增加分配人</button>
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
      {pendingCount > 0 && (role === "ADMIN" || role === "PR_MANAGER") && (
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
