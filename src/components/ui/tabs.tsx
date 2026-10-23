"use client";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: T.TabsListProps) => <T.List className={cn("grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-muted p-1", className)} {...p} />;
export const TabsTrigger = ({ className, ...p }: T.TabsTriggerProps) => <T.Trigger className={cn("h-9 rounded-lg text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} {...p} />;
export const TabsContent = ({ className, ...p }: T.TabsContentProps) => <T.Content className={cn("mt-5 focus-visible:outline-none animate-fade-up", className)} {...p} />;
