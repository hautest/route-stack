import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Stack } from "route-stack/next";
import "./globals.css";
import { TabBar, ToastProvider } from "./ui";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "커뮤니티 · Next.js",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ToastProvider>
          <Stack>{children}</Stack>
          <TabBar />
        </ToastProvider>
      </body>
    </html>
  );
}
