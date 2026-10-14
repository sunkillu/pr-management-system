"use client";

import { useState } from "react";
import { inputCls } from "./ui";
import { STYLE_OPTIONS } from "@/lib/labels";
import {
  DEGREE_OPTIONS,
  SHELF_LIFE_OPTIONS,
  BOX_COUNT_OPTIONS,
  emptyShipItem,
  type ShipItem,
} from "@/lib/ship-items";

// 寄品明细编辑器：每行 款式下拉 / 度数下拉(+其他自定义) / 抛期下拉可搜索 / 盒数下拉可搜索 / 备注
// 旧自由文本的款式/度数仍保留展示（不在预设内时走自定义输入），不丢数据。
export default function ShipItemEditor({
  value,
  onChange,
}: {
  value: ShipItem[];
  onChange: (next: ShipItem[]) => void;
}) {
  const [customDegreeRows, setCustomDegreeRows] = useState<Set<number>>(() => {
    const s = new Set<number>();
    value.forEach((it, i) => {
      if (it.degree && !(DEGREE_OPTIONS as readonly string[]).includes(it.degree)) s.add(i);
    });
    return s;
  });
  const [customStyleRows, setCustomStyleRows] = useState<Set<number>>(() => {
    const s = new Set<number>();
    value.forEach((it, i) => {
      if (it.style && !STYLE_OPTIONS.some((o) => o.value === it.style || o.label === it.style)) s.add(i);
    });
    return s;
  });

  const update = (i: number, patch: Partial<ShipItem>) =>
    onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const toggle = (set: Set<number>, i: number, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(i);
    else next.delete(i);
    return next;
  };

  return (
    <div className="space-y-2">
      {value.map((s, i) => {
        const styleIsCustom = customStyleRows.has(i);
        const degreeIsCustom = customDegreeRows.has(i);
        return (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg bg-muted p-2">
            <div className="min-w-[130px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">款式 *</label>
              {styleIsCustom ? (
                <div className="flex gap-1">
                  <input
                    className={inputCls}
                    value={s.style}
                    onChange={(e) => update(i, { style: e.target.value })}
                    placeholder="输入款式名"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-input px-2 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setCustomStyleRows(toggle(customStyleRows, i, false));
                      update(i, { style: "" });
                    }}
                  >
                    选预设
                  </button>
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={s.style}
                  onChange={(e) => {
                    if (e.target.value === "__custom") {
                      setCustomStyleRows(toggle(customStyleRows, i, true));
                      update(i, { style: "" });
                    } else {
                      update(i, { style: e.target.value });
                    }
                  }}
                >
                  <option value="">请选择款式</option>
                  {STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value="__custom">自定义…</option>
                </select>
              )}
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted-foreground">度数</label>
              {degreeIsCustom ? (
                <div className="flex gap-1">
                  <input
                    className={inputCls}
                    value={s.degree}
                    onChange={(e) => update(i, { degree: e.target.value })}
                    placeholder="输入度数"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded border border-input px-2 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setCustomDegreeRows(toggle(customDegreeRows, i, false));
                      update(i, { degree: "" });
                    }}
                  >
                    选预设
                  </button>
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={s.degree}
                  onChange={(e) => {
                    if (e.target.value === "__other") {
                      setCustomDegreeRows(toggle(customDegreeRows, i, true));
                      update(i, { degree: "" });
                    } else {
                      update(i, { degree: e.target.value });
                    }
                  }}
                >
                  <option value="">（选填）</option>
                  {DEGREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="__other">其他…</option>
                </select>
              )}
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted-foreground">抛期</label>
              <input
                className={inputCls}
                list={`shelfLife-${i}`}
                value={s.shelfLife}
                onChange={(e) => update(i, { shelfLife: e.target.value })}
                placeholder="选填"
              />
              <datalist id={`shelfLife-${i}`}>
                {SHELF_LIFE_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs text-muted-foreground">盒数</label>
              <input
                className={inputCls}
                list={`boxCount-${i}`}
                inputMode="numeric"
                value={s.boxCount}
                onChange={(e) => update(i, { boxCount: e.target.value })}
                placeholder="选填"
              />
              <datalist id={`boxCount-${i}`}>
                {BOX_COUNT_OPTIONS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">寄品备注</label>
              <input
                className={inputCls}
                value={s.note}
                onChange={(e) => update(i, { note: e.target.value })}
                placeholder="选填"
              />
            </div>
            <button
              type="button"
              className="rounded border border-red-300 px-2.5 py-2 text-xs text-red-600 hover:bg-red-50"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              删除
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="rounded border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        onClick={() => onChange([...value, emptyShipItem()])}
      >
        + 增加一款
      </button>
    </div>
  );
}
