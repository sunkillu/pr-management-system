import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import LedgerClient from "@/components/LedgerClient";

export default async function LedgerPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string } | undefined;
  if (!me || !["ADMIN", "PR"].includes(me.role)) redirect("/");

  return (
    <div>
      <PageHeader
        title="我的达人台账"
        desc="新增达人先入台账草稿：只填主页链接自动抓取，补充资料后确认入库 → 进入总达人库（免需求路径）"
      />
      <LedgerClient />
    </div>
  );
}
