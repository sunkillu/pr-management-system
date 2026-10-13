import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import ImportClient from "@/components/ImportClient";

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };

  if (me?.role !== "ADMIN") {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-lg font-medium">无权限</p>
          <p className="mt-2 text-sm text-muted-foreground">数据导入仅管理员可访问。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="数据导入" desc="CSV 导入达人库与历史合作记录：上传 → 预览 → 确认导入" />
      <ImportClient />
    </div>
  );
}
