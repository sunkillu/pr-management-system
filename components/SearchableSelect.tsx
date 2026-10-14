"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { inputCls } from "./ui";

export type SelectOption = { value: string; label: string };

// 单选下拉：点击展开，支持关键字搜索；Esc 只收起下拉，不会关闭外层弹窗
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索…",
  emptyText = "没有匹配项",
  disabled = false,
  clearable = false,
  className = "",
}: {
  options: SelectOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
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

  // 已选值不在可选项里（历史/已停用）时仍要显示，避免静默丢失
  const allOptions = useMemo(
    () => (value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options),
    [options, value],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allOptions.filter((o) => o.label.toLowerCase().includes(q)) : allOptions;
  }, [allOptions, query]);
  const current = allOptions.find((o) => o.value === value);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => !disabled && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen((o) => !o))}
        className={`${inputCls} cursor-pointer items-center justify-between gap-2 ${disabled ? "opacity-50" : ""}`}
      >
        <span className={`truncate ${current ? "" : "text-muted-foreground"}`}>{current?.label ?? placeholder}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {clearable && value && (
            <button
              type="button"
              aria-label="清除"
              className="hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              ×
            </button>
          )}
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[8rem] rounded-md border border-input bg-background shadow-lg">
          <div className="border-b border-input p-2">
            <input autoFocus className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-muted ${o.value === value ? "bg-primary/10 text-primary" : ""}`}
                  onClick={() => pick(o.value)}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">{emptyText}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
