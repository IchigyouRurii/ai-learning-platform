import type { Metadata } from "next";
import "@/shared/ui/styles.css";

export const metadata: Metadata = {
  title: { default: "小课 · AI 互动学习", template: "%s · 小课" },
  description: "为教师与学习者设计的 AI 微课程工作空间。",
};
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
