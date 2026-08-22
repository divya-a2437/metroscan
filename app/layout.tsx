import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "METROSCAN — Legal Metrology Compliance & Inspection System",
  description:
    "AI-assisted compliance screening and inspection-support prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}