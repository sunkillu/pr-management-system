"use client";
import { logActionLabels, formatDateTime } from "@/lib/labels";

export type TimelineItem = {
  id: string;
  action: string;
  actorName: string;
  createdAt: string | Date;
  note?: string | null;
  fromStatusLabel?: string | null;
  toStatusLabel?: string | null;
};

// 操作历史时间线：按时间倒序，展示谁、什么时候、做了什么、理由
export default function ApprovalTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">暂无操作记录</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="border-l-2 border-gray-200 pl-3 text-sm">
          <div>
            <span className="font-medium">{logActionLabels[it.action] ?? it.action}</span>
            {it.fromStatusLabel && it.toStatusLabel && it.fromStatusLabel !== it.toStatusLabel && (
              <span className="ml-2 text-xs text-gray-500">
                {it.fromStatusLabel} → {it.toStatusLabel}
              </span>
            )}
          </div>
          <div className="text-gray-500">
            {it.actorName} · {formatDateTime(it.createdAt)}
          </div>
          {it.note && <div className="mt-1 whitespace-pre-wrap text-gray-700">{it.note}</div>}
        </li>
      ))}
    </ol>
  );
}
