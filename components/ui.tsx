"use client";
// 表单通用样式与小组件（shadcn/ui 风格：CSS 变量、无硬编码色值）

const btnBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none h-10 px-4 py-2";
const btnSmBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none h-9 px-3";

export const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export const labelCls = "block text-sm font-medium text-foreground mb-1";
export const btnPrimary = `${btnBase} bg-primary text-primary-foreground hover:bg-primary/90`;
export const btnSecondary = `${btnBase} bg-secondary text-secondary-foreground hover:bg-secondary/80`;
export const btnDanger = `${btnBase} border border-input bg-background text-destructive hover:bg-destructive/10`;
export const btnDangerSolid = `${btnBase} bg-destructive text-destructive-foreground hover:bg-destructive/90`;
// 小尺寸按钮（表格内操作、卡片快捷操作）
export const btnPrimarySm = `${btnSmBase} bg-primary text-primary-foreground hover:bg-primary/90`;
export const btnSecondarySm = `${btnSmBase} bg-secondary text-secondary-foreground hover:bg-secondary/80`;
export const btnDangerSm = `${btnSmBase} border border-input bg-background text-destructive hover:bg-destructive/10`;
export const btnDangerSolidSm = `${btnSmBase} bg-destructive text-destructive-foreground hover:bg-destructive/90`;
// 正文链接
export const linkCls =
  "text-primary underline-offset-4 hover:underline transition-colors";
// 可点击卡片 hover：轻微上浮
export const cardHoverCls =
  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
// 卡片容器
export const cardCls = "bg-card rounded-lg border";
// 表格（兼容旧用法，新代码请用 @/components/ui/table）
export const thCls =
  "border-b px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
export const tdCls = "border-b px-4 py-3.5 text-sm";

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
        {required && <span className="text-destructive"> *</span>}
        {!required && <span className="text-muted-foreground text-xs">（选填）</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

// 细分隔线
export function Divider() {
  return <hr className="border-t border-border" />;
}

// 详情页区块：带标题 + 上分隔线（首个区块无线）
export function Section({
  title,
  children,
  first = false,
  id,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  first?: boolean;
  id?: string;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className={first ? "" : "border-t border-border"}>
      <div className="px-6 py-5">
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
            {action}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

// 信息行：行间细线，最后行无线
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
      className={`flex gap-4 border-b border-border py-3 last:border-b-0 ${
        wide ? "flex-col !gap-1" : "items-start justify-between"
      }`}
    >
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-sm ${wide ? "" : "text-right"}`}>{children}</dd>
    </div>
  );
}
