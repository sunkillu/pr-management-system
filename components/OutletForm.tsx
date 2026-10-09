"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";
import { outletTypeLabels, platformLabels, outletStatusLabels } from "@/lib/labels";

export type OutletInput = {
  id?: string;
  name: string;
  type: string;
  platform: string;
  followers: number;
  contactName: string;
  contactInfo: string;
  priceQuote: string;
  rating: string;
  notes: string;
  status: string;
};

const empty: OutletInput = {
  name: "",
  type: "KOL",
  platform: "DOUYIN",
  followers: 0,
  contactName: "",
  contactInfo: "",
  priceQuote: "",
  rating: "",
  notes: "",
  status: "ACTIVE",
};

export default function OutletForm({
  initial,
  onClose,
}: {
  initial?: Partial<OutletInput> & { id?: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<OutletInput>({ ...empty, ...initial } as OutletInput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof OutletInput, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("名称不能为空");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        platform: form.platform,
        followers: Number(form.followers) || 0,
        contactName: form.contactName.trim() || null,
        contactInfo: form.contactInfo.trim() || null,
        priceQuote: form.priceQuote === "" ? null : form.priceQuote,
        rating: form.rating === "" ? null : Number(form.rating),
        notes: form.notes.trim() || null,
        status: form.status,
      };
      const url = initial?.id ? `/api/outlets/${initial.id}` : "/api/outlets";
      const res = await fetch(url, {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "保存失败");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial?.id ? "编辑资源" : "新增资源"} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Field label="名称" required>
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型" required>
            <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
              {Object.entries(outletTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="平台" required>
            <select className={inputCls} value={form.platform} onChange={(e) => set("platform", e.target.value)}>
              {Object.entries(platformLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="粉丝量" required>
            <input type="number" min={0} className={inputCls} value={form.followers}
              onChange={(e) => set("followers", e.target.value)} />
          </Field>
          <Field label="状态" required>
            <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {Object.entries(outletStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="联系人">
            <input className={inputCls} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
          </Field>
          <Field label="联系方式">
            <input className={inputCls} value={form.contactInfo} onChange={(e) => set("contactInfo", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="报价（元）">
            <input type="number" min={0} step="0.01" className={inputCls} value={form.priceQuote}
              onChange={(e) => set("priceQuote", e.target.value)} />
          </Field>
          <Field label="评分（1-5）">
            <input type="number" min={1} max={5} step="0.1" className={inputCls} value={form.rating}
              onChange={(e) => set("rating", e.target.value)} />
          </Field>
        </div>
        <Field label="备注">
          <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>取消</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </form>
    </Modal>
  );
}
