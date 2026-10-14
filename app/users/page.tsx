import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { roleLabels } from "@/lib/labels";
import UsersClient from "./UsersClient";
import RecordTimestamps from "@/components/RecordTimestamps";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };

  // 仅管理员可访问
  if (me?.role !== "ADMIN") {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-lg font-medium">无权限</p>
          <p className="mt-2 text-sm text-muted-foreground">用户管理仅管理员可访问。</p>
        </CardContent>
      </Card>
    );
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader
        title="用户管理"
        desc="管理登录账号与角色：管理员 / 运营 / 财务 / 只读"
        action={<UsersClient />}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === me.id && <span className="ml-2 text-xs text-muted-foreground">（我）</span>}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{roleLabels[u.role]}</TableCell>
                <TableCell><RecordTimestamps createdAt={u.createdAt} updatedAt={u.updatedAt} compact /></TableCell>
                <TableCell className="whitespace-nowrap">
                  <UsersClient
                    selfId={me.id}
                    editTarget={{ id: u.id, name: u.name, email: u.email, password: "", role: u.role, feishuUserId: u.feishuUserId ?? "" }}
                    deleteId={u.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
