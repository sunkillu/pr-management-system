"use client";
import { useState } from "react";
import CampaignForm, { CampaignInput } from "@/components/CampaignForm";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

type Opt = { id: string; title: string };
type UserOpt = { id: string; name: string };

export default function CampaignsClient({
  canWrite,
  contents,
  users,
  editTarget,
  deleteId,
}: {
  canWrite: boolean;
  contents: Opt[];
  users: UserOpt[];
  editTarget?: CampaignInput & { id: string };
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
              <CampaignForm initial={editTarget} contents={contents} users={users} onClose={() => setShowEdit(false)} />
            )}
          </>
        )}
        {deleteId && <DeleteButton url={`/api/campaigns/${deleteId}`} />}
      </span>
    );
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setShowCreate(true)}>
        新建项目
      </button>
      {showCreate && (
        <CampaignForm contents={contents} users={users} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
