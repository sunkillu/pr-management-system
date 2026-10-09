"use client";
// 表单通用样式与小组件

export const inputCls =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100";
export const labelCls = "block text-sm font-medium text-gray-700 mb-1";
export const btnPrimary =
  "rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50";
export const btnSecondary =
  "rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50";
export const btnDanger =
  "rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50";
export const thCls =
  "border-b bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap";
export const tdCls = "border-b px-3 py-2 text-sm";

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
    <div className="mb-5 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-gray-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}
