"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { inputCls, btnPrimary, btnSecondary } from "./ui";

type Brand = { id: string; name: string };

// 品牌展示 + 修改按钮（弹窗要求填写修改原因）
export default function BrandField({
  targetType,
  targetId,
  brandId,
  brandName,
  canEdit = true,
  onChanged,
}: {
  targetType: "TICKET" | "SAMPLE" | "PAYMENT" | "MATERIAL" | "DATA_TASK";
  targetId: string;
  brandId: string | null;
  brandName: string | null;
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newBrandId, setNewBrandId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/brands?active=1")
        .then((r) => r.json())
        .then((d) => setBrands(Array.isArray(d) ? d : []))
        .catch(() => setBrands([]));
    }
  }, [open ]);

  async function submit() {
    setError("");
    if (!newBrandId) return setError("请选择新品牌");
    if (newBrandId === brandId) return setError("品牌未变化");
    if (!reason.trim()) return setError("修改原因必填");
    setSaving(true);
    const res = await fetch("/api/brand-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, newBrandId, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "修改失败");
    setOpen(false);
    setNewBrandId("");
    setReason("");
    onChanged?.();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        {brandName ?? "（未设置）"}
      </span>
      {canEdit && (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground hover:text-primary hover:underline"
        >
          修改
        </button>
      )}
      {open && (
        <Modal title="修改品牌" onClose={() => setOpen(false)}>
          <p className="mb-3 text-sm text-muted-foreground">
            当前品牌：<span className="font-medium text-foreground">{brandName ?? "（未设置）"}</span>
            <br />
            品牌修改将写入审计日志，请填写原因。
          </p>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">新品牌</label>
            <select
              className={inputCls}
              value={newBrandId}
              onChange={(e) => setNewBrandId(e.target.value)}
            >
              <option value="">请选择</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium">
              修改原因 <span className="text-red-600">*</span>
            </label>
            <textarea
              className={inputCls}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="如：工单归属品牌录错，实际为 BOM POP"
            />
          </div>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "保存中…" : "确认修改"}
            </button>
          </div>
        </Modal>
      )}
    </span>
  );
}
