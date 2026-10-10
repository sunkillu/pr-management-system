"use client";
import { useState } from "react";
import ReportForm, { ReportInput } from "@/components/ReportForm";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

type Opt = { id: string; name?: string; title?: string };

export default function ReportsClient({
  canWrite,
  campaigns,
  contents,
  editTarget,
  deleteId,
}: {
  canWrite: boolean;
  campaigns: Opt[];
  contents: Opt[];
  editTarget?: ReportInput & { id: string };
  deleteId?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (!canWrite) return null;

  if (editTarget || deleteId) {
    return (
      <span className="space-x-3">
        {editTarget && (
          <>
            <button onClick={() => setShowEdit(true)} className="text-sm text-[#0071e3] hover:underline">
              编辑
            </button>
            {showEdit && (
              <ReportForm initial={editTarget} campaigns={campaigns} contents={contents} onClose={() => setShowEdit(false)} />
            )}
          </>
        )}
        {deleteId && <DeleteButton url={`/api/reports/${deleteId}`} />}
      </span>
    );
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setShowCreate(true)}>
        录入数据
      </button>
      {showCreate && (
        <ReportForm campaigns={campaigns} contents={contents} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
