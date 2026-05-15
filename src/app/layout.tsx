import type { Metadata } from "next";
import { Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "AI Hot Monitor - 热点雷达",
  description: "AI驱动的实时热点监控系统，第一时间发现AI领域重大更新",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${orbitron.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-bg-primary cyber-grid-bg">
        {children}
      </body>
    </html>
  );
}
