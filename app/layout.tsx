import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import NotificationToast from "@/components/NotificationToast";
import ScrollToAnchor from "@/components/ScrollToAnchor";

export const metadata = {
  title: "PR媒体管理系统",
  description: "电商公司公关 / 媒体管理系统",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as
    | { name?: string; email?: string; role?: "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" }
    | undefined;

  return (
    <html lang="zh-CN">
      <body className="bg-[#f5f5f7] text-gray-900 antialiased">
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar
              userName={user.name ?? ""}
              email={user.email ?? ""}
              role={user.role ?? "VIEWER"}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center justify-end border-b border-[#e5e5e5] bg-white px-6 py-2">
                <NotificationBell />
              </header>
              <main className="flex-1 min-w-0 p-8">{children}</main>
            </div>
            <NotificationToast />
            <ScrollToAnchor />
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
