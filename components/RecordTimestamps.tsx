import { formatDateTime } from "@/lib/labels";

type RecordTimestampsProps = {
  createdAt: string | Date | null;
  updatedAt?: string | Date | null;
  compact?: boolean;
};

export default function RecordTimestamps({
  createdAt,
  updatedAt,
  compact = false,
}: RecordTimestampsProps) {
  return (
    <div className={`text-xs text-muted-foreground ${compact ? "space-y-0.5 whitespace-nowrap" : "space-y-1"}`}>
      <div>创建：{createdAt ? formatDateTime(createdAt) : "历史时间未记录"}</div>
      {updatedAt !== undefined && (
        <div>最近修改：{updatedAt ? formatDateTime(updatedAt) : "历史时间未记录"}</div>
      )}
    </div>
  );
}
