import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import TicketForm from "@/components/TicketForm";

// 从合作需求"发起工单"跳转而来：?influencerId=xxx&coopRequestId=yyy
// 从采买工单"转为合作工单"跳转而来：?fromProcurement=xxx（信息预填，可编辑）
// 达人自动预选（仅限库中已通过的达人），表单自动打开
export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: { influencerId?: string; makeupArtistId?: string; coopRequestId?: string; fromProcurement?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const userId = (session?.user as unknown as { id: string }).id;
  if (!["ADMIN", "PR", "PR_MANAGER"].includes(role)) redirect("/tickets");

  const influencers = await prisma.influencer.findMany({
    // 工单只能选择库中（已通过）的达人；PR 只能选自己登记的
    where: { status: "APPROVED", ...(role === "PR" ? { registeredById: userId } : {}) },
    select: { id: true, name: true, homepageId: true },
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

  // 从采买工单转入：拉取预填信息（标题/款式/预算/备注），表单里可编辑
  let prefill: {
    sourceTicketId: string;
    sourceTicketNo: string;
    title: string;
    style: string[];
    budgetFee: string;
    note: string;
    contentDirection: string | null;
  } | undefined;
  if (searchParams.fromProcurement) {
    const st = await prisma.cooperationTicket.findUnique({
      where: { id: searchParams.fromProcurement },
      select: {
        id: true, ticketNo: true, title: true, ticketKind: true, status: true,
        style: true, budgetFee: true, note: true, quantity: true,
        materialType: true, reason: true, publishLinks: true,
      },
    });
    if (st && st.ticketKind === "PROCUREMENT" && st.status === "APPROVED") {
      const noteParts: string[] = [];
      if (st.quantity) noteParts.push(`采买数量：${st.quantity}`);
      if (st.materialType) noteParts.push(`素材类型：${st.materialType}`);
      if (st.reason) noteParts.push(`需求理由：${st.reason}`);
      const links = st.publishLinks as string[];
      if (Array.isArray(links) && links.length > 0) {
        noteParts.push(`发布链接：\n${links.map((l, i) => `${i + 1}. ${l}`).join("\n")}`);
      }
      if (st.note) noteParts.push(`原采买备注：${st.note}`);
      prefill = {
        sourceTicketId: st.id,
        sourceTicketNo: st.ticketNo,
        title: `【采买转】${st.title}`,
        style: st.style as string[],
        budgetFee: String(st.budgetFee),
        note: noteParts.join("\n"),
        contentDirection: st.materialType || null,
      };
    }
  }

  return (
    <div>
      <PageHeader
        title={prefill ? "采买转合作工单" : "发起合作工单"}
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
        initialSourceTicketId={prefill?.sourceTicketId}
        initialPrefill={prefill}
        userRole={role}
        autoOpen
      />
    </div>
  );
}
