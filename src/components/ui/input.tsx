import * as React from "react";
import { cn } from "@/lib/utils";
const base = "w-full rounded-lg border bg-card px-3 text-[15px] shadow-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-60";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(base, "h-10", className)} {...p} />);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(base, "py-2 leading-relaxed", className)} {...p} />);
Textarea.displayName = "Textarea";
export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn("mb-1.5 block text-[13px] font-medium", className)} {...p} />;
