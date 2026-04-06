import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { PinLockProvider } from "@/lib/security/pin-lock-context";
import { PinLockScreen } from "@/components/pin-lock-screen";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
      { url: "/icons/logo.svg", type: "image/svg+xml" },
      { url: "/icons/logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/logo.png",
    shortcut: "/icons/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
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
    <html lang="en" className={cn(geist.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PinLockProvider>
            <PinLockScreen />
            <PwaRegister />
            {children}
          </PinLockProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
