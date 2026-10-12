"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { promotionPlatformLabels, commentRequestStatusLabels, promotionRequestStatusLabels } from "@/lib/labels";

type CommentRequest = {
  id: string; content: string; status: string;
  createdBy: { name: string }; createdAt: string;
};
type PromotionRequest = {
  id: string; platform: string; budget: unknown; plan: string; status: string;
  createdBy: { name: string }; createdAt: string;
};

const PLATFORM_OPTIONS = [
  { value: "XIAOHONGSHU_DOUPLUS", label: "小红书薯条" },
  { value: "DOUYIN_QIANCHUAN", label: "抖音千帆" },
  { value: "OTHER", label: "其他" },
];

export default function TicketPublishTrack({
  ticketId,
  canCreate,
  commentRequests,
  promotionRequests,
}: {
  ticketId: string;
  canCreate: boolean;
  commentRequests: CommentRequest[];
  promotionRequests: PromotionRequest[];
}) {
  const router = useRouter();
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [showPromoBox, setShowPromoBox] = useState(false);
  const [promoPlatform, setPromoPlatform] = useState("XIAOHONGSHU_DOUPLUS");
  const [promoBudget, setPromoBudget] = useState("");
  const [promoPlan, setPromoPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(url: string, body: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "操作失败"); return false; }
      return true;
    } finally { setBusy(false); }
  }
  const refresh = () => router.refresh();

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {canCreate && (
          <>
            <button className="rounded border border-blue-500 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
              onClick={() => { setCommentContent(""); setShowCommentBox(true); }}>+ 评论需求</button>
            <button className="rounded border border-purple-500 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
              onClick={() => { setPromoBudget(""); setPromoPlan(""); setShowPromoBox(true); }}>+ 投放需求</button>
          </>
        )}
      </div>

      {commentRequests.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-700">评论需求（{commentRequests.length}）</h4>
          <div className="space-y-2">
            {commentRequests.map((c) => (
              <div key={c.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {commentRequestStatusLabels[c.status] ?? c.status}
                  </span>
                  <span className="text-xs text-gray-400">{c.createdBy.name}</span>
                </div>
                <p className="mt-1 text-gray-700">{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {promotionRequests.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-700">投放需求（{promotionRequests.length}）</h4>
          <div className="space-y-2">
            {promotionRequests.map((p) => (
              <div key={p.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{promotionPlatformLabels[p.platform] ?? p.platform}</span>
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                    {promotionRequestStatusLabels[p.status] ?? p.status}
                  </span>
                </div>
                <p className="mt-1 text-gray-600">预算：¥{Number(p.budget).toFixed(2)}</p>
                <p className="mt-1 text-gray-700">{p.plan}</p>
                <p className="mt-1 text-xs text-gray-400">{p.createdBy.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCommentBox && (
        <Modal title="发起评论需求" onClose={() => setShowCommentBox(false)}>
          <Field label="需求内容" required>
            <textarea className={inputCls} rows={4} value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)} placeholder="如：请在评论区置顶品牌官方账号留言" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowCommentBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy}
              onClick={async () => {
                if (!commentContent.trim()) { setError("请填写需求内容"); return; }
                if (await call(`/api/tickets/${ticketId}/comment-requests`, { content: commentContent.trim() })) {
                  setShowCommentBox(false); refresh();
                }
              }}>提交</button>
          </div>
        </Modal>
      )}

      {showPromoBox && (
        <Modal title="发起投放需求" onClose={() => setShowPromoBox(false)}>
          <Field label="投放平台" required>
            <select className={inputCls} value={promoPlatform} onChange={(e) => setPromoPlatform(e.target.value)}>
              {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="投放预算（元）" required>
            <input type="number" min="0" step="0.01" className={inputCls} value={promoBudget}
              onChange={(e) => setPromoBudget(e.target.value)} placeholder="如：5000" />
          </Field>
          <Field label="投放计划" required>
            <textarea className={inputCls} rows={4} value={promoPlan}
              onChange={(e) => setPromoPlan(e.target.value)} placeholder="如：薯条加热3天，定向18-24岁女性" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowPromoBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy}
              onClick={async () => {
                if (await call(`/api/tickets/${ticketId}/promotion-requests`, {
                  platform: promoPlatform, budget: promoBudget, plan: promoPlan.trim(),
                })) { setShowPromoBox(false); refresh(); }
              }}>提交</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
