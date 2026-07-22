import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { PinLockProvider } from "@/lib/security/pin-lock-context";
import { PinLockGate } from "@/components/pin-lock-gate";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import { AppSelfHeal } from "@/components/app-self-heal";
import { NativeCaptureBridgeRegister } from "@/components/native-capture-bridge-register";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
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
    <html
      lang="en"
      className={cn(geist.variable, geistMono.variable, display.variable)}
      suppressHydrationWarning
    >
      <head>
        {process.env.NODE_ENV !== "production" ? (
          // Dev-only, inline so it runs even when a stale service worker has
          // poisoned the chunk graph (React never mounts in that state). A
          // production-run SW on this origin caches /_next/static/ cache-first
          // and breaks dev after code changes; this evicts it and reloads once.
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.getRegistrations().then(function(rs){
    var had = rs.length > 0;
    return Promise.all(rs.map(function(r){ return r.unregister(); })).then(function(){
      if (!("caches" in window)) return had;
      return caches.keys().then(function(keys){
        return Promise.all(keys.filter(function(k){ return k.indexOf("moat-") === 0; }).map(function(k){ return caches.delete(k); }));
      }).then(function(){ return had; });
    });
  }).then(function(had){
    if (had && !sessionStorage.getItem("moat:sw-purged")) {
      sessionStorage.setItem("moat:sw-purged", "1");
      location.reload();
    }
  }).catch(function(){});
})();`,
            }}
          />
        ) : null}
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PinLockProvider>
            <PwaRegister />
            <AppSelfHeal />
            <NativeCaptureBridgeRegister />
            <PinLockGate>{children}</PinLockGate>
          </PinLockProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
