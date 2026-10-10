"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import Modal from "./Modal";

export type MakeupArtistInput = {
  name: string;
  contactInfo: string;
  isLongTerm: boolean;
  onboardDate: string;
  notes: string;
};

export default function MakeupArtistForm({
  editTarget,
  canDelete,
}: {
  editTarget?: MakeupArtistInput & { id: string };
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MakeupArtistInput>(
    editTarget ?? { name: "", contactInfo: "", isLongTerm: false, onboardDate: "", notes: "" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!form.name.trim()) return setError("姓名不能为空");
    if (form.isLongTerm && !form.onboardDate) return setError("长期合作的化妆师必须填写入库日期");
    setSaving(true);
    const url = editTarget ? `/api/makeup-artists/${editTarget.id}` : "/api/makeup-artists";
    const res = await fetch(url, {
      method: editTarget ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "保存失败");
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!editTarget || !confirm("确认删除该化妆师？")) return;
    const res = await fetch(`/api/makeup-artists/${editTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "删除失败");
      return;
    }
    router.refresh();
  }

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
        {open && (
          <Modal title="编辑化妆师" onClose={() => setOpen(false)}>
            <FormBody form={form} setForm={setForm} error={error} saving={saving} onSubmit={submit} onClose={() => setOpen(false)} />
          </Modal>
        )}
      </span>
    );
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>化妆师入库</button>
      {open && (
        <Modal title="化妆师入库" onClose={() => setOpen(false)}>
          <FormBody form={form} setForm={setForm} error={error} saving={saving} onSubmit={submit} onClose={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}

function FormBody({
  form, setForm, error, saving, onSubmit, onClose,
}: {
  form: MakeupArtistInput;
  setForm: (f: MakeupArtistInput) => void;
  error: string;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <Field label="姓名" required>
        <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="联系方式">
        <input className={inputCls} value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} />
      </Field>
      <Field label="是否长期合作">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isLongTerm}
            onChange={(e) => setForm({ ...form, isLongTerm: e.target.checked })}
          />
          长期合作（勾选后必须填写入库日期）
        </label>
      </Field>
      <Field label="入库日期" required={form.isLongTerm}>
        <input
          type="date"
          className={inputCls}
          value={form.onboardDate}
          onChange={(e) => setForm({ ...form, onboardDate: e.target.value })}
        />
      </Field>
      <Field label="备注">
        <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className={btnSecondary} onClick={onClose}>取消</button>
        <button className={btnPrimary} disabled={saving} onClick={onSubmit}>
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </>
  );
}
