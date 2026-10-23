import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Signal Analytics Platform",
  description: "The Signal Analytics Platform is a platform for analyzing and visualizing data from the Signal app.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Signal Analytics Platform",
    description: "The Signal Analytics Platform is a platform for analyzing and visualizing data from the Signal app.",
    url: "https://signal-analytics-monoedge.vercel.app",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-clip" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
