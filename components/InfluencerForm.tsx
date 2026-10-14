"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { PLATFORM_TAG_OPTIONS, INFLUENCER_TYPE_OPTIONS } from "@/lib/labels";
import Modal from "./Modal";

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
  const [name, setName] = useState("");
  const [influencerType, setInfluencerType] = useState(initial?.influencerType ?? "");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? []);
  const [contactInfo, setContactInfo] = useState("");
  const [xhsLink, setXhsLink] = useState("");
  const [douyinLink, setDouyinLink] = useState("");
  const [quoteMode, setQuoteMode] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
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

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function submit() {
    setError("");
    if (!name.trim()) return setError("昵称不能为空");
    const xhs = xhsLink.trim();
    const douyin = douyinLink.trim();
    if ((xhs && !xhs.startsWith("http")) || (douyin && !douyin.startsWith("http")))
      return setError("主页链接须以 http 开头");
    setSaving(true);
    const res = await fetch("/api/influencers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        influencerType: influencerType || null,
        platforms,
        contactInfo: contactInfo.trim() || null,
        homepageId: xhs || null,
        douyinUrl: douyin || null,
        bio: quoteMode ? `报价模式：${quoteMode}` : null,
        tags,
        attachments,
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
          <Field label="昵称" required>
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
          <Field label="小红书主页链接" hint="选填，须以 http 开头">
            <input className={inputCls} value={xhsLink} onChange={(e) => setXhsLink(e.target.value)} placeholder="https://xiaohongshu.com/..." />
          </Field>
          <Field label="抖音主页链接" hint="选填，须以 http 开头">
            <input className={inputCls} value={douyinLink} onChange={(e) => setDouyinLink(e.target.value)} placeholder="https://www.douyin.com/..." />
          </Field>
          <Field label="报价模式">
            <select className={inputCls} value={quoteMode} onChange={(e) => setQuoteMode(e.target.value)}>
              <option value="">未选择</option>
              <option value="单条报价">单条报价</option>
              <option value="打包价">打包价</option>
              <option value="分佣">分佣</option>
              <option value="置换">置换</option>
              <option value="待定">待定</option>
            </select>
          </Field>
          <Field label="达人标签" hint="可多选，标签由管理员在标签管理中维护">
            {tagOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无可选标签，请联系管理员在标签管理中添加</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((t) => (
                  <label
                    key={t.id}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs ring-1 ${
                      tags.includes(t.name)
                        ? "bg-blue-600 text-white ring-blue-600"
                        : "bg-card text-foreground ring-gray-300 hover:ring-blue-400"
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
          <Field label="附件（达人的脸）" hint="请上传达人正脸照片，可截图直接粘贴（Ctrl+V）">
            <div
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of Array.from(items)) {
                  if (item.kind === "file" && item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) uploadFile(file);
                  }
                }
              }}
            >
            <div
              tabIndex={0}
              className="mb-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-center text-xs text-muted-foreground"
            >
              点击此处后按 Ctrl+V 粘贴截图
            </div>
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
            {uploading && <p className="mt-1 text-xs text-muted-foreground">上传中…</p>}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded border border-border">
                    {isImage(a.fileName) ? (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}>
                        <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}
                        className="flex h-full w-full items-center justify-center bg-muted px-1 text-center text-[10px] text-primary">
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
