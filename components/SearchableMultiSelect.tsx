"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { inputCls } from "./ui";

export type MultiSelectOption = { value: string; label: string };

// 下拉多选：点击展开，支持关键字搜索、勾选/取消、已选项以标签展示并可直接移除
export default function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索…",
  emptyText = "没有匹配项",
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // 捕获阶段拦截 Esc：只关闭下拉，不让外层弹窗一起关闭而丢失已填内容
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // 已选但已不在可选项里的值（如历史/已停用款式）也要显示，避免静默丢失
  const allOptions = useMemo(() => {
    const known = new Set(options.map((o) => o.value));
    return [...options, ...value.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v }))];
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allOptions.filter((o) => o.label.toLowerCase().includes(q)) : allOptions;
  }, [allOptions, query]);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={rootRef} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen((o) => !o))}
        className={`${inputCls} h-auto min-h-10 cursor-pointer flex-wrap items-center gap-1.5`}
      >
        {value.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {allOptions.find((o) => o.value === v)?.label ?? v}
            <button
              type="button"
              aria-label="移除"
              className="hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                toggle(v);
              }}
            >
              ×
            </button>
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg">
          <div className="border-b border-input p-2">
            <input
              autoFocus
              className={inputCls}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
                  {o.label}
                </label>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">{emptyText}</li>}
          </ul>
          <div className="flex items-center justify-between border-t border-input px-3 py-1.5 text-xs text-muted-foreground">
            <span>已选 {value.length} 项</span>
            {value.length > 0 && (
              <button type="button" className="text-primary hover:underline" onClick={() => onChange([])}>
                清空
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
