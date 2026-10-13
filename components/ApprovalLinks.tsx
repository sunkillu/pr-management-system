"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { inputCls, btnPrimary, btnSecondary } from "./ui";
import { docTypeLabels, contentStatusLabels, paymentStatusLabels, badgeClass } from "@/lib/labels";

export type LinkItem = {
  id: string;
  otherType: string;
  otherId: string;
  otherTitle: string;
  otherStatus: string;
  createdByName: string;
  createdAt: string | Date;
};

function statusLabel(type: string, status: string) {
  return type === "CONTENT" ? contentStatusLabels[status] ?? status : paymentStatusLabels[status] ?? status;
}

function detailHref(type: string, id: string) {
  return type === "CONTENT" ? `/contents/${id}` : `/payments/${id}`;
}

// 关联单据管理：列表展示（可跳转）、新增关联（搜索选择）、解除关联
export default function ApprovalLinks({
  docType,
  docId,
  initialLinks,
  canEdit,
}: {
  docType: string;
  docId: string;
  initialLinks: LinkItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [links, setLinks] = useState<LinkItem[]>(initialLinks);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState("CONTENT");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; status: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<LinkItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const res = await fetch(`/api/links?docType=${docType}&docId=${docId}`);
    if (res.ok) setLinks(await res.json());
    router.refresh();
  };

  const doSearch = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/links/search?type=${tab}&q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const rows = await res.json();
        setResults(rows.filter((r: { id: string }) => r.id !== docId || tab !== docType));
      }
    } finally {
      setSearching(false);
    }
  };

  const doLink = async (otherId: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromType: docType, fromId: docId, toType: tab, toId: otherId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "关联失败");
        return;
      }
      setShowAdd(false);
      setQuery("");
      setResults([]);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const doUnlink = async () => {
    if (!unlinkTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/links/${unlinkTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setUnlinkTarget(null);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">关联单据</h3>
        {canEdit && (
          <button onClick={() => { setShowAdd(true); setError(""); }} className="text-sm text-primary hover:underline">
            + 新增关联
          </button>
        )}
      </div>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无关联单据</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
              <div>
                <Link href={detailHref(l.otherType, l.otherId)} className="font-medium text-primary hover:underline">
                  {l.otherTitle}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className={`mr-1 rounded px-1.5 py-0.5 ${badgeClass(l.otherStatus)}`}>
                    {statusLabel(l.otherType, l.otherStatus)}
                  </span>
                  {docTypeLabels[l.otherType]} · 由 {l.createdByName} 关联
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => setUnlinkTarget(l)}
                  className="ml-2 shrink-0 text-xs text-red-600 hover:underline"
                >
                  解除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <Modal title="新增关联" onClose={() => setShowAdd(false)}>
          <div className="mb-3 flex gap-2">
            {(["CONTENT", "PAYMENT"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setResults([]); }}
                className={`rounded px-3 py-1 text-sm ${tab === t ? "bg-primary text-white" : "bg-muted text-foreground"}`}
              >
                {docTypeLabels[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="输入标题关键字搜索"
            />
            <button className={btnPrimary} disabled={searching} onClick={doSearch}>
              {searching ? "搜索中…" : "搜索"}
            </button>
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
            {results.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                <div>
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className={`mr-1 rounded px-1.5 py-0.5 ${badgeClass(r.status)}`}>
                      {statusLabel(tab, r.status)}
                    </span>
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => doLink(r.id)}
                  className="shrink-0 rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  关联
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button className={btnSecondary} onClick={() => setShowAdd(false)}>关闭</button>
          </div>
        </Modal>
      )}

      {unlinkTarget && (
        <ConfirmDialog
          title="解除关联"
          message={`确认解除与「${unlinkTarget.otherTitle}」的关联吗？`}
          confirmText="确认解除"
          danger
          busy={busy}
          onConfirm={doUnlink}
          onClose={() => setUnlinkTarget(null)}
        />
      )}
    </div>
  );
}
