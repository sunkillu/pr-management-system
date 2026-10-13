"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { roleLabels, INFLUENCER_TYPE_OPTIONS, PLATFORM_TAG_OPTIONS } from "@/lib/labels";
import Modal from "./Modal";

type Approver = { id: string; name: string; email: string; role: string };
type Attachment = { fileUrl: string; fileName: string };

export default function CoopRequestForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [title, setTitle] = useState("");
  const [reqType, setReqType] = useState("");
  const [influencerType, setInfluencerType] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      // 合作需求审批人仅限管理员
      fetch("/api/approvers?roles=ADMIN")
        .then((r) => r.json())
        .then((d) => setApprovers(Array.isArray(d) ? d : []))
        .catch(() => setApprovers([]));
    }
  }, [open ]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "附件上传失败");
      return;
    }
    setAttachments((a) => [...a, { fileUrl: data.fileUrl, fileName: data.fileName }]);
  }

  async function submit() {
    setError("");
    if (!title.trim()) return setError("标题不能为空");
    if (!description.trim()) return setError("详细描述不能为空");
    if (selected.length === 0) return setError("请选择至少一位审批人");
    setSaving(true);
    const res = await fetch("/api/coop-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        reqType: reqType.trim() || "通用合作",
        influencerType: influencerType || null,
        platforms,
        description: description.trim(),
        attachments,
        approverIds: selected,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "提交失败");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        提出合作需求
      </button>
      {open && (
        <Modal title="提出合作需求" onClose={() => setOpen(false)}>
          <Field label="标题" required>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：双11达播合作需求" />
          </Field>
          <Field label="需求类型">
            <input
              className={inputCls}
              value={reqType}
              onChange={(e) => setReqType(e.target.value)}
              placeholder="如：达播合作 / 图文种草 / 线下活动"
            />
          </Field>
          <Field label="达人类型">
            <select className={inputCls} value={influencerType} onChange={(e) => setInfluencerType(e.target.value)}>
              <option value="">请选择</option>
              {INFLUENCER_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="合作平台（可多选）">
            <div className="flex flex-wrap gap-3">
              {PLATFORM_TAG_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p.value)}
                    onChange={() => setPlatforms(toggle(platforms, p.value))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="详细描述" required>
            <textarea className={inputCls} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="附件（上传信息资料）">
            <input
              type="file"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">上传中…</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {attachments.map((a, i) => (
                <li key={i} className="flex items-center justify-between">
                  <a href={a.fileUrl} target="_blank" className="text-primary hover:underline">
                    {a.fileName}
                  </a>
                  <button
                    className="text-xs text-red-600"
                    onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          </Field>
          <Field label="审批人（多选，仅管理员，任一通过即通过）" required>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
              {approvers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => setSelected(toggle(selected, a.id))}
                  />
                  {a.name}
                  <span className="text-xs text-muted-foreground">（{roleLabels[a.role] ?? a.role}）</span>
                </label>
              ))}
              {approvers.length === 0 && <p className="text-xs text-muted-foreground">暂无可选审批人</p>}
            </div>
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "提交中…" : "提交需求"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
