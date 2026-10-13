"use client";
import { inputCls, Field } from "./ui";
import { PLATFORM_TAG_OPTIONS, STYLE_OPTIONS, coopTypeLabels } from "@/lib/labels";

// 档期报价字段组件：独立字段组（不直接改 TicketForm.tsx，由总协调接入）
// 字段：达人 / 合作平台（多选） / 合作类型 / 合作款式（多选） / 预估发布年月 / 预估报价 / 负责人PR / 确定档期（确认/暂不确认）

export type PartnerOption = { id: string; name: string };
export type PrOption = { id: string; name: string };

export type ScheduleQuoteValue = {
  influencerId: string;
  platforms: string[];
  coopType: string;
  styles: string[];
  estimatedPublishMonth: string; // YYYY-MM
  quoteAmount: string; // 合作报价（A级敏感：禁止输出到日志）
  prOwnerId: string;
  confirmSchedule: boolean; // true = ①确认档期 / false = ②暂不确认
  confirmedDate: string; // YYYY-MM-DD，确认档期时必填
};

export const scheduleQuoteInitial: ScheduleQuoteValue = {
  influencerId: "",
  platforms: [],
  coopType: "INFLUENCER_POST",
  styles: [],
  estimatedPublishMonth: "",
  quoteAmount: "",
  prOwnerId: "",
  confirmSchedule: false,
  confirmedDate: "",
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// 前端校验，返回字段名→错误文案（无错误时返回空对象）
export function validateScheduleQuote(v: ScheduleQuoteValue): Partial<Record<keyof ScheduleQuoteValue, string>> {
  const errors: Partial<Record<keyof ScheduleQuoteValue, string>> = {};
  if (!v.influencerId) errors.influencerId = "请选择合作达人";
  if (v.platforms.length === 0) errors.platforms = "请选择合作平台（可多选）";
  if (!v.coopType) errors.coopType = "请选择合作类型";
  if (v.styles.length === 0) errors.styles = "请选择合作款式（可多选）";
  if (!MONTH_RE.test(v.estimatedPublishMonth)) errors.estimatedPublishMonth = "请填写预估发布年月（如 2026-11）";
  if (!v.quoteAmount || Number(v.quoteAmount) <= 0) errors.quoteAmount = "预估报价必须大于 0";
  if (!v.prOwnerId) errors.prOwnerId = "请选择负责人PR";
  if (v.confirmSchedule && !DATE_RE.test(v.confirmedDate)) errors.confirmedDate = "请使用日期选择器填写确定档期";
  return errors;
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function ScheduleQuoteFields({
  value,
  onChange,
  influencers,
  prs,
  errors = {},
}: {
  value: ScheduleQuoteValue;
  onChange: (patch: Partial<ScheduleQuoteValue>) => void;
  influencers: PartnerOption[];
  prs: PrOption[];
  errors?: Partial<Record<keyof ScheduleQuoteValue, string>>;
}) {
  return (
    <div className="space-y-1">
      <Field label="达人" required>
        <select
          className={inputCls}
          value={value.influencerId}
          onChange={(e) => onChange({ influencerId: e.target.value })}
        >
          <option value="">请选择</option>
          {influencers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {errors.influencerId && <p className="mt-1 text-xs text-destructive">{errors.influencerId}</p>}
      </Field>

      <Field label="合作平台（可多选）" required>
        <div className="flex flex-wrap gap-3">
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <label key={p.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={value.platforms.includes(p.value)}
                onChange={() => onChange({ platforms: toggle(value.platforms, p.value) })}
              />
              {p.label}
            </label>
          ))}
        </div>
        {errors.platforms && <p className="mt-1 text-xs text-destructive">{errors.platforms}</p>}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="合作类型" required>
          <select
            className={inputCls}
            value={value.coopType}
            onChange={(e) => onChange({ coopType: e.target.value })}
          >
            {Object.entries(coopTypeLabels).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          {errors.coopType && <p className="mt-1 text-xs text-destructive">{errors.coopType}</p>}
        </Field>
        <Field label="预估发布年月" required hint="如 2026-11">
          <input
            type="month"
            className={inputCls}
            value={value.estimatedPublishMonth}
            onChange={(e) => onChange({ estimatedPublishMonth: e.target.value })}
          />
          {errors.estimatedPublishMonth && <p className="mt-1 text-xs text-destructive">{errors.estimatedPublishMonth}</p>}
        </Field>
      </div>

      <Field label="合作款式（可多选）" required>
        <div className="flex flex-wrap gap-3">
          {STYLE_OPTIONS.map((s) => (
            <label key={s.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={value.styles.includes(s.value)}
                onChange={() => onChange({ styles: toggle(value.styles, s.value) })}
              />
              {s.label}
            </label>
          ))}
        </div>
        {errors.styles && <p className="mt-1 text-xs text-destructive">{errors.styles}</p>}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="预估报价（元）" required hint="敏感信息，仅用于内部核算">
          <input
            type="number"
            min={0.01}
            step="0.01"
            className={inputCls}
            value={value.quoteAmount}
            onChange={(e) => onChange({ quoteAmount: e.target.value })}
            placeholder="如：3000"
            autoComplete="off"
          />
          {errors.quoteAmount && <p className="mt-1 text-xs text-destructive">{errors.quoteAmount}</p>}
        </Field>
        <Field label="负责人PR" required>
          <select
            className={inputCls}
            value={value.prOwnerId}
            onChange={(e) => onChange({ prOwnerId: e.target.value })}
          >
            <option value="">请选择</option>
            {prs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.prOwnerId && <p className="mt-1 text-xs text-destructive">{errors.prOwnerId}</p>}
        </Field>
      </div>

      <Field label="确定档期" required>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ confirmSchedule: true })}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              value.confirmSchedule
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
            }`}
          >
            ① 确认档期
          </button>
          <button
            type="button"
            onClick={() => onChange({ confirmSchedule: false, confirmedDate: "" })}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              !value.confirmSchedule
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
            }`}
          >
            ② 暂不确认
          </button>
        </div>
        {value.confirmSchedule ? (
          <div className="mt-2">
            <input
              type="date"
              className={inputCls}
              value={value.confirmedDate}
              onChange={(e) => onChange({ confirmedDate: e.target.value })}
            />
            {errors.confirmedDate && <p className="mt-1 text-xs text-destructive">{errors.confirmedDate}</p>}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">暂不确认时，仅使用上方预估发布年月作为参考。</p>
        )}
      </Field>

      <div className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
        <p className="font-medium text-foreground">档期报价规则</p>
        <ul className="mt-1 list-disc pl-4">
          <li>暂不确认档期（仅有预估发布年月）时，工单不能进入合作中。</li>
          <li>报价与确定档期均填写完整后，方可进入合作中。</li>
        </ul>
      </div>
    </div>
  );
}
