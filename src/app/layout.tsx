import type { Metadata } from "next";
import localFont from "next/font/local";
import { Syne } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "fileaway.app — save what matters",
  description: "Save social media links. AI extracts the useful parts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} antialiased`}
      >
        <ConvexAuthNextjsServerProvider>
          <PostHogProvider>
            <ConvexClientProvider>
              <PostHogIdentify />
              {children}
            </ConvexClientProvider>
          </PostHogProvider>
        </ConvexAuthNextjsServerProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
