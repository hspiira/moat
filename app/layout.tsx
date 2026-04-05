import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Moat — Personal Finance",
  description: "Track your money, build your financial moat.",
};

/**
 * Root layout component that sets the document language, applies the Geist font CSS variable, and wraps app content with the theme provider.
 *
 * @param children - The application content to render inside the root layout.
 * @returns The top-level HTML structure with the font class on `<html>` and `children` wrapped by `ThemeProvider`.
 */
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
