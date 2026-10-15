import { Badge } from "@/components/ui/badge";
import { roleLabels } from "@/lib/labels";
import NotificationBell from "@/components/NotificationBell";
import TopbarTitle from "@/components/TopbarTitle";
import SignOutButton from "@/components/SignOutButton";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

export default function Topbar({ userName, role }: { userName: string; role: Role }) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <TopbarTitle />
      <div className="flex items-center gap-2.5 sm:gap-3">
        <NotificationBell />
        <div className="hidden h-8 w-px bg-border sm:block" />
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-4">{userName}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{roleLabels[role]}</div>
        </div>
        <Badge className="sm:hidden" variant="secondary">{roleLabels[role]}</Badge>
        <SignOutButton />
      </div>
    </header>
  );
}
