"use client";
// 表单通用样式与小组件（Apple Store 风格：#f5f5f7 背景、无阴影、细分隔线、苹果蓝 #0071e3）
// 按钮语言：主按钮苹果蓝实心 / 次按钮浅灰 / 危险操作红色描边；hover 加深、active 轻微回弹、disabled 置灰

const btnBase =
  "inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 select-none";
const btnSmBase =
  "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 select-none";

export const inputCls =
  "w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0071e3]/40 focus:border-[#0071e3] disabled:bg-gray-100";
export const labelCls = "block text-sm font-medium text-gray-700 mb-1";
export const btnPrimary = `${btnBase} bg-[#0071e3] text-white hover:bg-[#0077ed] active:bg-[#0068d1] shadow-[0_1px_2px_rgba(0,113,227,0.25)]`;
export const btnSecondary = `${btnBase} bg-[#f5f5f7] text-gray-800 hover:bg-[#e8e8ed] active:bg-[#dcdce1]`;
export const btnDanger = `${btnBase} border border-red-300 bg-white text-red-600 hover:bg-red-50 hover:border-red-400 active:bg-red-100`;
export const btnDangerSolid = `${btnBase} bg-red-600 text-white hover:bg-red-700 active:bg-red-800`;
// 小尺寸按钮（表格内操作、卡片快捷操作）
export const btnPrimarySm = `${btnSmBase} bg-[#0071e3] text-white hover:bg-[#0077ed] active:bg-[#0068d1]`;
export const btnSecondarySm = `${btnSmBase} bg-[#f5f5f7] text-gray-700 hover:bg-[#e8e8ed] active:bg-[#dcdce1]`;
export const btnDangerSm = `${btnSmBase} border border-red-300 bg-white text-red-600 hover:bg-red-50 active:bg-red-100`;
export const btnDangerSolidSm = `${btnSmBase} bg-red-600 text-white hover:bg-red-700 active:bg-red-800`;
// 正文链接：苹果蓝，hover 下划线过渡
export const linkCls =
  "text-[#0071e3] transition-colors hover:text-[#0077ed] underline-offset-2 hover:underline";
// 可点击卡片 hover：轻微上浮 + 淡阴影
export const cardHoverCls =
  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]";
// Apple Store 风格卡片：无阴影无线框
export const cardCls = "bg-white rounded-2xl";
export const thCls =
  "border-b border-[#f0f0f0] px-4 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap";
export const tdCls = "border-b border-[#f0f0f0] px-4 py-3.5 text-sm";

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-500"> *</span>}
        {!required && <span className="text-gray-400 text-xs">（选填）</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex items-start justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1.5 text-sm text-gray-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

// Apple Store 风格细分隔线
export function Divider() {
  return <hr className="border-t border-[#e5e5e5]" />;
}

// 详情页区块：带标题 + 上分隔线（首个区块无线）
export function Section({
  title,
  children,
  first = false,
  id,
}: {
  title?: string;
  children: React.ReactNode;
  first?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={first ? "" : "border-t border-[#e5e5e5]"}>
      <div className="px-6 py-5">
        {title && <h3 className="mb-4 text-[15px] font-semibold tracking-tight">{title}</h3>}
        {children}
      </div>
    </section>
  );
}

// iOS 设置式信息行：行间细线，最后行无线
export function InfoRow({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 border-b border-[#f0f0f0] py-3 last:border-b-0 ${
        wide ? "flex-col !gap-1" : "items-start justify-between"
      }`}
    >
      <dt className="shrink-0 text-sm text-gray-400">{label}</dt>
      <dd className={`text-sm ${wide ? "" : "text-right"}`}>{children}</dd>
    </div>
  );
}
