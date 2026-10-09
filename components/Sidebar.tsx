"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { roleLabels } from "@/lib/labels";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER";

const ALL = ["ADMIN", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as Role[];

const nav: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "首页仪表盘", roles: ALL },
  { href: "/outlets", label: "媒体资源库", roles: ALL },
  { href: "/contents", label: "内容管理", roles: ALL },
  { href: "/campaigns", label: "项目排期", roles: ALL },
  { href: "/payments", label: "打款审批", roles: ALL },
  { href: "/invoices", label: "发票管理", roles: ALL },
  { href: "/influencers", label: "达人库", roles: ALL },
  { href: "/makeup-artists", label: "化妆师库", roles: ALL },
  { href: "/cooperations", label: "合作记录", roles: ALL },
  { href: "/samples", label: "寄品管理", roles: ALL },
  { href: "/coop-requests", label: "合作需求", roles: ALL },
  { href: "/reports", label: "效果报表", roles: ALL },
  { href: "/users", label: "用户管理", roles: ["ADMIN"] },
];

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
  const items = nav.filter((n) => n.roles.includes(role));

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-gray-900 text-gray-200">
      <div className="border-b border-gray-700 px-5 py-4">
        <div className="text-base font-bold text-white">PR媒体管理系统</div>
        <div className="mt-1 text-xs text-gray-400">电商公司 · v1</div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`block rounded px-3 py-2 text-sm ${
                active ? "bg-blue-600 text-white" : "hover:bg-gray-800"
              }`}
            >
              {n.label}
            </Link>
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
          className="mt-3 block w-full rounded border border-gray-600 px-3 py-1.5 text-center hover:bg-gray-800"
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
