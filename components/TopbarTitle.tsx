"use client";
import { usePathname } from "next/navigation";

// 路由前缀 → 标题，按最长前缀匹配
const titles: Array<[string, string]> = [
  ["/reports/platform", "平台汇总"],
  ["/admin/import", "数据导入"],
  ["/admin/export", "数据导出"],
  ["/partners", "合作资源"],
  ["/tickets", "合作工单"],
  ["/samples", "寄品管理"],
  ["/payments", "打款审批"],
  ["/invoices", "发票管理"],
  ["/contents", "内容管理"],
  ["/reports", "效果报表"],
  ["/users", "用户管理"],
  ["/tags", "标签管理"],
  ["/brands", "品牌管理"],
  ["/styles", "合作款式"],
];

export default function TopbarTitle() {
  const pathname = usePathname();
  const hit = titles
    .filter(([p]) => pathname === p || pathname.startsWith(p + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return <h1 className="text-base font-semibold">{hit ? hit[1] : "首页仪表盘"}</h1>;
}
