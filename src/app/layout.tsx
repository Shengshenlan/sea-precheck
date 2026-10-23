import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { THEME_SCRIPT } from "@/components/site/ThemeToggle";

export const metadata: Metadata = {
  title: { default: "出海合规雷达 · 东南亚跨境上架前合规预检", template: "%s · 出海合规雷达" },
  description: "东南亚跨境电商上架前合规预检：输入商品标题或上传包装图，查看泰国、菲律宾、马来西亚需要的认证、平台禁限售、展示义务和品牌词风险。每条结论附官方原文链接。非法律意见。",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8f9fc" }, { media: "(prefers-color-scheme: dark)", color: "#14161f" }] };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
