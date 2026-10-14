"use client";
import { useState } from "react";

const TYPES = [
  { value: "influencers", label: "达人", desc: "姓名/类型/平台/标签/合作次数/累计费用" },
  { value: "tickets", label: "合作工单", desc: "工单号/标题/合作对象/平台/款式/费用/状态" },
  { value: "payments", label: "打款", desc: "标题/金额/收款人/账号/状态/申请人" },
  { value: "contents", label: "内容", desc: "标题/类型/所属工单/平台/款式/花费/链接" },
];

export default function ExportClient() {
  const [type, setType] = useState("influencers");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const doExport = () => {
    const sp = new URLSearchParams({ type });
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    window.location.href = `/api/admin/export?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-card p-4">
        <p className="text-sm font-medium text-foreground">导出类型</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                type === t.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-input"
              }`}
            >
              <div className="text-sm font-medium text-gray-900">{t.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-card p-4">
        <p className="text-sm font-medium text-foreground">
          日期范围 <span className="font-normal text-muted-foreground">（按创建时间筛选，可选）</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-[10px] border border-border px-3 py-2 text-sm"
          />
          <span className="text-sm text-muted-foreground">至</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-[10px] border border-border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={doExport}
        className="rounded-full bg-primary px-6 py-2.5 text-sm text-white hover:bg-[#0068d1] active:bg-[#0058b0]"
      >
        导出 CSV 下载
      </button>
      <p className="text-xs text-muted-foreground">
        CSV 带 BOM，Excel 直接打开不乱码。单次最多导出 10000 条。
      </p>
    </div>
  );
}
