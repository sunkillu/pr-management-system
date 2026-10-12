"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, labelCls, btnPrimary, btnSecondary, Field } from "./ui";
import { PLATFORM_TAG_OPTIONS, INFLUENCER_TYPE_OPTIONS, roleLabels } from "@/lib/labels";
import Modal from "./Modal";

type Approver = { id: string; name: string; email: string; role: string };
type Attachment = { fileUrl: string; fileName: string };

const isImage = (name: string) => /\.(jpe?g|png|webp|gif)$/i.test(name);

// initial：从合作需求一键加入时预填 { influencerType, platforms }
// autoOpen：带预填参数打开页面时自动弹出表单
export default function InfluencerForm({
  initial,
  autoOpen,
  influencerTags,
}: {
  initial?: { influencerType?: string; platforms?: string[] };
  autoOpen?: boolean;
  influencerTags?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [name, setName] = useState("");
  const [influencerType, setInfluencerType] = useState(initial?.influencerType ?? "");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? []);
  const [contactInfo, setContactInfo] = useState("");
  const [homepageId, setHomepageId] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const tagOptions = influencerTags ?? [];

  function toggleTag(t: string) {
    setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t].slice(0, 20)));
  }

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

  useEffect(() => {
    if (open) {
      fetch("/api/approvers")
        .then((r) => r.json())
        .then((d) => setApprovers(Array.isArray(d) ? d : []))
        .catch(() => setApprovers([]));
    }
  }, [open ]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function submit() {
    setError("");
    if (!name.trim()) return setError("达人姓名不能为空");
    if (selected.length === 0) return setError("请选择至少一位审批人");
    setSaving(true);
    const res = await fetch("/api/influencers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        influencerType: influencerType || null,
        platforms,
        contactInfo: contactInfo.trim() || null,
        homepageId: homepageId.trim() || null,
        bio: bio.trim() || null,
        tags,
        attachments,
        approverIds: selected,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error || "提交失败");
    setOpen(false);
    // 预填模式（一键加入）保存后跳干净 URL，避免弹窗重复打开
    if (autoOpen) router.push("/partners?tab=influencer");
    else router.refresh();
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        提报达人
      </button>
      {open && (
        <Modal title="提报达人登记" onClose={() => setOpen(false)}>
          <Field label="达人姓名" required>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="如：美妆老王" />
          </Field>
          <Field label="达人类型">
            <select className={inputCls} value={influencerType} onChange={(e) => setInfluencerType(e.target.value)}>
              <option value="">请选择</option>
              {INFLUENCER_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="平台标签（可多选）">
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
          <Field label="联系方式">
            <input className={inputCls} value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          </Field>
          <Field label="达人主页ID" hint="如小红书号/抖音号，发起工单时自动带入">
            <input className={inputCls} value={homepageId} onChange={(e) => setHomepageId(e.target.value)} />
          </Field>
          <Field label="简介">
            <textarea className={inputCls} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <Field label="达人标签" hint="可多选，标签由管理员在标签管理中维护">
            {tagOptions.length === 0 ? (
              <p className="text-xs text-gray-400">暂无可选标签，请联系管理员在标签管理中添加</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((t) => (
                  <label
                    key={t.id}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs ring-1 ${
                      tags.includes(t.name)
                        ? "bg-blue-600 text-white ring-blue-600"
                        : "bg-white text-gray-700 ring-gray-300 hover:ring-blue-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={tags.includes(t.name)}
                      onChange={() => toggleTag(t.name)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </Field>
          <Field label="附件（参考图）" hint="可上传达人主页截图、过往作品等，图片显示缩略图">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => uploadFile(f));
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploading && <p className="mt-1 text-xs text-gray-500">上传中…</p>}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded border border-gray-200">
                    {isImage(a.fileName) ? (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}>
                        <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}
                        className="flex h-full w-full items-center justify-center bg-[#f5f5f7] px-1 text-center text-[10px] text-[#0071e3]">
                        {a.fileName}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                      className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-xs text-white"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
          <Field label="审批人（多选，任一通过即通过）" required>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
              {approvers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => setSelected(toggle(selected, a.id))}
                  />
                  {a.name}
                  <span className="text-xs text-gray-500">（{roleLabels[a.role] ?? a.role}）</span>
                </label>
              ))}
              {approvers.length === 0 && <p className="text-xs text-gray-400">暂无可选审批人</p>}
            </div>
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "提交中…" : "提交登记"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
