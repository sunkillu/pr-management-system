"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import Modal from "./Modal";

type PRUser = { id: string; name: string };

export default function ProcurementDistribute({
  requestId,
  requestType,
  totalQuantity,
}: {
  requestId: string;
  requestType: string;
  totalQuantity: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prs, setPrs] = useState<PRUser[]>([]);
  const [rows, setRows] = useState<Array<{ assigneeId: string; quantity: string }>>([{ assigneeId: "", quantity: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/approvers?roles=PR")
        .then((r) => r.json())
        .then((d) => setPrs(Array.isArray(d) ? d : []))
        .catch(() => setPrs([]));
    }
  }, [open ]);

  function setRow(i: number, patch: Partial<{ assigneeId: string; quantity: string }>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    setError("");
    const assignments = rows
      .filter((r) => r.assigneeId)
      .map((r) => ({ assigneeId: r.assigneeId, quantity: parseInt(r.quantity, 10) }));
    if (assignments.length === 0) return setError("请至少指定一位 PR");
    if (requestType === "WEEKLY_STYLE") {
      const sum = assignments.reduce((s, a) => s + (Number.isInteger(a.quantity) ? a.quantity : 0), 0);
      if (sum !== totalQuantity) return setError(`拆分数量之和（${sum}）须等于需求数量（${totalQuantity}）`);
    }
    setSaving(true);
    const res = await fetch(`/api/procurement/${requestId}/distribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "分发失败");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>分发任务</button>
      {open && (
        <Modal title="分发任务给 PR" onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-gray-500">
            {requestType === "WEEKLY_STYLE"
              ? `周维度任务：按数量拆分，拆分之和须等于 ${totalQuantity}`
              : "链接采买：指定一位 PR 直接接单"}
          </p>
          {rows.map((r, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <select
                className={inputCls}
                value={r.assigneeId}
                onChange={(e) => setRow(i, { assigneeId: e.target.value })}
              >
                <option value="">选择 PR</option>
                {prs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {requestType === "WEEKLY_STYLE" && (
                <input
                  className={inputCls}
                  style={{ width: 120 }}
                  type="number"
                  min={1}
                  placeholder="数量"
                  value={r.quantity}
                  onChange={(e) => setRow(i, { quantity: e.target.value })}
                />
              )}
              {rows.length > 1 && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                >删</button>
              )}
            </div>
          ))}
          {requestType === "WEEKLY_STYLE" && (
            <button
              type="button"
              className="mb-3 text-sm text-[#0071e3]"
              onClick={() => setRows((rs) => [...rs, { assigneeId: "", quantity: "" }])}
            >+ 加一位 PR</button>
          )}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)} disabled={saving}>取消</button>
            <button className={btnPrimary} onClick={submit} disabled={saving}>{saving ? "分发中…" : "确认分发"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
