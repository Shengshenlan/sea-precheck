"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
export const THEME_SCRIPT = `try{var t=localStorage.getItem("radar_theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
export function ThemeToggle() {
  const flip = () => {
    const d = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("radar_theme", d ? "dark" : "light"); } catch {}
  };
  return (
    <Button variant="ghost" size="icon" onClick={flip} aria-label="切换深色/浅色">
      <Sun className="hidden dark:block" /><Moon className="dark:hidden" />
    </Button>
  );
}
