import type { Metadata } from "next";
import { DemoReport } from "@/components/app/DemoReport";

export const metadata: Metadata = {
  title: "示例报告",
  description: "出海合规雷达示例报告：真实检查结果的静态快照，无需登录即可查看结论、需要办理的证书、下一步和官方来源链接。",
};

export default function Page() { return <DemoReport />; }
