import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";
export const BRAND = "出海合规雷达";
export const BRAND_EN = "SEA Compliance Radar";
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-600 via-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/30">
        <Radar className="size-[18px]" strokeWidth={2.2} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-card" />
      </span>
      {!compact && <span className="text-[15px]">{BRAND}</span>}
    </span>
  );
}
