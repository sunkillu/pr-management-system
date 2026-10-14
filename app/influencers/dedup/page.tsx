import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DedupClient from "@/components/DedupClient";

export default async function DedupPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !["ADMIN", "PR_MANAGER"].includes(role)) redirect("/");

  const logs = await prisma.influencerSubmitLog.findMany({
    where: { result: "PENDING" },
    include: {
      newInfluencer: { include: { registeredBy: { select: { name: true } } } },
      existingInfluencer: { include: { registeredBy: { select: { name: true } } } },
      submittedBy: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const data = logs.map((l) => ({
    id: l.id,
    submittedAt: l.submittedAt.toISOString(),
    submittedBy: l.submittedBy.name,
    new: {
      id: l.newInfluencer.id,
      name: l.newInfluencer.name,
      influencerType: l.newInfluencer.influencerType,
      platforms: l.newInfluencer.platforms,
      contactInfo: l.newInfluencer.contactInfo,
      homepageId: l.newInfluencer.homepageId,
      douyinUrl: l.newInfluencer.douyinUrl,
      bio: l.newInfluencer.bio,
      tags: l.newInfluencer.tags,
      brands: l.newInfluencer.brands,
      registeredBy: l.newInfluencer.registeredBy.name,
    },
    existing: {
      id: l.existingInfluencer.id,
      name: l.existingInfluencer.name,
      influencerType: l.existingInfluencer.influencerType,
      platforms: l.existingInfluencer.platforms,
      contactInfo: l.existingInfluencer.contactInfo,
      homepageId: l.existingInfluencer.homepageId,
      douyinUrl: l.existingInfluencer.douyinUrl,
      bio: l.existingInfluencer.bio,
      tags: l.existingInfluencer.tags,
      brands: l.existingInfluencer.brands,
      registeredBy: l.existingInfluencer.registeredBy.name,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">达人去重处理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          新提交的达人与库存达人主页ID重复时进入此流程，请对比后三选一处理。
        </p>
      </div>
      <DedupClient initialLogs={data} />
    </div>
  );
}
