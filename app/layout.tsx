import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "PR媒体管理系统",
  description: "电商公司公关 / 媒体管理系统",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as
    | { name?: string; email?: string; role?: "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" }
    | undefined;

  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar
              userName={user.name ?? ""}
              email={user.email ?? ""}
              role={user.role ?? "VIEWER"}
            />
            <main className="flex-1 min-w-0 p-6">{children}</main>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
