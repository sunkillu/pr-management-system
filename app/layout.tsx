import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import NotificationToast from "@/components/NotificationToast";
import ScrollToAnchor from "@/components/ScrollToAnchor";

export const metadata = {
  title: "PR媒体管理系统",
  description: "电商公司公关 / 媒体管理系统",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as
    | { name?: string; email?: string; role?: "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE" }
    | undefined;

  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">
        {user ? (
          <div className="flex min-h-screen">
            <Sidebar role={user.role ?? "VIEWER"} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar userName={user.name ?? ""} role={user.role ?? "VIEWER"} />
              <main className="min-w-0 flex-1 p-6">{children}</main>
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
