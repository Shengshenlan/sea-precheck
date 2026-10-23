import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/site/Logo";
import { Camera, History, Sparkles } from "lucide-react";
export const metadata = { title: "登录 / 注册" };
export default function LoginPage() {
  return (
    <main className="relative mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2 md:items-center md:py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div className="hidden md:block">
        <Logo />
        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight">登录后，<br /><span className="text-gradient">让 AI 帮你读懂商品</span></h1>
        <ul className="mt-6 space-y-4 text-sm">
          {[[Sparkles, "AI 补充分析", "读出标题里隐含的蓝牙、电池、儿童适用等信息，补全需要的认证"], [Camera, "图片识别", "上传包装图，识别 TISI / SIRIM / ICC 等标志、品牌词和标签语言"], [History, "历史记录", "自动保存每次 AI 预检结果（不含图片），随时回看或删除"]].map(([I, t, d]) => {
            const Icon = I as typeof Sparkles;
            return <li key={t as string} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Icon className="size-4" /></span><div><p className="font-medium">{t as string}</p><p className="text-muted-foreground">{d as string}</p></div></li>;
          })}
        </ul>
        <p className="mt-8 text-xs text-muted-foreground">免费使用 · 每天 20 次 AI 分析 · 不需要邮箱验证</p>
      </div>
      <LoginForm />
    </main>
  );
}
