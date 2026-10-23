"use client";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({ value, onChange, options, className, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; label: string;
}) {
  return (
    <ToggleGroup.Root type="single" aria-label={label} value={value} onValueChange={(v) => v && onChange(v as T)}
      className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1", className)}>
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-all hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
