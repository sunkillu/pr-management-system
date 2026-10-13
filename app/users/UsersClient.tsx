"use client";
import { useState } from "react";
import UserForm, { UserInput } from "@/components/UserForm";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

export default function UsersClient({
  selfId,
  editTarget,
  deleteId,
}: {
  selfId?: string;
  editTarget?: UserInput & { id: string };
  deleteId?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  if (!editTarget && !deleteId) {
    return (
      <>
        <button className={btnPrimary} onClick={() => setShowCreate(true)}>
          新增用户
        </button>
        {showCreate && <UserForm onClose={() => setShowCreate(false)} />}
      </>
    );
  }

  const isSelf = editTarget?.id === selfId || deleteId === selfId;

  return (
    <span className="space-x-3">
      {editTarget && (
        <>
          <button onClick={() => setShowEdit(true)} className="text-sm text-primary hover:underline">
            编辑
          </button>
          {showEdit && <UserForm initial={editTarget} onClose={() => setShowEdit(false)} />}
        </>
      )}
      {deleteId && !isSelf && <DeleteButton url={`/api/users/${deleteId}`} />}
      {deleteId && isSelf && <span className="text-xs text-muted-foreground">不能删除自己</span>}
    </span>
  );
}
