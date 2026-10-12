"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inputCls, btnPrimary, btnPrimarySm, btnSecondary, btnSecondarySm, Field } from "./ui";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { influencerAuthStatusLabels, procurementTaskStatusLabels } from "@/lib/labels";

type Task = {
  id: string;
  status: string;
  assignee: { id: string; name: string };
  quantity: number | null;
  influencerStatus: string | null;
  influencerName: string | null;
  priceFeedback: string | null;
  priceConfirmed: boolean;
  netdiskUploaded: boolean;
  paymentId: string | null;
  ticketId: string | null;
  note: string | null;
};

export default function ProcurementTaskActions({
  task,
  meId,
  role,
}: {
  task: Task;
  meId: string;
  role: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "auth" | "price" | "payment">(null);
  const [confirm, setConfirm] = useState<null | "netdisk" | "done">(null);
  const [authStatus, setAuthStatus] = useState("");
  const [influencerName, setInfluencerName] = useState(task.influencerName ?? "");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const isOwner = task.assignee.id === meId;
  const canOp = isOwner || role === "ADMIN";
  const canConfirmPrice = ["ADMIN", "OPERATOR"].includes(role);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "操作失败");
      return null;
    }
    return data;
  }

  async function accept() {
    const d = await call(`/api/procurement/tasks/${task.id}/accept`, "POST");
    if (d) router.refresh();
  }

  async function submitAuth() {
    if (!authStatus) return setError("请选择达人状态");
    const d = await call(`/api/procurement/tasks/${task.id}`, "PATCH", {
      influencerStatus: authStatus,
      influencerName,
    });
    if (d) { setModal(null); router.refresh(); }
  }

  async function submitPrice() {
    if (!price.trim()) return setError("请填写反馈价格");
    const d = await call(`/api/procurement/tasks/${task.id}`, "PATCH", { priceFeedback: price });
    if (d) { setModal(null); router.refresh(); }
  }

  async function confirmPrice() {
    const d = await call(`/api/procurement/tasks/${task.id}`, "PATCH", { priceConfirmed: true });
    if (d) router.refresh();
  }

  async function submitPayment() {
    const d = await call(`/api/procurement/tasks/${task.id}`, "POST", { amount: Number(amount) });
    if (d) { setModal(null); router.refresh(); }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">{procurementTaskStatusLabels[task.status]}</span>

      {task.status === "PENDING" && canOp && (
        <button className={btnPrimarySm} disabled={busy} onClick={accept}>接单</button>
      )}

      {["ACCEPTED", "IN_PROGRESS"].includes(task.status) && canOp && !task.influencerStatus && (
        <button className={btnPrimarySm} disabled={busy} onClick={() => { setModal("auth"); setError(""); }}>判定达人状态</button>
      )}

      {task.influencerStatus && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{influencerAuthStatusLabels[task.influencerStatus]}</span>
      )}

      {/* 有授权 → 上传网盘 */}
      {task.influencerStatus === "AUTHORIZED" && canOp && !task.netdiskUploaded && (
        <button className={btnPrimarySm} disabled={busy} onClick={() => setConfirm("netdisk")}>标记已上传网盘</button>
      )}
      {task.netdiskUploaded && <span className="text-xs text-green-600">✓ 已上传网盘</span>}

      {/* 已合作无授权 → 生成授权打款单 */}
      {task.influencerStatus === "COOPERATED_NO_AUTH" && canOp && !task.paymentId && (
        <button className={btnPrimarySm} disabled={busy} onClick={() => { setModal("payment"); setError(""); }}>生成授权打款单</button>
      )}
      {task.paymentId && (
        <Link href={`/payments/${task.paymentId}`} className="text-xs text-[#0071e3] hover:underline">查看打款单</Link>
      )}

      {/* 无合作 → 反馈价格 → 运营确认 → 发起工单 */}
      {task.influencerStatus === "NEW" && canOp && !task.priceFeedback && (
        <button className={btnPrimarySm} disabled={busy} onClick={() => { setModal("price"); setError(""); }}>反馈价格</button>
      )}
      {task.priceFeedback && (
        <span className="text-xs text-gray-600">报价：{task.priceFeedback}
          {task.priceConfirmed ? <span className="text-green-600">（运营已确认）</span> : <span className="text-amber-600">（待运营确认）</span>}
        </span>
      )}
      {task.priceFeedback && !task.priceConfirmed && canConfirmPrice && (
        <button className={btnSecondarySm} disabled={busy} onClick={confirmPrice}>确认价格</button>
      )}
      {task.priceConfirmed && (
        <Link href="/tickets/new" className={btnPrimarySm}>去发起合作工单</Link>
      )}

      {error && <span className="w-full text-xs text-red-600">{error}</span>}

      {modal === "auth" && (
        <Modal title="判定达人状态" onClose={() => setModal(null)}>
          <Field label="达人名称">
            <input className={inputCls} value={influencerName} onChange={(e) => setInfluencerName(e.target.value)} placeholder="达人昵称" />
          </Field>
          <Field label="达人状态" required>
            <div className="flex flex-col gap-2">
              {Object.entries(influencerAuthStatusLabels).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="authStatus" checked={authStatus === k} onChange={() => setAuthStatus(k)} />
                  {v}
                  <span className="text-xs text-gray-400">
                    {k === "AUTHORIZED" ? "→ 直接上传网盘" : k === "COOPERATED_NO_AUTH" ? "→ 生成授权打款单" : "→ 反馈价格走新合作"}
                  </span>
                </label>
              ))}
            </div>
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setModal(null)}>取消</button>
            <button className={btnPrimary} disabled={busy} onClick={submitAuth}>确认</button>
          </div>
        </Modal>
      )}

      {modal === "price" && (
        <Modal title="反馈价格" onClose={() => setModal(null)}>
          <Field label="达人报价" required>
            <input className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="如：小红书图文 3000 元" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setModal(null)}>取消</button>
            <button className={btnPrimary} disabled={busy} onClick={submitPrice}>提交</button>
          </div>
        </Modal>
      )}

      {modal === "payment" && (
        <Modal title="生成授权费用打款单" onClose={() => setModal(null)}>
          <Field label="授权费用金额（元）" required>
            <input className={inputCls} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <p className="mb-3 text-xs text-gray-500">将进入正常打款审批流程（业务审批 → 财务审批）。</p>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setModal(null)}>取消</button>
            <button className={btnPrimary} disabled={busy} onClick={submitPayment}>生成</button>
          </div>
        </Modal>
      )}

      {confirm === "netdisk" && (
        <ConfirmDialog
          title="确认已上传网盘"
          message={`达人：${task.influencerName || "—"}\n确认素材已上传网盘后，任务将标记完成。`}
          confirmText="确认已上传"
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const d = await call(`/api/procurement/tasks/${task.id}`, "PATCH", { netdiskUploaded: true });
            if (d) { setConfirm(null); router.refresh(); }
          }}
        />
      )}
    </div>
  );
}
