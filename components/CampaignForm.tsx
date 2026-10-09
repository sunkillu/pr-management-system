"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";
import { campaignStatusLabels } from "@/lib/labels";

export type CampaignInput = {
  id?: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  progressNotes: string;
  ownerId: string;
  contentIds: string[];
};

export default function CampaignForm({
  initial,
  contents,
  users,
  onClose,
}: {
  initial?: Partial<CampaignInput> & { id?: string; contentIds?: string[] };
  contents: { id: string; title: string }[];
  users: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignInput>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    status: initial?.status ?? "PREPARING",
    progressNotes: initial?.progressNotes ?? "",
    ownerId: initial?.ownerId ?? "",
    contentIds: initial?.contentIds ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggleContent = (id: string) =>
    setForm((f) => ({
      ...f,
      contentIds: f.contentIds.includes(id)
        ? f.contentIds.filter((c) => c !== id)
        : [...f.contentIds, id],
    }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("项目名称不能为空");
      return;
    }
    setBusy(true);
    try {
      const url = initial?.id ? `/api/campaigns/${initial.id}` : "/api/campaigns";
      const res = await fetch(url, {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          status: form.status,
          progressNotes: form.progressNotes.trim() || null,
          ownerId: form.ownerId || null,
          contentIds: form.contentIds,
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
    <Modal title={initial?.id ? "编辑项目" : "新建项目"} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Field label="项目名称" required>
          <input className={inputCls} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="如：双11大促" />
        </Field>
        <Field label="描述">
          <textarea className={inputCls} rows={3} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="开始日期">
            <input type="date" className={inputCls} value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="结束日期">
            <input type="date" className={inputCls} value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="状态" required>
            <select className={inputCls} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(campaignStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="负责人">
            <select className={inputCls} value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
              <option value="">未指定</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="关联内容（多选）">
          <div className="max-h-40 overflow-auto rounded border border-gray-300 p-2">
            {contents.length === 0 && <p className="text-xs text-gray-400">暂无内容</p>}
            {contents.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={form.contentIds.includes(c.id)}
                  onChange={() => toggleContent(c.id)}
                />
                {c.title}
              </label>
            ))}
          </div>
        </Field>
        <Field label="进度备注">
          <textarea className={inputCls} rows={3} value={form.progressNotes}
            onChange={(e) => setForm({ ...form, progressNotes: e.target.value })} />
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
