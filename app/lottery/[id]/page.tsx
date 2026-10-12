import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import LotteryDetailClient from "@/components/LotteryDetailClient";

export default async function LotteryDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string } | undefined;
  if (!me?.id) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-lg font-medium">请先登录</p>
      </div>
    );
  }
  const canManage = me.role === "ADMIN" || me.role === "PR";
  return (
    <div>
      <PageHeader title="抽奖活动详情" desc="" />
      <LotteryDetailClient lotteryId={params.id} canManage={canManage} />
    </div>
  );
}
