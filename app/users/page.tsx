import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { roleLabels, formatDate } from "@/lib/labels";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };

  // 仅管理员可访问
  if (me?.role !== "ADMIN") {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <p className="text-lg font-medium">无权限</p>
        <p className="mt-2 text-sm text-gray-500">用户管理仅管理员可访问。</p>
      </div>
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
      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>姓名</th>
              <th className={thCls}>邮箱</th>
              <th className={thCls}>角色</th>
              <th className={thCls}>创建时间</th>
              <th className={thCls}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>
                  {u.name}
                  {u.id === me.id && <span className="ml-2 text-xs text-gray-400">（我）</span>}
                </td>
                <td className={tdCls}>{u.email}</td>
                <td className={tdCls}>{roleLabels[u.role]}</td>
                <td className={tdCls}>{formatDate(u.createdAt)}</td>
                <td className={tdCls + " whitespace-nowrap"}>
                  <UsersClient
                    selfId={me.id}
                    editTarget={{ id: u.id, name: u.name, email: u.email, password: "", role: u.role, feishuUserId: u.feishuUserId ?? "" }}
                    deleteId={u.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
