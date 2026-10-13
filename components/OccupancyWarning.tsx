import { AlertTriangle } from "lucide-react";
import type { OccupancyInfo } from "@/lib/occupancy";

// shadcn Alert 风格的达人资源占用警示：
// 展示占用该达人的工单标题/ID/款式/平台/负责人PR/报价/档期/发布链接/剩余天数。
// 无占用时渲染 null。报价为 A级敏感信息，调用方须确保仅向授权角色展示。
export function OccupancyWarning({ occupancy }: { occupancy: OccupancyInfo }) {
  if (!occupancy.occupied) return null;

  const fmtQuote = (v: string | null) => {
    if (!v) return "—";
    const n = Number(v);
    return isNaN(n) ? v : `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
  };

  const rows: Array<[string, React.ReactNode]> = occupancy.ticketId
    ? [
        ["占用工单", occupancy.ticketTitle ?? "—"],
        ["工单ID", <span key="id" className="font-mono text-xs">{occupancy.ticketId}</span>],
        ["款式", occupancy.style.length > 0 ? occupancy.style.join("、") : "—"],
        ["平台", occupancy.platform.length > 0 ? occupancy.platform.join("、") : "—"],
        ["负责人PR", occupancy.assigneeName ?? "—"],
        ["报价", fmtQuote(occupancy.quoteAmount)],
        ["确定档期", occupancy.confirmedDate ?? "—"],
        [
          "发布链接",
          occupancy.publishLink ? (
            <a
              key="link"
              href={occupancy.publishLink}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline break-all"
            >
              {occupancy.publishLink}
            </a>
          ) : (
            "—"
          ),
        ],
        [
          "剩余天数",
          occupancy.daysRemaining !== null ? `${occupancy.daysRemaining} 天（发布后30天保护期）` : "占用中（未发布）",
        ],
      ]
    : [
        ["占用状态", "发布后30天保护期内"],
        ["剩余天数", occupancy.daysRemaining !== null ? `${occupancy.daysRemaining} 天` : "—"],
      ];

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        该达人资源已被占用
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{label}：</dt>
            <dd className="min-w-0 text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        如需继续合作，请联系负责人 PR，或由管理员使用强制创建（需填写原因并留痕）。
      </p>
    </div>
  );
}
