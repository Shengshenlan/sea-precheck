"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, LogOut, ScanSearch } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { user, quota, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const logout = () => { setOpen(false); signOut(); router.push("/"); toast("已退出登录"); };
  const initial = (user?.email[0] || "?").toUpperCase();
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-15 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="首页"><Logo /></Link>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {user && (
            <div className="relative" ref={ref}>
              <button type="button" aria-label="账号菜单" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="avatar"
                className={cn("grid size-9 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 text-sm font-semibold text-white shadow-sm ring-offset-2 ring-offset-background transition hover:brightness-110", open && "ring-2 ring-primary/40")}>
                {initial}
              </button>
              {open && (
                <div role="menu" className="absolute right-0 top-11 w-64 animate-fade-up rounded-xl border bg-card p-1.5 shadow-xl">
                  <div className="border-b px-3 pb-2.5 pt-1.5">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                    {quota && <p className="mt-0.5 text-xs text-muted-foreground">今日检查 {quota.used}/{quota.limit} 次</p>}
                  </div>
                  <div className="pt-1.5">
                    <Link role="menuitem" href="/" onClick={() => setOpen(false)} className={item}><ScanSearch className="size-4 text-muted-foreground" />新的检查</Link>
                    <Link role="menuitem" href="/history/" onClick={() => setOpen(false)} className={item}><History className="size-4 text-muted-foreground" />历史记录</Link>
                    <button role="menuitem" type="button" onClick={logout} className={cn(item, "text-red-600 dark:text-red-400")}><LogOut className="size-4" />退出登录</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
