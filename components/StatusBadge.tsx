import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// 状态 → 语义色（沿用原有配色体系，套 shadcn Badge 外壳）
const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  PENDING_BIZ: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  PENDING_FIN: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PUBLISHED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  VERIFIED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  INVALID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  VOIDED: "bg-muted text-muted-foreground",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  MATERIAL_REVIEW: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  SETTLING: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  FOLLOW_UP: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  SETTLED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  INACTIVE: "bg-muted text-muted-foreground",
  PREPARING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ONGOING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ENDED: "bg-muted text-muted-foreground",
  SHIPPED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  SIGNED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  RETURNED: "bg-muted text-muted-foreground",
  WRITTEN_OFF: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  TODO: "bg-muted text-muted-foreground",
};

export default function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", statusColors[status] ?? "bg-muted text-muted-foreground", className)}
    >
      {label}
    </Badge>
  );
}
