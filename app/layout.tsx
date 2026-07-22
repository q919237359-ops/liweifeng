import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FishManagerProvider } from "@/lib/data-context";
import { AppShell } from "@/components/AppShell";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = process.env.GITHUB_ACTIONS === "true" && repository ? `/${repository}` : "";

export const metadata: Metadata = {
  title: "鱼管家",
  description: "鱼塘喂料与库存管理",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: { icon: `${basePath}/icon-192.png`, apple: `${basePath}/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f8f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <FishManagerProvider><AppShell>{children}</AppShell></FishManagerProvider>
      </body>
    </html>
  );
}
