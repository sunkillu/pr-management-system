"use client";
import { formatDate } from "@/lib/labels";

type TLNode = {
  id: string;
  name: string;
  expectedAt: string | null;
  completedAt: string | null;
};

// 节点时间线：计划 vs 实际横向对比
// 每行一个节点，左侧计划日期，右侧实际日期，中间连线；延迟标红、提前/按时标绿
export default function NodeTimeline({ nodes }: { nodes: TLNode[] }) {
  if (nodes.length === 0) return <p className="text-sm text-gray-400">暂无进度节点</p>;

  // 计算时间轴范围
  const dates = nodes
    .flatMap((n) => [n.expectedAt, n.completedAt])
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime());
  if (dates.length === 0) {
    return <p className="text-sm text-gray-400">节点暂无计划/实际时间</p>;
  }
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const span = Math.max(max - min, 86400000); // 至少 1 天

  const pos = (d: string | null) => {
    if (!d) return null;
    return Math.round(((new Date(d).getTime() - min) / span) * 100);
  };

  return (
    <div className="space-y-2">
      {nodes.map((n) => {
        const ep = pos(n.expectedAt);
        const cp = pos(n.completedAt);
        let diff: number | null = null;
        if (n.expectedAt && n.completedAt) {
          const e = new Date(n.expectedAt);
          const c = new Date(n.completedAt);
          e.setHours(0, 0, 0, 0);
          c.setHours(0, 0, 0, 0);
          diff = Math.round((c.getTime() - e.getTime()) / 86400000);
        }
        const color = diff === null ? "bg-gray-300" : diff <= 0 ? "bg-green-500" : "bg-red-500";
        return (
          <div key={n.id} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-gray-700" title={n.name}>
              {n.name}
            </span>
            <div className="relative h-6 flex-1 rounded bg-[#f5f5f7]">
              {ep !== null && (
                <div
                  className="absolute top-1 h-4 w-1 rounded bg-blue-400"
                  style={{ left: `${ep}%` }}
                  title={`计划：${formatDate(n.expectedAt)}`}
                />
              )}
              {cp !== null && (
                <div
                  className={`absolute top-1 h-4 w-1 rounded ${color}`}
                  style={{ left: `${cp}%` }}
                  title={`实际：${formatDate(n.completedAt)}`}
                />
              )}
              {ep !== null && cp !== null && ep !== cp && (
                <div
                  className={`absolute top-[11px] h-0.5 ${diff! <= 0 ? "bg-green-300" : "bg-red-300"}`}
                  style={{ left: `${Math.min(ep, cp)}%`, width: `${Math.abs(cp - ep)}%` }}
                />
              )}
            </div>
            <span className="w-36 shrink-0 text-xs text-gray-500">
              <span className="text-blue-500">◆ {formatDate(n.expectedAt)}</span>
              {" → "}
              <span className={diff === null ? "" : diff <= 0 ? "text-green-600" : "text-red-600"}>
                ◆ {n.completedAt ? formatDate(n.completedAt) : "未完成"}
              </span>
            </span>
            {diff !== null && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                  diff <= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {diff === 0 ? "按时" : diff < 0 ? `提前${-diff}天` : `延迟${diff}天`}
              </span>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-xs text-gray-400">
        <span className="text-blue-500">◆</span> 计划时间　
        <span className="text-gray-500">◆</span> 实际时间（绿=提前/按时，红=延迟）
      </p>
    </div>
  );
}
