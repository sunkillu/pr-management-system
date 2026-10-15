"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
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
    <div className="login-shell flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="login-frame grid w-full max-w-5xl overflow-hidden rounded-[28px] border bg-card shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="login-hero relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <div className="mb-12 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold ring-1 ring-white/25 backdrop-blur">PR</div>
              <div>
                <div className="text-sm font-semibold tracking-wide">PR MEDIA OS</div>
                <div className="text-xs text-white/60">合作与履约工作台</div>
              </div>
            </div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Work smarter, move faster</p>
            <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">让每一次合作，<br />都有清晰的进度。</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/70">从资源、工单到寄品、结算，在一个工作台里看清全流程，减少沟通成本，把时间留给真正重要的合作。</p>
          </div>
          <div className="relative z-10 space-y-3 text-sm text-white/80">
            {["合作资源统一沉淀", "工单状态实时追踪", "审批与履约可回溯"].map((item) => (
              <div key={item} className="flex items-center gap-2.5"><CheckCircle2 className="h-4 w-4 text-cyan-300" />{item}</div>
            ))}
          </div>
          <div className="login-orb login-orb-one" />
          <div className="login-orb login-orb-two" />
        </section>

        <section className="p-7 sm:p-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground lg:hidden">PR</div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Welcome back</p>
              <h1 className="text-3xl font-semibold tracking-tight">登录工作台</h1>
              <p className="mt-2 text-sm text-muted-foreground">请使用公司邮箱账号登录</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">邮箱地址</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 pl-10" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">密码</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 pl-10" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" />
                </div>
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} className="group h-11 w-full gap-2 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20">
                {busy ? "登录中…" : "进入工作台"}
                {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </Button>
            </form>
            <div className="mt-7 flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>首次登录后请立即修改密码。演示账号可在本地环境中使用。</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
