import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
export function fmtTime(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function relTime(ms: number) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "刚刚"; if (s < 3600) return `${Math.floor(s / 60)} 分钟前`; if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`; return fmtTime(ms);
}
