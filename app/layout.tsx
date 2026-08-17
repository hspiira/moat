import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { PinLockProvider } from "@/lib/security/pin-lock-context";
import { PinLockGate } from "@/components/pin-lock-gate";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import { SyncOutboxDrain } from "@/components/sync-outbox-drain";
import { AppSelfHeal } from "@/components/app-self-heal";
import { ToastProvider } from "@/components/ui/toast";
import { NativeCaptureBridgeRegister } from "@/components/native-capture-bridge-register";

/**
 * Fonts are checked in rather than fetched from Google at build time.
 *
 * next/font/google downloads the files during `next build`, so the build
 * depends on a live third-party request. That failed in CI when the CDN
 * returned CSS pointing at font files Google had already rotated away, and it
 * would fail again on any network hiccup. These are the same latin-subset
 * variable files, self-hosted: see app/fonts/README.md.
 */
const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 900",
});

const display = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "400 700",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://moat.local"),
  title: "Moat",
  description: "Track your money, build your financial moat.",
  applicationName: "Moat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Moat",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(geist.variable, geistMono.variable, display.variable)}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <PinLockProvider>
              <PwaRegister />
              <SyncOutboxDrain />
              <AppSelfHeal />
              <NativeCaptureBridgeRegister />
              <PinLockGate>{children}</PinLockGate>
            </PinLockProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
