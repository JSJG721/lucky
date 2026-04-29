import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Lucky 5/28',
  description: 'Easy Lottery App',
  manifest: '/manifest.json', // 위에서 만든 파일 연결
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0', // 확대 방지 (앱 느낌 강조)
  themeColor: '#eab308',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
