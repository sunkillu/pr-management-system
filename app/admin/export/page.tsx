import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import ExportClient from "@/components/ExportClient";

export default async function ExportPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };

  if (me?.role !== "ADMIN") {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-lg font-medium">无权限</p>
        <p className="mt-2 text-sm text-gray-500">数据导出仅管理员可访问。</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="数据导出" desc="导出数据用于分析：选择类型与日期范围，下载 CSV" />
      <ExportClient />
    </div>
  );
}
