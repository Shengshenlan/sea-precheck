"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Old URLs (/check/, /login/) now live on the home page; static export has no server redirects. */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(to); }, [router, to]);
  return null;
}
