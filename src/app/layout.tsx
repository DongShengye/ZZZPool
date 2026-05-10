import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZzzPool",
  description: "A tiny pool for saying asleep, not ignoring you."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
