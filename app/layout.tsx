import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { PinLockProvider } from "@/lib/security/pin-lock-context";
import { PinLockGate } from "@/components/pin-lock-gate";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import { SyncOutboxDrain } from "@/components/sync-outbox-drain";
import { DailyDriveBackup } from "@/components/daily-drive-backup";
import { AppSelfHeal } from "@/components/app-self-heal";
import { ToastProvider } from "@/components/ui/toast";
import { NativeCaptureBridgeRegister } from "@/components/native-capture-bridge-register";

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
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
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
              <DailyDriveBackup />
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
