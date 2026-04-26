import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/organisms/AppHeader";
import { TermsGate } from "@/components/organisms/TermsGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "contractact-u-ally — Know what you signed",
  description:
    "Upload your employment contract and get a plain-language report in your own language within 60 seconds, with every illegal clause flagged against the exact Dutch or Swedish law it violates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TermsGate>
          <AppHeader />
          <main className="flex flex-1 flex-col">{children}</main>
        </TermsGate>
      </body>
    </html>
  );
}
