"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/labels";
import { classifyNode, NODE_RULE_HINT } from "@/lib/node-rules";
import ConfirmDialog from "./ConfirmDialog";

type Node = {
  id: string;
  name: string;
  sort: number;
  expectedAt: string | null;
  completedAt: string | null;
  completedBy: { name: string } | null;
  dependsOnId: string | null;
  dependsOn: { id: string; name: string; completedAt: string | null } | null;
};

// 时间偏差：计划 expectedAt vs 实际 completedAt，返回天数（正=延迟，负=提前）
function dayDiff(expectedAt: string | null, completedAt: string | null): number | null {
  if (!expectedAt || !completedAt) return null;
  const e = new Date(expectedAt);
  const c = new Date(completedAt);
  e.setHours(0, 0, 0, 0);
  c.setHours(0, 0, 0, 0);
  return Math.round((c.getTime() - e.getTime()) / 86400000);
}

export default function TicketNodes({
  ticketId,
  nodes,
  canUpdate,
  materialsCount = 0,
}: {
  ticketId: string;
  nodes: Node[];
  canUpdate: boolean;
  materialsCount?: number;
}) {
  const router = useRouter();
  const [confirmNode, setConfirmNode] = useState<Node | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = new Date();

  async function doComplete(node: Node, note: string) {
    if (classifyNode(node.name) === "CONTENT" && !/^https?:\/\/\S+$/i.test(note.trim())) {
      setError("内容发布必须填写有效的发布链接（以 http:// 或 https:// 开头）");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tickets/${ticketId}/nodes/${node.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "操作失败");
      return;
    }
    setConfirmNode(null);
    router.refresh();
  }

  async function setDependsOn(node: Node, dependsOnId: string | null) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tickets/${ticketId}/nodes/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dependsOnId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "操作失败");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-0">
      {nodes.map((n, i) => {
        const overdue = !n.completedAt && n.expectedAt && new Date(n.expectedAt) < now;
        const kind = classifyNode(n.name);
        const hint = NODE_RULE_HINT[kind];
        // 数据回收节点：无素材时不可点
        const dataBlocked = kind === "DATA" && materialsCount === 0;
        // 寄品节点：仓库发货自动完成，不显示手动按钮
        const autoNode = kind === "SHIP";
        // 前置依赖未完成：禁用标记完成
        const depBlocked = !!n.dependsOn && !n.dependsOn.completedAt;
        // 时间偏差
        const diff = dayDiff(n.expectedAt, n.completedAt);
        // 可选的前置节点：同工单其他未完成节点（排除自己）
        const depOptions = nodes.filter((x) => x.id !== n.id && !x.completedAt);

        return (
          <div key={n.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  n.completedAt ? "bg-green-500 text-white" : overdue ? "bg-red-500 text-white" : "bg-gray-300 text-muted-foreground"
                }`}
              >
                {n.completedAt ? "✓" : i + 1}
              </div>
              {i < nodes.length - 1 && <div className="w-0.5 flex-1 bg-gray-200" />}
            </div>
            <div className={`flex-1 pb-5 ${overdue ? "rounded border border-red-300 bg-red-50 p-2" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{n.name}</span>
                <div className="flex items-center gap-2">
                  {diff !== null && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        diff <= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                      title={`计划 ${formatDate(n.expectedAt)}，实际 ${formatDate(n.completedAt)}`}
                    >
                      {diff === 0 ? "按时完成" : diff < 0 ? `提前 ${-diff} 天` : `延迟 ${diff} 天`}
                    </span>
                  )}
                  {overdue && <span className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">已超时</span>}
                  {n.completedAt && <span className="text-xs text-green-600">已完成</span>}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                预期：{formatDate(n.expectedAt)}
                {n.completedAt && (
                  <> · 完成于 {formatDateTime(n.completedAt)}{n.completedBy ? `（${n.completedBy.name}）` : ""}</>
                )}
                {n.dependsOn && (
                  <> · 前置：{n.dependsOn.name}{n.dependsOn.completedAt ? "（已完成）" : "（未完成）"}</>
                )}
              </div>
              {!n.completedAt && hint && (
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              )}
              {!n.completedAt && canUpdate && (
                <div className="mt-1 flex items-center gap-2">
                  <select
                    value={n.dependsOnId ?? ""}
                    onChange={(e) => setDependsOn(n, e.target.value || null)}
                    disabled={busy}
                    className="rounded-lg border border-input px-1 py-0.5 text-xs transition-colors focus:border-primary focus:outline-none"
                    title="设置前置节点：前置完成后才能完成本节点"
                  >
                    <option value="">无前置</option>
                    {depOptions.map((x) => (
                      <option key={x.id} value={x.id}>前置：{x.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {!n.completedAt && canUpdate && !autoNode && (
                <button
                  className={`mt-1 rounded border px-2 py-0.5 text-xs ${
                    dataBlocked || depBlocked
                      ? "cursor-not-allowed border-input text-muted-foreground"
                      : "border-green-500 text-green-600 hover:bg-green-50"
                  }`}
                  disabled={dataBlocked || depBlocked}
                  title={depBlocked ? `需先完成：${n.dependsOn!.name}` : dataBlocked ? "需先上传回收素材" : undefined}
                  onClick={() => { setError(""); setConfirmNode(n); }}
                >
                  {depBlocked ? `需先完成：${n.dependsOn!.name}` : dataBlocked ? "需先上传素材" : "标记完成"}
                </button>
              )}
              {!n.completedAt && autoNode && (
                <p className="mt-1 text-xs text-blue-600">待仓库发货后自动完成</p>
              )}
            </div>
          </div>
        );
      })}
      {nodes.length === 0 && <p className="text-sm text-muted-foreground">暂无进度节点</p>}

      {confirmNode && (() => {
        const kind = classifyNode(confirmNode.name);
        const needNote = kind === "EXEC" || kind === "CONTENT";
        const noteLabel = kind === "EXEC" ? "执行信息" : kind === "CONTENT" ? "发布链接" : "推进说明";
        return (
          <ConfirmDialog
            title={`完成节点「${confirmNode.name}」`}
            message={`确认将该节点标记为完成吗？${needNote ? "（推进信息必填）" : ""}`}
            needReason
            reasonLabel={noteLabel}
            reasonOptional={!needNote}
            reasonPlaceholder={kind === "EXEC" ? "如：已完成拍摄，成片X条" : kind === "CONTENT" ? "https://平台.example.com/作品链接" : "选填"}
            confirmText="确认完成"
            busy={busy}
            onClose={() => { setConfirmNode(null); setError(""); }}
            onConfirm={(note) => doComplete(confirmNode, note)}
          />
        );
      })()}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
