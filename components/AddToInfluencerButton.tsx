"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

// 合作需求审批通过后：一键将本次需求的达人加入达人库（预填达人类型与平台）。
export default function AddToInfluencerButton({
  influencerType,
  platforms,
}: {
  influencerType: string | null;
  platforms: string[];
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  function go() {
    const params = new URLSearchParams();
    params.set("prefill", "1");
    if (influencerType) params.set("ptype", influencerType);
    if (platforms.length > 0) params.set("pplatforms", platforms.join(","));
    setConfirm(false);
    router.push(`/partners?tab=influencer&${params.toString()}`);
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setConfirm(true)}>
        一键加入达人库
      </button>
      {confirm && (
        <ConfirmDialog
          title="加入达人库"
          message={`是否将本次需求的达人加入达人库？${influencerType ? `（类型：${influencerType}）` : ""}跳转后补填资料并上传至少一张参考图即可免审加入。`}
          confirmText="去加入"
          onClose={() => setConfirm(false)}
          onConfirm={go}
        />
      )}
    </>
  );
}
