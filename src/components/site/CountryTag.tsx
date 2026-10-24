import type { Country } from "@/lib/core/types";
import { COUNTRY_ZH } from "@/lib/core/match";
import { cn } from "@/lib/utils";
import { Flag } from "./Flag";

/** One restrained hue per country (kept away from the verdict colours green / amber / red). */
export const COUNTRY_TONE: Record<Country, { tag: string; on: string }> = {
  TH: { tag: "bg-violet-50 text-violet-800 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/20", on: "border-violet-400/70 bg-violet-50 ring-violet-500/25 dark:bg-violet-500/10" },
  PH: { tag: "bg-sky-50 text-sky-800 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/20", on: "border-sky-400/70 bg-sky-50 ring-sky-500/25 dark:bg-sky-500/10" },
  MY: { tag: "bg-teal-50 text-teal-800 ring-teal-600/15 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-400/20", on: "border-teal-400/70 bg-teal-50 ring-teal-500/25 dark:bg-teal-500/10" },
};

export function CountryTag({ c, className }: { c: Country; className?: string }) {
  return (
    <span data-testid={`tag-${c}`} className={cn("inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1.5 pr-2.5 text-xs font-medium ring-1 ring-inset", COUNTRY_TONE[c].tag, className)}>
      <Flag c={c} className="h-2.5 w-3.5" />{COUNTRY_ZH[c]}
    </span>
  );
}
