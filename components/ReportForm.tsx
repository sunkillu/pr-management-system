"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";

export type ReportInput = {
  id?: string;
  campaignId: string;
  contentId: string;
  impressions: number;
  reads: number;
  likes: number;
  comments: number;
  conversions: number;
  gmv: string;
  recordDate: string;
  notes: string;
};

type Opt = { id: string; name?: string; title?: string };

export default function ReportForm({
  initial,
  campaigns,
  contents,
  onClose,
}: {
  initial?: Partial<ReportInput> & { id?: string };
  campaigns: Opt[];
  contents: Opt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ReportInput>({
    campaignId: initial?.campaignId ?? "",
    contentId: initial?.contentId ?? "",
    impressions: initial?.impressions ?? 0,
    reads: initial?.reads ?? 0,
    likes: initial?.likes ?? 0,
    comments: initial?.comments ?? 0,
    conversions: initial?.conversions ?? 0,
    gmv: initial?.gmv ?? "",
    recordDate: initial?.recordDate ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.campaignId) return setError("请选择关联项目");
    setBusy(true);
    try {
      const url = initial?.id ? `/api/reports/${initial.id}` : "/api/reports";
      const res = await fetch(url, {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: form.campaignId,
          contentId: form.contentId || null,
          impressions: Number(form.impressions) || 0,
          reads: Number(form.reads) || 0,
          likes: Number(form.likes) || 0,
          comments: Number(form.comments) || 0,
          conversions: Number(form.conversions) || 0,
          gmv: form.gmv === "" ? "0" : form.gmv,
          recordDate: form.recordDate || null,
          notes: form.notes.trim() || null,
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

  const num = (k: keyof ReportInput) => ({
    type: "number" as const,
    min: 0,
    className: inputCls,
    value: form[k] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <Modal title={initial?.id ? "编辑效果数据" : "录入效果数据"} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="关联项目" required>
            <select className={inputCls} value={form.campaignId}
              onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">请选择</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="关联内容">
            <select className={inputCls} value={form.contentId}
              onChange={(e) => setForm({ ...form, contentId: e.target.value })}>
              <option value="">不关联</option>
              {contents.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="曝光"><input {...num("impressions")} /></Field>
          <Field label="阅读"><input {...num("reads")} /></Field>
          <Field label="点赞"><input {...num("likes")} /></Field>
          <Field label="评论"><input {...num("comments")} /></Field>
          <Field label="转化"><input {...num("conversions")} /></Field>
          <Field label="GMV（元）">
            <input type="number" min={0} step="0.01" className={inputCls} value={form.gmv}
              onChange={(e) => setForm({ ...form, gmv: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="记录日期">
            <input type="date" className={inputCls} value={form.recordDate}
              onChange={(e) => setForm({ ...form, recordDate: e.target.value })} />
          </Field>
          <Field label="备注">
            <input className={inputCls} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>取消</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </form>
    </Modal>
  );
}
