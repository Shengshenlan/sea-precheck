import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "东南亚跨境上架前合规预检 · 泰国/菲律宾/马来西亚",
  description: "免费的上架前自查工具：输入商品标题，查看泰国、菲律宾、马来西亚需要的认证、平台禁限售、展示义务和品牌词风险。每条结论附官方原文链接。非法律意见。",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
