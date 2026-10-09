"use client";
import { useState } from "react";
import OutletForm, { OutletInput } from "@/components/OutletForm";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

// 行内操作按钮 + 新建按钮。新建时只渲染按钮；编辑/删除时渲染对应操作。
export default function OutletsClient({
  canWrite,
  editTarget,
  deleteId,
}: {
  canWrite: boolean;
  editTarget?: OutletInput & { id: string };
  deleteId?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (!canWrite) return null;

  // 表格行内的编辑/删除
  if (editTarget || deleteId) {
    return (
      <span className="space-x-3">
        {editTarget && (
          <>
            <button onClick={() => setShowEdit(true)} className="text-sm text-blue-600 hover:underline">
              编辑
            </button>
            {showEdit && (
              <OutletForm initial={editTarget} onClose={() => setShowEdit(false)} />
            )}
          </>
        )}
        {deleteId && <DeleteButton url={`/api/outlets/${deleteId}`} />}
      </span>
    );
  }

  // 页头的新建按钮
  return (
    <>
      <button className={btnPrimary} onClick={() => setShowCreate(true)}>
        新增资源
      </button>
      {showCreate && <OutletForm onClose={() => setShowCreate(false)} />}
    </>
  );
}
