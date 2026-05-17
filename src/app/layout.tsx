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
  metadataBase: new URL("https://fileaway.app"),
  title: {
    default: "fileaway — save what matters",
    template: "%s · fileaway",
  },
  description:
    "Paste any TikTok, Instagram, YouTube or X link. fileaway reads it and files it away as structured, useful data.",
  applicationName: "fileaway",
  authors: [{ name: "fileaway" }],
  keywords: ["bookmarking", "social media", "AI", "TikTok", "Instagram", "save links"],
  openGraph: {
    type: "website",
    siteName: "fileaway",
    title: "fileaway — save what matters",
    description: "AI files social media links into useful, indexed data.",
    url: "https://fileaway.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "fileaway — save what matters",
    description: "AI files social media links into useful, indexed data.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
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
