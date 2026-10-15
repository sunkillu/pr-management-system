"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecordTimestamps from "@/components/RecordTimestamps";
import StateHistory from "@/components/StateHistory";
import type { TimelineItem } from "@/components/ApprovalTimeline";

type StyleRow = {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  shelfLifeOptions: string[];
  isActive: boolean;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
  history: TimelineItem[];
};

type ImportPreview = {
  total: number;
  validCount: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  preview: { row: number; brandName?: string; name: string; shelfLifeOptions?: string[]; action: string; errors: string[] }[];
  errors: string[];
};

export default function StylesClient({ initialStyles, brands }: { initialStyles: StyleRow[]; brands: { id: string; name: string }[] }) {
  const router = useRouter();
  const [styles, setStyles] = useState(initialStyles);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [brandFilter, setBrandFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editShelfLife, setEditShelfLife] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [importFile, setImportFile] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState("");

  useEffect(() => setStyles(initialStyles), [initialStyles]);

  async function request(url: string, method: string, body?: unknown) {
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "操作失败");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add() {
    if (!name.trim()) return setError("款式名称不能为空");
    setBusy(true);
    if (!brandId) {
      setBusy(false);
      return setError("请先选择所属品牌");
    }
    if (await request("/api/styles", "POST", { name: name.trim(), brandId })) setName("");
    setBusy(false);
  }

  async function saveEdit(s: StyleRow) {
    if (!editName.trim()) return setError("款式名称不能为空");
    const shelfLifeOptions = Array.from(new Set(editShelfLife.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)));
    if (shelfLifeOptions.length === 0) return setError("至少配置一个抛期");
    if (editName.trim() === s.name && shelfLifeOptions.join("、") === s.shelfLifeOptions.join("、")) return setEditingId("");
    if (s.usedCount > 0 && !confirm(`「${s.name}」已被 ${s.usedCount} 张工单使用，改名后这些工单会同步显示为「${editName.trim()}」，确定吗？`)) return;
    if (await request(`/api/styles/${s.id}`, "PATCH", { name: editName.trim(), shelfLifeOptions })) setEditingId("");
  }

  function handleImportFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportCsv(String(reader.result ?? ""));
      setImportFile(file.name);
      setImportPreview(null);
      setImportResult("");
      setError("");
    };
    reader.readAsText(file, "utf-8");
  }

  async function previewImport() {
    if (!importCsv.trim()) return setError("请先选择 CSV 文件");
    setImportBusy(true);
    setError("");
    setImportResult("");
    try {
      const res = await fetch("/api/styles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv, confirmed: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "解析失败");
      setImportPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (!importPreview || importPreview.validCount === 0) return;
    if (!confirm(`确认导入 ${importPreview.createCount} 个新款式，并维护 ${importPreview.updateCount} 个已有款式？`)) return;
    setImportBusy(true);
    setError("");
    try {
      const res = await fetch("/api/styles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      setImportResult(`导入完成：新增 ${data.created} 个，维护 ${data.updated} 个，失败 ${data.failed} 个`);
      setImportCsv("");
      setImportFile("");
      setImportPreview(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImportBusy(false);
    }
  }

  const visible = styles.filter((s) => (!brandFilter || s.brandId === brandFilter) && s.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">合作款式</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          维护合作工单、采买需求和寄品明细中可选择的款式。停用后新建业务不再可选，历史记录不受影响。
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">文件导入 / 批量维护</h2>
            <p className="mt-1 text-xs text-muted-foreground">支持新增款式，也可以通过同名款式更新启用状态和排序。</p>
          </div>
          <a href="/api/styles/import" className="text-xs text-primary underline-offset-4 hover:underline">下载导入模板</a>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,text/csv" onChange={(e) => handleImportFile(e.target.files?.[0])} className="max-w-full text-sm" />
          <button onClick={previewImport} disabled={!importCsv || importBusy} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {importBusy ? "处理中…" : "解析预览"}
          </button>
          {importFile && <span className="text-xs text-muted-foreground">已选择：{importFile}</span>}
        </div>
        {importResult && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{importResult}</p>}
        {importPreview && (
          <div className="mt-4 border-t pt-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>共 {importPreview.total} 行</span>
              <span className="text-green-700">可处理 {importPreview.validCount}</span>
              <span className="text-blue-700">新增 {importPreview.createCount}</span>
              <span className="text-amber-700">维护 {importPreview.updateCount}</span>
              {importPreview.errorCount > 0 && <span className="text-red-600">有误 {importPreview.errorCount}</span>}
              <button onClick={confirmImport} disabled={importPreview.validCount === 0 || importBusy} className="ml-auto rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">确认导入</button>
            </div>
            {importPreview.errors.length > 0 && <div className="mt-3 max-h-32 overflow-auto rounded-md bg-red-50 p-3 text-xs text-red-700">{importPreview.errors.map((item) => <p key={item}>{item}</p>)}</div>}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">行号</th><th>品牌</th><th>款式</th><th>抛期</th><th>动作</th><th>校验</th></tr></thead>
                <tbody>{importPreview.preview.map((row) => <tr key={row.row} className="border-b last:border-0"><td className="py-2">{row.row}</td><td>{row.brandName || "-"}</td><td>{row.name || "-"}</td><td>{row.shelfLifeOptions?.join("、") || "-"}</td><td>{row.action}</td><td className={row.errors.length ? "text-red-600" : "text-green-700"}>{row.errors.length ? row.errors.join("；") : "可导入"}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">选择品牌</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <input
          className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="新款式名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "添加中…" : "添加款式"}
        </button>
        <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="">全部品牌</option>
          {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
        <input
          className="ml-auto w-56 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="搜索款式"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">品牌</th>
              <th className="px-4 py-3 font-medium">款式名称</th>
              <th className="px-4 py-3 font-medium">抛期</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">工单使用</th>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">操作历史</th>
              <th className="px-4 py-3 font-medium" style={{ width: 200 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{s.brandName}</td>
                <td className="px-4 py-3 font-medium">
                  {editingId === s.id ? (
                    <div className="flex flex-col gap-1">
                      <input
                        autoFocus
                        className="w-44 rounded-md border border-border bg-background px-2 py-1 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(s);
                          if (e.key === "Escape") setEditingId("");
                        }}
                      />
                      <input
                        className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs"
                        value={editShelfLife}
                        onChange={(e) => setEditShelfLife(e.target.value)}
                        placeholder="抛期：日抛、月抛"
                      />
                    </div>
                  ) : (
                    s.name
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{s.shelfLifeOptions.join("、")}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.isActive ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{s.usedCount}</td>
                <td className="px-4 py-3"><RecordTimestamps createdAt={s.createdAt} updatedAt={s.updatedAt} compact /></td>
                <td className="px-4 py-3"><StateHistory items={s.history} label="查看" /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    {editingId === s.id ? (
                      <>
                        <button onClick={() => saveEdit(s)} className="text-xs text-primary hover:underline">保存</button>
                        <button onClick={() => setEditingId("")} className="text-xs text-muted-foreground hover:underline">取消</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(s.id); setEditName(s.name); setEditShelfLife(s.shelfLifeOptions.join("、")); setError(""); }} className="text-xs text-primary hover:underline">编辑</button>
                        <button onClick={() => request(`/api/styles/${s.id}`, "PATCH", { isActive: !s.isActive })} className="text-xs text-primary hover:underline">
                          {s.isActive ? "停用" : "启用"}
                        </button>
                        <button
                          onClick={() => confirm(`删除款式「${s.name}」？`) && request(`/api/styles/${s.id}`, "DELETE")}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">暂无款式</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
