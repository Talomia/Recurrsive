import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Recurrsive Dashboard — Software Evolution Platform",
  description:
    "AI-powered software evolution insights, opportunities, and system health monitoring.",
  metadataBase: new URL("https://recurrsive.dev"),
  openGraph: {
    title: "Recurrsive Dashboard",
    description:
      "AI-powered software evolution insights and system health monitoring.",
    type: "website",
    siteName: "Recurrsive",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="bg-base text-text-primary font-sans">
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <main id="main-content" className="flex-1 min-w-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
