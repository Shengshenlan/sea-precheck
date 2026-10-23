"use client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthCard } from "@/components/app/AuthCard";
import { Workspace } from "@/components/app/Workspace";

export default function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid min-h-[60dvh] place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  return user ? <Workspace /> : <AuthCard />;
}
