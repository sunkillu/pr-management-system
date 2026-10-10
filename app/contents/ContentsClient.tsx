"use client";
import { useState } from "react";
import ContentForm, { ContentInput } from "@/components/ContentForm";
import ContentActions from "@/components/ContentActions";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

type Row = {
  id: string;
  status: string;
  isOwner: boolean;
  editTarget?: ContentInput & { id: string };
  deleteId?: string;
};

// 页头新建按钮，或表格行内操作（编辑 / 状态流转 / 删除）
export default function ContentsClient({
  role,
  outlets,
  row,
}: {
  role?: string;
  outlets: { id: string; name: string }[];
  row?: Row;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // 页头：新建按钮
  if (!row) {
    return (
      <>
        <button className={btnPrimary} onClick={() => setShowCreate(true)}>
          新建内容
        </button>
        {showCreate && <ContentForm outlets={outlets} onClose={() => setShowCreate(false)} />}
      </>
    );
  }

  // 行内操作
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {row.editTarget && (
        <>
          <button onClick={() => setShowEdit(true)} className="text-sm text-[#0071e3] hover:underline">
            编辑
          </button>
          {showEdit && (
            <ContentForm initial={row.editTarget} outlets={outlets} onClose={() => setShowEdit(false)} />
          )}
        </>
      )}
      {role && <ContentActions id={row.id} status={row.status} role={role} isOwner={row.isOwner} />}
      {row.deleteId && <DeleteButton url={`/api/contents/${row.deleteId}`} />}
    </span>
  );
}
