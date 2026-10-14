"use client";
import { formatDate, formatDateTime } from "@/lib/labels";

// 档期修改审计时间线：展示原档期→新档期、修改人、修改时间、修改原因
export type ScheduleChangeItem = {
  id: string;
  oldDate: string | Date | null; // null = 首次填写
  newDate: string | Date | null; // null = 清空为"暂不确认"
  changedByName: string;
  createdAt: string | Date;
  reason?: string | null;
};

function dateLabel(d: string | Date | null): string {
  if (!d) return "—";
  return formatDate(d);
}

export default function ScheduleChangeTimeline({ items }: { items: ScheduleChangeItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无档期修改记录</p>;
  }
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {items.map((it) => (
        <li key={it.id} className="relative text-sm">
          <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/10" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground line-through decoration-destructive/60">
              {it.oldDate ? dateLabel(it.oldDate) : "（首次填写）"}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-foreground">{dateLabel(it.newDate)}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {it.changedByName} · {formatDateTime(it.createdAt)}
          </div>
          {it.reason && (
            <div className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground/80">
              {it.reason}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
