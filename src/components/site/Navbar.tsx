"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { History, LogIn, LogOut, Menu, ScanSearch, X, BookOpenCheck, Gauge } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

const NAV = [
  { href: "/check/", label: "开始预检", icon: ScanSearch },
  { href: "/history/", label: "历史记录", icon: History },
  { href: "/sources/", label: "规则与来源", icon: BookOpenCheck },
];

export function Navbar() {
  const path = usePathname() || "/";
  const { user, quota, ready, signOut, enabled } = useAuth();
  const [open, setOpen] = useState(false);
  const logout = () => { signOut(); setOpen(false); toast("已退出登录。规则检查无需登录，可继续使用。"); };
  const active = (h: string) => path === h || path === h.replace(/\/$/, "");
  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-15 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="首页"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", active(n.href) && "bg-muted text-foreground font-medium")}>{n.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {enabled && ready && (user ? (
            <div className="hidden items-center gap-2 md:flex">
              {quota && <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground" title="今日 AI 分析次数"><Gauge className="size-3.5" />{quota.used}/{quota.limit}</span>}
              <span className="max-w-40 truncate text-sm text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={logout}><LogOut />退出</Button>
            </div>
          ) : (
            <Button asChild size="sm" variant="outline" className="hidden md:inline-flex"><Link href="/login/"><LogIn />登录 / 注册</Link></Button>
          ))}
          <Button asChild size="sm" variant="gradient" className="hidden sm:inline-flex"><Link href="/check/">开始预检</Link></Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="菜单">{open ? <X /> : <Menu />}</Button>
        </div>
      </div>
      {open && (
        <div className="border-t bg-background px-4 pb-4 pt-2 md:hidden animate-fade-up">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm", active(n.href) ? "bg-muted font-medium" : "text-muted-foreground")}><n.icon className="size-4" />{n.label}</Link>
          ))}
          {enabled && ready && (user ? (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="truncate">{user.email}{quota && <span className="ml-2 text-xs text-muted-foreground">今日 AI {quota.used}/{quota.limit}</span>}</span>
              <Button variant="ghost" size="sm" onClick={logout}><LogOut />退出</Button>
            </div>
          ) : (
            <Button asChild className="mt-2 w-full" variant="outline"><Link href="/login/" onClick={() => setOpen(false)}><LogIn />登录 / 注册</Link></Button>
          ))}
        </div>
      )}
    </header>
  );
}
