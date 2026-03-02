import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Peak Manager | 円命堂",
  description: "円命堂 予約管理システム",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#060910",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/enmeidou_180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="円命堂" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#060910" }}>
        {children}
      </body>
    </html>
  );
}