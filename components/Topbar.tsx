import { Badge } from "@/components/ui/badge";
import { roleLabels } from "@/lib/labels";
import NotificationBell from "@/components/NotificationBell";
import TopbarTitle from "@/components/TopbarTitle";
import SignOutButton from "@/components/SignOutButton";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

export default function Topbar({ userName, role }: { userName: string; role: Role }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <TopbarTitle />
      <div className="flex items-center gap-3">
        <NotificationBell />
        <span className="text-sm text-muted-foreground">{userName}</span>
        <Badge variant="secondary">{roleLabels[role]}</Badge>
        <SignOutButton />
      </div>
    </header>
  );
}
