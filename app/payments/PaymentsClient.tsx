"use client";
import { useState } from "react";
import PaymentForm, { PaymentInput } from "@/components/PaymentForm";
import PaymentActions from "@/components/PaymentActions";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

type Opt = { id: string; name?: string; title?: string };

// 页头新建按钮，或行内操作
export default function PaymentsClient({
  role,
  outlets,
  campaigns,
  contents,
  editTarget,
  deleteId,
  actionTarget,
}: {
  role: string;
  outlets: Opt[];
  campaigns: Opt[];
  contents: Opt[];
  editTarget?: PaymentInput & { id: string };
  deleteId?: string;
  actionTarget?: { id: string; status: string };
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (!editTarget && !deleteId && !actionTarget) {
    return (
      <>
        <button className={btnPrimary} onClick={() => setShowCreate(true)}>
          新建打款申请
        </button>
        {showCreate && (
          <PaymentForm outlets={outlets} campaigns={campaigns} contents={contents} onClose={() => setShowCreate(false)} />
        )}
      </>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {editTarget && (
        <>
          <button onClick={() => setShowEdit(true)} className="text-sm text-blue-600 hover:underline">
            编辑
          </button>
          {showEdit && (
            <PaymentForm
              initial={editTarget}
              outlets={outlets}
              campaigns={campaigns}
              contents={contents}
              onClose={() => setShowEdit(false)}
            />
          )}
        </>
      )}
      {actionTarget && <PaymentActions id={actionTarget.id} status={actionTarget.status} role={role} />}
      {deleteId && <DeleteButton url={`/api/payments/${deleteId}`} />}
    </span>
  );
}
