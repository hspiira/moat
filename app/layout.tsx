import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uganda Finance App",
  description: "Uganda-first personal finance app scaffold",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
