"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const safeNext = () => { const n = new URLSearchParams(window.location.search).get("next") || "/check/"; return n.startsWith("/") && !n.startsWith("//") ? n : "/check/"; };

export function LoginForm() {
  const [tab, setTab] = useState("login");
  const { enabled, user, ready, signOut } = useAuth();
  if (!enabled) return <Card className="p-6 text-sm text-muted-foreground">本站未配置后端，登录不可用。规则预检仍可正常使用。</Card>;
  if (ready && user) return (
    <Card className="p-6"><p className="text-sm">已登录：<b>{user.email}</b></p><div className="mt-4 flex gap-2"><Button asChild variant="gradient"><a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/check/`}>去预检</a></Button><Button variant="outline" onClick={signOut}>退出登录</Button></div></Card>
  );
  return (
    <Card className="p-6 shadow-xl shadow-primary/5 sm:p-8">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="login">登录</TabsTrigger><TabsTrigger value="register">注册</TabsTrigger></TabsList>
        <TabsContent value="login"><Login /></TabsContent>
        <TabsContent value="register"><Register /></TabsContent>
      </Tabs>
      <p className="mt-6 flex items-start gap-1.5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />隐私：只保存邮箱、加盐哈希后的密码（PBKDF2）和你的预检历史（文字摘要 + 结果，不含图片）。登录凭证保存在本浏览器 localStorage，退出即清除；可在历史页删除全部记录或注销账号。
      </p>
    </Card>
  );
}

function useSubmit() {
  const { signIn } = useAuth(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const go = async (fn: () => ReturnType<typeof api.login>) => {
    setBusy(true); setErr(null);
    try {
      const { body } = await fn();
      if (body.ok) { signIn(body.token, body.user); router.push(safeNext()); return true; }
      setErr(body.message || "操作失败，请重试"); return false;
    } catch { setErr("无法连接服务器，请检查网络"); return false; } finally { setBusy(false); }
  };
  return { busy, err, go };
}

function PwInput({ id, value, onChange, auto, placeholder = "请输入密码" }: { id: string; value: string; onChange: (v: string) => void; auto: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} autoComplete={auto} required value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" maxLength={128} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "隐藏密码" : "显示密码"} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
    </div>
  );
}
const ErrBox = ({ err }: { err: string | null }) => err ? <p role="alert" className="animate-fade-up rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p> : null;

function Login() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const { busy, err, go } = useSubmit();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); go(() => api.login(email.trim(), pw)); }}>
      <div><h2 className="text-xl font-semibold">欢迎回来</h2><p className="mt-1 text-sm text-muted-foreground">登录以使用 AI 分析、图片识别和历史记录</p></div>
      <div><Label htmlFor="le">邮箱</Label><Input id="le" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="请输入邮箱" /></div>
      <div><Label htmlFor="lp">密码</Label><PwInput id="lp" value={pw} onChange={setPw} auto="current-password" /></div>
      <ErrBox err={err} />
      <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={busy}>{busy && <Loader2 className="animate-spin" />}登录</Button>
      <p className="text-center text-xs text-muted-foreground">暂不支持找回密码，请妥善保管。</p>
    </form>
  );
}

function Register() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [answer, setAnswer] = useState(""); const [hp, setHp] = useState("");
  const [chal, setChal] = useState<{ token: string; question: string } | null>(null);
  const { busy, err, go } = useSubmit();
  const loadChal = async () => { setAnswer(""); try { const { body } = await api.challenge(); if (body.ok) setChal({ token: body.token, question: body.question }); } catch { /* shown on submit */ } };
  useEffect(() => { loadChal(); }, []);
  const rules = [
    { ok: pw.length >= 8, t: "至少 8 位" }, { ok: /[a-zA-Z]/.test(pw) && /\d/.test(pw), t: "同时包含字母和数字" },
    { ok: !!pw && pw.toLowerCase() !== email.trim().toLowerCase(), t: "不能与邮箱相同" },
  ];
  const match = pw2.length > 0 && pw === pw2;
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); if (!match || !chal) return;
      const ok = await go(() => api.register({ email: email.trim(), password: pw, challenge_token: chal.token, challenge_answer: answer.trim(), website: hp }));
      if (!ok) loadChal();
    }}>
      <div><h2 className="text-xl font-semibold">创建账号</h2><p className="mt-1 text-sm text-muted-foreground">无需邮箱验证，注册即用</p></div>
      <div><Label htmlFor="re">邮箱</Label><Input id="re" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="请输入邮箱" /></div>
      <div>
        <Label htmlFor="rp">密码</Label><PwInput id="rp" value={pw} onChange={setPw} auto="new-password" placeholder="至少 8 位" />
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{rules.map((r) => <li key={r.t} className={cn("flex items-center gap-1 transition-colors", r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{r.ok ? <Check className="size-3" /> : <X className="size-3" />}{r.t}</li>)}</ul>
      </div>
      <div><Label htmlFor="rp2">确认密码</Label><PwInput id="rp2" value={pw2} onChange={setPw2} auto="new-password" placeholder="请再次输入密码" />{pw2 && !match && <p className="mt-1 text-xs text-red-600">两次输入不一致</p>}</div>
      {/* honeypot: hidden from humans, bots fill it */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} name="website" /></label></div>
      <div>
        <Label htmlFor="rc">人机验证</Label>
        <div className="flex items-center gap-2">
          <span className="flex h-10 min-w-32 items-center justify-center rounded-lg bg-muted px-3 font-mono text-[15px] font-semibold tabular-nums">{chal ? chal.question : "…"}</span>
          <Input id="rc" inputMode="numeric" required value={answer} onChange={(e) => setAnswer(e.target.value.replace(/[^\d-]/g, ""))} placeholder="答案" className="w-24" />
          <Button type="button" variant="ghost" size="icon" onClick={loadChal} aria-label="换一题"><RefreshCw /></Button>
        </div>
      </div>
      <ErrBox err={err} />
      <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={busy || !match || !rules.every((r) => r.ok) || !chal}>{busy && <Loader2 className="animate-spin" />}注册并登录</Button>
    </form>
  );
}
