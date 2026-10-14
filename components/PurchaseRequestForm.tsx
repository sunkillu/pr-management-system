"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import SearchableSelect from "@/components/SearchableSelect";
import { Field, btnPrimary, btnSecondary, btnDangerSm, btnSecondarySm, inputCls } from "@/components/ui";
import { PURCHASE_PLATFORM_OPTIONS } from "@/lib/purchase-shared";

type PurchaseLineDraft = {
  key: string;
  platform: string;
  link: string;
  style: string;
  quantity: string;
};

type StyleOption = { id: string; name: string; kind?: string };

function createLine(): PurchaseLineDraft {
  return { key: crypto.randomUUID(), platform: PURCHASE_PLATFORM_OPTIONS[0].value, link: "", style: "", quantity: "1" };
}

export default function PurchaseRequestForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([createLine()]);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadingStyles(true);
    fetch("/api/styles?active=1&kind=STYLE")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStyles(list.filter((item) => !item.kind || item.kind === "STYLE"));
      })
      .catch(() => setStyles([]))
      .finally(() => setLoadingStyles(false));
  }, [open]);

  const styleOptions = useMemo(
    () => styles.map((style) => ({ value: style.name, label: style.name })),
    [styles],
  );

  function updateLine(key: string, patch: Partial<PurchaseLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function reset() {
    setNote("");
    setLines([createLine()]);
    setError("");
  }

  async function submit() {
    setError("");
    if (lines.length === 0) {
      setError("请至少填写一行采买需求");
      return;
    }
    if (lines.some((line) => !line.link.trim() || !line.style.trim() || !line.quantity.trim())) {
      setError("请完整填写每一行的平台、链接、款式和数量");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim() || null,
          lines: lines.map((line) => ({
            platform: line.platform,
            link: line.link.trim(),
            style: line.style.trim(),
            quantity: Number(line.quantity),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        提交采买请求
      </button>
      {open && (
        <Modal
          title="提交采买请求"
          onClose={() => {
            setOpen(false);
            reset();
          }}
        >
          <Field label="备注">
            <textarea
              className={`${inputCls} min-h-[88px]`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="补充说明（选填）"
            />
          </Field>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">采买行</div>
              <button className={btnSecondarySm} type="button" onClick={() => setLines((current) => [...current, createLine()])}>
                新增一行
              </button>
            </div>
            {lines.map((line, index) => (
              <div key={line.key} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">第 {index + 1} 行</div>
                  <button
                    type="button"
                    className={btnDangerSm}
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    删除
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">平台</div>
                    <select className={inputCls} value={line.platform} onChange={(e) => updateLine(line.key, { platform: e.target.value })}>
                      {PURCHASE_PLATFORM_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-muted-foreground">链接</div>
                    <input className={inputCls} value={line.link} onChange={(e) => updateLine(line.key, { link: e.target.value })} placeholder="https://..." />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">数量</div>
                    <input className={inputCls} type="number" min={1} max={9999} value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs text-muted-foreground">款式</div>
                  <SearchableSelect
                    options={styleOptions}
                    value={line.style}
                    onChange={(value) => updateLine(line.key, { style: value })}
                    placeholder={loadingStyles ? "加载中…" : "请选择款式"}
                    emptyText={loadingStyles ? "加载中…" : "暂无可选款式"}
                  />
                </div>
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => { setOpen(false); reset(); }}>
              取消
            </button>
            <button className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "提交中…" : "提交请求"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
