"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Package,
  Wallet,
  Receipt,
  BarChart3,
  Tags,
  UserCog,
  Upload,
  Download,
  ChevronDown,
  Award,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

const ALL = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as Role[];
// 仓库仅看首页 + 寄品管理
const WAREHOUSE_ONLY: Role[] = ["WAREHOUSE"];

type NavItem = { href: string; label: string; roles: Role[]; match?: string[]; icon: LucideIcon };
type NavGroup = { key: string; label: string; items: NavItem[] };
type NavEntry =
  | { type: "link"; item: NavItem }
  | { type: "group"; group: NavGroup };

const entries: NavEntry[] = [
  { type: "link", item: { href: "/", label: "首页仪表盘", roles: [...ALL, ...WAREHOUSE_ONLY], icon: LayoutDashboard } },
  {
    type: "group",
    group: {
      key: "content-coop",
      label: "合作管理",
      items: [
        {
          href: "/partners",
          label: "合作资源",
          roles: ALL,
          match: ["/partners", "/influencers", "/makeup-artists", "/outlets"],
          icon: Users,
        },
        { href: "/tickets", label: "合作工单", roles: ALL, icon: ClipboardList },
        { href: "/coop-requests", label: "合作需求", roles: ALL, icon: FileText },
        { href: "/samples", label: "寄品管理", roles: [...ALL, ...WAREHOUSE_ONLY], icon: Package },
        { href: "/data-tasks", label: "数据回收", roles: ALL, icon: BarChart3 },
      ],
    },
  },
  {
    type: "group",
    group: {
      key: "finance",
      label: "财务",
      items: [
        { href: "/payments", label: "打款审批", roles: ALL, icon: Wallet },
        { href: "/invoices", label: "发票管理", roles: ALL, icon: Receipt },
      ],
    },
  },
  {
    type: "group",
    group: {
      key: "platform-config",
      label: "平台配置",
      items: [
        { href: "/reports/platform", label: "平台汇总", roles: ["ADMIN", "PR_MANAGER", "FINANCE"], icon: BarChart3 },
        { href: "/tags", label: "标签管理", roles: ["ADMIN", "PR"], icon: Tags },
        { href: "/brands", label: "品牌管理", roles: ["ADMIN"], icon: Award },
        { href: "/users", label: "用户管理", roles: ["ADMIN"], icon: UserCog },
        { href: "/admin/import", label: "数据导入", roles: ["ADMIN"], icon: Upload },
        { href: "/admin/export", label: "数据导出", roles: ["ADMIN"], icon: Download },
      ],
    },
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = item.match ?? [item.href];
  return prefixes.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  // 当前页面所在分组自动展开
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const e of entries) {
      if (e.type === "group") {
        init[e.group.key] = e.group.items.some(
          (i) => i.roles.includes(role) && isActive(pathname, i)
        );
      }
    }
    return init;
  });

  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-5 py-4">
        <div className="text-base font-semibold">PR媒体管理系统</div>
        <div className="mt-0.5 text-xs text-muted-foreground">电商公司 · v1</div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {entries.map((e) => {
          if (e.type === "link") {
            const item = e.item;
            if (!item.roles.includes(role)) return null;
            return <NavLink key={item.href} item={item} active={isActive(pathname, item)} />;
          }
          const g = e.group;
          const items = g.items.filter((i) => i.roles.includes(role));
          if (items.length === 0) return null;
          const expanded = !!open[g.key];
          const hasActive = items.some((i) => isActive(pathname, i));
          return (
            <div key={g.key}>
              <button
                onClick={() => toggle(g.key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
                  hasActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="text-xs font-medium uppercase tracking-wider">{g.label}</span>
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                />
              </button>
              {expanded && (
                <div className="mt-1 space-y-1">
                  {items.map((i) => (
                    <NavLink key={i.href} item={i} active={isActive(pathname, i)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
