"use client";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/labels";

// 品牌变更审计时间线（仿照 ScheduleChangeTimeline）
export type BrandChangeItem = {
  id: string;
  oldBrandName: string | null;
  newBrandName: string | null;
  changedByName: string;
  reason: string;
  createdAt: string;
};

export default function BrandChangeTimeline({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const [items, setItems] = useState<BrandChangeItem[]>([]);

  useEffect(() => {
    fetch(`/api/brand-change?targetType=${targetType}&targetId=${targetId}`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
  }, [targetType, targetId ]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无品牌修改记录</p>;
  }
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {items.map((it) => (
        <li key={it.id} className="relative text-sm">
          <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/10" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground line-through decoration-destructive/60">
              {it.oldBrandName ?? "（未设置）"}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-foreground">{it.newBrandName ?? "（未设置）"}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {it.changedByName} · {formatDateTime(it.createdAt)}
          </div>
          <div className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground/80">
            {it.reason}
          </div>
        </li>
      ))}
    </ol>
  );
}
