"use client";
import { useState } from "react";
import ContentForm, { ContentInput } from "@/components/ContentForm";
import ContentActions from "@/components/ContentActions";
import DeleteButton from "@/components/DeleteButton";
import { Button } from "@/components/ui/button";

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
        <Button onClick={() => setShowCreate(true)}>新建内容</Button>
        {showCreate && <ContentForm outlets={outlets} onClose={() => setShowCreate(false)} />}
      </>
    );
  }

  // 行内操作
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
      {row.editTarget && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
            编辑
          </Button>
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
