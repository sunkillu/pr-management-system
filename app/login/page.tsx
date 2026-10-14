"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("邮箱或密码不正确");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">PR媒体管理系统</h1>
          <p className="mt-2 text-sm text-muted-foreground">请使用公司邮箱账号登录</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none">
                密码
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "登录中…" : "登录"}
            </Button>
          </form>
          <div className="mt-6 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1">演示账号（邮箱 / 密码）：</p>
            <ul className="space-y-0.5">
              <li>管理员：admin@example.com / admin123</li>
              <li>PR负责人：pr@example.com / pr123</li>
              <li>PR：prstaff@example.com / pr123</li>
              <li>运营：operator@example.com / operator123</li>
              <li>仓库：warehouse@example.com / warehouse123</li>
              <li>财务：caiwu@example.com / caiwu123</li>
              <li>只读：viewer@example.com / viewer123</li>
            </ul>
            <p className="mt-2">⚠️ 首次登录后请立即修改密码。</p>
          </div>
      </div>
    </div>
  );
}
