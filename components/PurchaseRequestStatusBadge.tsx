import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  REVIEWED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ASSIGNED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  VOIDED: "bg-muted text-muted-foreground",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function PurchaseRequestStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", colors[status] ?? "bg-muted text-muted-foreground", className)}>
      {label}
    </Badge>
  );
}
