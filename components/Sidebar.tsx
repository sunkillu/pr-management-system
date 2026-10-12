"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { roleLabels } from "@/lib/labels";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

const ALL = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as Role[];
// 仓库仅看首页 + 寄品管理
const WAREHOUSE_ONLY: Role[] = ["WAREHOUSE"];

type NavItem = { href: string; label: string; roles: Role[]; match?: string[] };
type NavGroup = { key: string; label: string; items: NavItem[] };
type NavEntry =
  | { type: "link"; item: NavItem }
  | { type: "group"; group: NavGroup };

const entries: NavEntry[] = [
  { type: "link", item: { href: "/", label: "首页仪表盘", roles: [...ALL, ...WAREHOUSE_ONLY] } },
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
        },
        { href: "/tickets", label: "合作工单", roles: ALL },
        { href: "/coop-requests", label: "合作需求", roles: ALL },
        { href: "/procurement", label: "采买需求", roles: ["ADMIN", "OPERATOR", "PR"] },
        { href: "/samples", label: "寄品管理", roles: [...ALL, ...WAREHOUSE_ONLY] },
      ],
    },
  },
  {
    type: "group",
    group: {
      key: "finance",
      label: "财务",
      items: [
        { href: "/payments", label: "打款审批", roles: ALL },
        { href: "/invoices", label: "发票管理", roles: ALL },
      ],
    },
  },
  { type: "link", item: { href: "/reports/platform", label: "平台汇总", roles: ["ADMIN", "PR_MANAGER", "FINANCE"] } },
  { type: "link", item: { href: "/tags", label: "标签管理", roles: ["ADMIN", "PR"] } },
  {
    type: "group",
    group: {
      key: "platform-config",
      label: "平台配置",
      items: [
        { href: "/users", label: "用户管理", roles: ["ADMIN"] },
        { href: "/admin/import", label: "数据导入", roles: ["ADMIN"] },
        { href: "/admin/export", label: "数据导出", roles: ["ADMIN"] },
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

export default function Sidebar({
  userName,
  email,
  role,
}: {
  userName: string;
  email: string;
  role: Role;
}) {
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

  const linkCls = (active: boolean) =>
    `block rounded-[10px] px-3 py-2 text-sm transition-colors ${
      active ? "bg-[#0071e3] text-white" : "text-gray-300 hover:bg-white/10"
    }`;

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-gray-900 text-gray-200">
      <div className="border-b border-gray-700 px-5 py-4">
        <div className="text-base font-bold text-white">PR媒体管理系统</div>
        <div className="mt-1 text-xs text-gray-400">电商公司 · v1</div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {entries.map((e) => {
          if (e.type === "link") {
            const item = e.item;
            if (!item.roles.includes(role)) return null;
            const active = isActive(pathname, item);
            return (
              <Link key={item.href} href={item.href} className={linkCls(active)}>
                {item.label}
              </Link>
            );
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
                className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left transition-colors ${
                  hasActive ? "text-white" : "text-gray-400 hover:bg-white/10 hover:text-gray-200"
                }`}
              >
                <span className="text-xs font-medium tracking-wide">{g.label}</span>
                <span
                  className={`text-xs text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </button>
              {expanded && (
                <div className="ml-3 space-y-1 border-l border-gray-700 pl-3 pt-1">
                  {items.map((i) => (
                    <Link key={i.href} href={i.href} className={linkCls(isActive(pathname, i))}>
                      {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-gray-700 px-5 py-4 text-xs">
        <div className="font-medium text-white">{userName}</div>
        <div className="truncate text-gray-400">{email}</div>
        <div className="mt-1 inline-block rounded bg-gray-700 px-2 py-0.5 text-gray-300">
          {roleLabels[role]}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 block w-full rounded-[10px] border border-gray-600 px-3 py-1.5 text-center transition-colors hover:border-gray-500 hover:bg-gray-800 active:bg-gray-700"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
