"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Logo } from "@/components/site/Logo";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Mode = "login" | "register" | "reset";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLE: Record<Mode, [string, string]> = {
  login: ["登录", "登录后检查商品在东南亚的上架合规要求"],
  register: ["创建账号", "使用邮箱验证码注册"],
  reset: ["重置密码", "我们会向你的邮箱发送验证码"],
};

export function AuthCard() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  // email / password / code are uncontrolled and read from the DOM on submit: browser autofill and password managers can set a
  // value without firing React's change event, which left a controlled state empty (“请输入有效的邮箱地址” on a filled form).
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const [sentTo, setSentTo] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // honeypot: hidden from people, bots fill it
  const read = () => ({
    email: (emailRef.current?.value ?? "").trim(),
    password: passwordRef.current?.value ?? "",
    code: (codeRef.current?.value ?? "").trim(),
    website: websiteRef.current?.value ?? "",
  });

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const go = (m: Mode) => { setMode(m); setErr(""); setSent(false); setDevCode(""); if (passwordRef.current) passwordRef.current.value = ""; if (codeRef.current) codeRef.current.value = ""; };

  const sendCode = async () => {
    setErr("");
    const f = read();
    if (!EMAIL_RE.test(f.email)) { setErr("请输入有效的邮箱地址"); return; }
    setBusy(true);
    try {
      const { status, body } = await api.sendCode(f.email, mode === "reset" ? "reset" : "register", f.website);
      if (body.ok) {
        setSentTo(f.email); setSent(true); setCooldown(body.cooldown || 60); setDevCode(body.dev_code || "");
        toast(mode === "reset" ? "如该邮箱已注册，验证码已发送" : "验证码已发送，请查收邮件");
      } else {
        if (status === 429 && body.retry_after) setCooldown(body.retry_after);
        setErr(body.message || "发送失败，请稍后再试");
      }
    } catch { setErr("网络错误，请稍后再试"); }
    setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (mode !== "login" && !sent) { await sendCode(); return; }
    const { email, password, code, website } = read();
    if (!EMAIL_RE.test(email)) { setErr("请输入有效的邮箱地址"); return; }
    if (mode !== "login" && !/^\d{6}$/.test(code)) { setErr("请输入 6 位数字验证码"); return; }
    if (mode !== "login" && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) { setErr("密码至少 8 位，需同时包含字母和数字"); return; }
    if (!password) { setErr("请输入密码"); return; }
    setBusy(true);
    try {
      const { body } = mode === "login" ? await api.login(email, password)
        : mode === "register" ? await api.register({ email, code, password, website })
        : await api.reset({ email, code, password });
      if (body.ok) { signIn(body.token, body.user); toast(mode === "register" ? "注册成功，已登录" : mode === "reset" ? "密码已重置，已登录" : "登录成功"); }
      else setErr(body.message || "操作失败，请稍后再试");
    } catch { setErr("网络错误，请稍后再试"); }
    setBusy(false);
  };

  const [title, sub] = TITLE[mode];
  const step2 = mode !== "login" && sent;
  return (
    <div className="relative flex min-h-[calc(100dvh-3.75rem)] items-center justify-center px-4 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
      <div className="w-full max-w-[400px] animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo compact className="scale-125" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>
        </div>
        <Card className="p-6 sm:p-7">
          {!API_URL && <p role="status" data-testid="api-disabled" className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-300">服务暂未开放，登录与检查功能即将上线，请稍后再试。</p>}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" ref={emailRef} type="email" inputMode="email" autoComplete="email" placeholder="name@company.com" defaultValue=""
                disabled={step2} />
              {step2 && <button type="button" className="mt-1.5 text-xs text-primary hover:underline" onClick={() => { setSent(false); setDevCode(""); if (codeRef.current) codeRef.current.value = ""; setTimeout(() => emailRef.current?.focus(), 0); }}>更换邮箱</button>}
            </div>
            <input type="text" name="website" ref={websiteRef} tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" className="absolute left-[-9999px] h-0 w-0 opacity-0" />

            {step2 && (
              <div className="animate-fade-up">
                <Label htmlFor="code">验证码</Label>
                <div className="flex gap-2">
                  <Input id="code" name="code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 位数字" defaultValue=""
                    onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6); }} className="font-mono tracking-[0.3em]" autoFocus />
                  <Button type="button" variant="outline" className="shrink-0 tabular-nums" disabled={cooldown > 0 || busy} onClick={sendCode}>{cooldown > 0 ? `${cooldown}s 后重发` : "重新发送"}</Button>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3.5 shrink-0" />验证码已发送至 {sentTo}，10 分钟内有效；没收到请查看垃圾邮件</p>
                {devCode && <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300" data-testid="dev-code">本地开发模式：验证码 <b className="font-mono">{devCode}</b></p>}
              </div>
            )}

            {(mode === "login" || step2) && (
              <div className={cn(step2 && "animate-fade-up")}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{mode === "login" ? "密码" : mode === "reset" ? "新密码" : "设置密码"}</Label>
                  {mode === "login" && <button type="button" className="mb-1.5 text-xs text-primary hover:underline" onClick={() => go("reset")}>忘记密码？</button>}
                </div>
                <div className="relative">
                  <Input id="password" name="password" ref={passwordRef} type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? "输入密码" : "至少 8 位，含字母和数字"} defaultValue="" className="pr-10" />
                  <button type="button" aria-label={show ? "隐藏密码" : "显示密码"} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                </div>
              </div>
            )}

            {err && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
            <Button type="submit" variant="gradient" className="h-11 w-full text-[15px]" disabled={busy || (mode !== "login" && !sent && cooldown > 0)}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "login" ? "登录" : !sent ? (cooldown > 0 ? `${cooldown}s 后可重新发送` : "发送验证码") : mode === "register" ? "注册并登录" : "重置密码并登录"}
            </Button>
          </form>
          <div className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? <>还没有账号？<button type="button" className="font-medium text-primary hover:underline" onClick={() => go("register")}>注册</button></>
              : <button type="button" className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => go("login")}><ArrowLeft className="size-3.5" />返回登录</button>}
          </div>
        </Card>
        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          继续即表示同意<Link href="/terms/" className="underline-offset-2 hover:underline">服务条款</Link>与<Link href="/privacy/" className="underline-offset-2 hover:underline">隐私政策</Link>
        </p>
      </div>
    </div>
  );
}
