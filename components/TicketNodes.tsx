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
};

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

        return (
          <div key={n.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  n.completedAt ? "bg-green-500 text-white" : overdue ? "bg-red-500 text-white" : "bg-gray-300 text-gray-600"
                }`}
              >
                {n.completedAt ? "✓" : i + 1}
              </div>
              {i < nodes.length - 1 && <div className="w-0.5 flex-1 bg-gray-200" />}
            </div>
            <div className={`flex-1 pb-5 ${overdue ? "rounded border border-red-300 bg-red-50 p-2" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{n.name}</span>
                {overdue && <span className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">已超时</span>}
                {n.completedAt && <span className="text-xs text-green-600">已完成</span>}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                预期：{formatDate(n.expectedAt)}
                {n.completedAt && (
                  <> · 完成于 {formatDateTime(n.completedAt)}{n.completedBy ? `（${n.completedBy.name}）` : ""}</>
                )}
              </div>
              {!n.completedAt && hint && (
                <p className="mt-1 text-xs text-gray-400">{hint}</p>
              )}
              {!n.completedAt && canUpdate && !autoNode && (
                <button
                  className={`mt-1 rounded border px-2 py-0.5 text-xs ${
                    dataBlocked
                      ? "cursor-not-allowed border-gray-300 text-gray-400"
                      : "border-green-500 text-green-600 hover:bg-green-50"
                  }`}
                  disabled={dataBlocked}
                  title={dataBlocked ? "需先上传回收素材" : undefined}
                  onClick={() => { setError(""); setConfirmNode(n); }}
                >
                  {dataBlocked ? "需先上传素材" : "标记完成"}
                </button>
              )}
              {!n.completedAt && autoNode && (
                <p className="mt-1 text-xs text-blue-600">待仓库发货后自动完成</p>
              )}
            </div>
          </div>
        );
      })}
      {nodes.length === 0 && <p className="text-sm text-gray-400">暂无进度节点</p>}

      {confirmNode && (() => {
        const kind = classifyNode(confirmNode.name);
        const needNote = kind === "EXEC" || kind === "CONTENT";
        const noteLabel = kind === "EXEC" ? "执行信息" : kind === "CONTENT" ? "内容信息" : "推进说明";
        return (
          <ConfirmDialog
            title={`完成节点「${confirmNode.name}」`}
            message={`确认将该节点标记为完成吗？${needNote ? "（推进信息必填）" : ""}`}
            needReason
            reasonLabel={noteLabel}
            reasonOptional={!needNote}
            reasonPlaceholder={kind === "EXEC" ? "如：已完成拍摄，成片X条" : kind === "CONTENT" ? "如：笔记已发布，链接…" : "选填"}
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
