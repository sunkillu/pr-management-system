"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";
import { contentTypeLabels } from "@/lib/labels";

export type ContentInput = {
  id?: string;
  title: string;
  type: string;
  body: string;
  outletId: string;
};

export default function ContentForm({
  initial,
  outlets,
  onClose,
}: {
  initial?: Partial<ContentInput> & { id?: string };
  outlets: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ContentInput>({
    title: initial?.title ?? "",
    type: initial?.type ?? "CAO_TEXT",
    body: initial?.body ?? "",
    outletId: initial?.outletId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("标题不能为空");
      return;
    }
    setBusy(true);
    try {
      const url = initial?.id ? `/api/contents/${initial.id}` : "/api/contents";
      const res = await fetch(url, {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          body: form.body.trim() || null,
          outletId: form.outletId || null,
        }),
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
    <Modal title={initial?.id ? "编辑内容（保存后版本号 +1 并回到草稿）" : "新建内容"} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Field label="标题" required>
          <input className={inputCls} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="类型" required>
            <select className={inputCls} value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(contentTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="关联资源">
            <select className={inputCls} value={form.outletId}
              onChange={(e) => setForm({ ...form, outletId: e.target.value })}>
              <option value="">不关联</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="正文 / 素材说明">
          <textarea className={inputCls} rows={8} value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })} />
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
