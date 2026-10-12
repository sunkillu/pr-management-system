"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { sampleStatusLabels } from "@/lib/labels";
import Modal from "./Modal";

export type SampleInput = {
  influencerId: string;
  productName: string;
  quantity: number;
  courier: string;
  trackingNo: string;
  shippedDate: string;
  shippedBy: string;
  status: string;
};

export default function SampleForm({
  influencers,
  editTarget,
  canDelete,
  initialInfluencerId,
  autoOpen,
}: {
  influencers: { id: string; name: string }[];
  editTarget?: SampleInput & { id: string };
  canDelete?: boolean;
  initialInfluencerId?: string;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const [form, setForm] = useState<SampleInput>(
    editTarget ?? {
      influencerId: initialInfluencerId ?? "",
      productName: "",
      quantity: 1,
      courier: "",
      trackingNo: "",
      shippedDate: "",
      shippedBy: "",
      status: "SHIPPED",
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!form.productName.trim()) return setError("产品名称不能为空");
    setSaving(true);
    const url = editTarget ? `/api/samples/${editTarget.id}` : "/api/samples";
    const res = await fetch(url, {
      method: editTarget ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, productName: form.productName.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "保存失败");
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!editTarget || !confirm("确认删除该寄品记录？")) return;
    const res = await fetch(`/api/samples/${editTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "删除失败");
      return;
    }
    router.refresh();
  }

  const body = (
    <>
      <Field label="达人">
        <select
          className={inputCls}
          value={form.influencerId}
          onChange={(e) => setForm({ ...form, influencerId: e.target.value })}
        >
          <option value="">（不关联达人）</option>
          {influencers.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </Field>
      <Field label="产品名称" required>
        <input className={inputCls} value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="数量">
          <input
            type="number"
            min="1"
            className={inputCls}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </Field>
        <Field label="状态">
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {Object.entries(sampleStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="快递公司">
        <input className={inputCls} value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} placeholder="如：顺丰" />
      </Field>
      <Field label="快递单号">
        <input className={inputCls} value={form.trackingNo} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} />
      </Field>
      <Field label="寄出日期">
        <input
          type="date"
          className={inputCls}
          value={form.shippedDate}
          onChange={(e) => setForm({ ...form, shippedDate: e.target.value })}
        />
      </Field>
      <Field label="寄件人">
        <input className={inputCls} value={form.shippedBy} onChange={(e) => setForm({ ...form, shippedBy: e.target.value })} placeholder="寄件人姓名" />
      </Field>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
        <button className={btnPrimary} disabled={saving} onClick={submit}>
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </>
  );

  if (editTarget) {
    return (
      <span className="space-x-3">
        <button onClick={() => setOpen(true)} className="text-sm text-[#0071e3] hover:underline">
          编辑
        </button>
        {canDelete && (
          <button onClick={remove} className="text-sm text-red-600 hover:underline">
            删除
          </button>
        )}
        {open && <Modal title="编辑寄品" onClose={() => setOpen(false)}>{body}</Modal>}
      </span>
    );
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>登记寄品</button>
      {open && <Modal title="登记寄品" onClose={() => setOpen(false)}>{body}</Modal>}
    </>
  );
}
