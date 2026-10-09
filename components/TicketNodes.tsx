"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/labels";

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
}: {
  ticketId: string;
  nodes: Node[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const now = new Date();

  async function completeNode(nodeId: string) {
    setBusyId(nodeId);
    const res = await fetch(`/api/tickets/${ticketId}/nodes/${nodeId}/complete`, { method: "POST" });
    setBusyId("");
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-0">
      {nodes.map((n, i) => {
        const overdue = !n.completedAt && n.expectedAt && new Date(n.expectedAt) < now;
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
              {!n.completedAt && canUpdate && (
                <button
                  className="mt-1 rounded border border-green-500 px-2 py-0.5 text-xs text-green-600 hover:bg-green-50"
                  disabled={busyId === n.id}
                  onClick={() => completeNode(n.id)}
                >
                  {busyId === n.id ? "提交中…" : "标记完成"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {nodes.length === 0 && <p className="text-sm text-gray-400">暂无进度节点</p>}
    </div>
  );
}
