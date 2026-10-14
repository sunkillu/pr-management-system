import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";

export default function StateHistory({
  items,
  label = "状态历史",
}: {
  items: TimelineItem[];
  label?: string;
}) {
  return (
    <details className="min-w-40">
      <summary className="cursor-pointer text-xs text-primary hover:underline">
        {label}（{items.length}）
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded border bg-background p-3">
        <ApprovalTimeline items={items} />
      </div>
    </details>
  );
}
