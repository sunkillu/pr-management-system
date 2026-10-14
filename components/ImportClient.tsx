"use client";
import { useState } from "react";

type PreviewRow = {
  row: number;
  name?: string;
  influencerName?: string;
  platforms?: string[];
  fee?: number | null;
  errors: string[];
  skipped?: boolean;
};

type Preview = {
  total: number;
  validCount: number;
  skipCount?: number;
  errorCount: number;
  preview: PreviewRow[];
  errors: string[];
};

const KINDS = [
  { value: "influencers", label: "达人库" },
  { value: "records", label: "历史合作记录" },
];

export default function ImportClient() {
  const [kind, setKind] = useState("influencers");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f, "utf-8");
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const doPreview = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, csv, confirmed: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "解析失败");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setLoading(false);
    }
  };

  const doImport = async () => {
    if (!confirm(`确认导入${preview?.validCount ?? 0}条数据？`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, csv, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      setResult(
        `导入完成：成功 ${data.created} 条，跳过 ${data.skipped ?? 0} 条，失败 ${data.failed} 条`
      );
      setPreview(null);
      setCsv("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => {
                setKind(k.value);
                setPreview(null);
                setResult(null);
                setError(null);
              }}
              className={`rounded-full px-4 py-1.5 text-sm ${
                kind === k.value
                  ? "bg-primary text-white"
                  : "bg-muted text-foreground hover:bg-gray-200"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <a
          href={`/api/admin/import/template?kind=${kind}`}
          className="text-sm text-primary hover:underline"
        >
          下载CSV模板
        </a>
      </div>

      <div className="rounded-lg bg-card p-4">
        <label className="block text-sm font-medium text-foreground">上传 CSV 文件</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="mt-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          请使用 UTF-8 编码。达人按"姓名+平台"去重，已存在的会跳过；合作记录的达人必须已在库中。
        </p>
        <button
          onClick={doPreview}
          disabled={!csv.trim() || loading}
          className="mt-3 rounded-full bg-primary px-5 py-2 text-sm text-white disabled:opacity-40"
        >
          {loading ? "处理中…" : "解析预览"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {result}
        </div>
      )}

      {preview && (
        <div className="rounded-lg bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
            <span>
              共 <b>{preview.total}</b> 行
            </span>
            <span className="text-green-700">
              可导入 <b>{preview.validCount}</b>
            </span>
            {preview.skipCount != null && preview.skipCount > 0 && (
              <span className="text-amber-700">
                跳过（已存在） <b>{preview.skipCount}</b>
              </span>
            )}
            {preview.errorCount > 0 && (
              <span className="text-red-600">
                有误 <b>{preview.errorCount}</b>
              </span>
            )}
            <button
              onClick={doImport}
              disabled={preview.validCount === 0 || loading}
              className="ml-auto rounded-full bg-primary px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              确认导入
            </button>
          </div>
          {preview.errors.length > 0 && (
            <div className="mb-3 max-h-40 overflow-auto rounded bg-red-50 p-3 text-xs text-red-700">
              {preview.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2">行号</th>
                <th className="py-2">名称</th>
                <th className="py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2">{r.row}</td>
                  <td className="py-2">{r.name ?? r.influencerName ?? "-"}</td>
                  <td className="py-2">
                    {r.errors.length > 0 ? (
                      <span className="text-red-600">{r.errors.join("；")}</span>
                    ) : r.skipped ? (
                      <span className="text-amber-600">已存在，跳过</span>
                    ) : (
                      <span className="text-green-600">可导入</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.total > 10 && (
            <p className="mt-2 text-xs text-muted-foreground">仅显示前 10 行</p>
          )}
        </div>
      )}
    </div>
  );
}
