import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import TicketForm from "@/components/TicketForm";

// 从合作需求"发起工单"跳转而来：?influencerId=xxx&coopRequestId=yyy
// 达人自动预选（仅限库中已通过的达人），表单自动打开
export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: { influencerId?: string; makeupArtistId?: string; coopRequestId?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const userId = (session?.user as unknown as { id: string }).id;
  if (!["ADMIN", "PR", "PR_MANAGER"].includes(role)) redirect("/tickets");

  const influencers = await prisma.influencer.findMany({
    // 工单只能选择库中（已通过）的达人；PR 只能选自己登记的
    where: { status: "APPROVED", ...(role === "PR" ? { registeredById: userId } : {}) },
    select: { id: true, name: true, homepageId: true, douyinUrl: true, platforms: true },
    orderBy: { name: "asc" },
  });
  const makeupArtists = await prisma.makeupArtist.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 预选的达人必须在可选范围内（库中已通过 + 数据权限），否则忽略
  const initialInfluencerId =
    searchParams.influencerId && influencers.some((i) => i.id === searchParams.influencerId)
      ? searchParams.influencerId
      : undefined;
  // 预选的化妆师（化妆师无审批状态，直接可用）
  const initialMakeupArtistId =
    searchParams.makeupArtistId && makeupArtists.some((m) => m.id === searchParams.makeupArtistId)
      ? searchParams.makeupArtistId
      : undefined;

  return (
    <div>
      <PageHeader
        title="发起合作工单"
        action={
          <Link href="/tickets" className="text-sm text-primary hover:underline">
            ← 返回工单列表
          </Link>
        }
      />
      <TicketForm
        influencers={influencers}
        makeupArtists={makeupArtists}
        initialInfluencerId={initialInfluencerId}
        initialMakeupArtistId={initialMakeupArtistId}
        initialCoopRequestId={searchParams.coopRequestId}
        userRole={role}
        autoOpen
      />
    </div>
  );
}
