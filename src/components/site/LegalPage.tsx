import { kb } from "@/lib/core/kb";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  const date = (kb as { generated?: string }).generated ?? "";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-primary">法律</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">最近更新：{date}</p>
      <div className="legal mt-10 space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:text-muted-foreground [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground">{children}</div>
    </main>
  );
}
