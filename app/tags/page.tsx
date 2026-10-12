import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import TagsClient from "./TagsClient";

export default async function TagsPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };

  if (me?.role !== "ADMIN" && me?.role !== "PR") {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-lg font-medium">无权限</p>
        <p className="mt-2 text-sm text-gray-500">标签管理仅管理员和PR可访问。</p>
      </div>
    );
  }

  const categories = await prisma.tagCategory.findMany({
    include: { tags: { orderBy: [{ sort: "asc" }, { name: "asc" }] } },
    orderBy: { sort: "asc" },
  });

  return (
    <div>
      <PageHeader title="标签管理" desc="维护标签种类与标签：素材打标签、达人打标签都从这里取" />
      <TagsClient initial={categories} />
    </div>
  );
}
