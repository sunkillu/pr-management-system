import { Badge } from "@/components/ui/badge";
import { roleLabels } from "@/lib/labels";
import NotificationBell from "@/components/NotificationBell";
import TopbarTitle from "@/components/TopbarTitle";
import SignOutButton from "@/components/SignOutButton";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

export default function Topbar({ userName, role }: { userName: string; role: Role }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-7">
      <TopbarTitle />
      <div className="flex items-center gap-2.5 sm:gap-3">
        <NotificationBell />
        <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
        <Badge variant="secondary">{roleLabels[role]}</Badge>
        <SignOutButton />
      </div>
    </header>
  );
}
