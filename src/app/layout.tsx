import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/organisms/AppHeader";
import { TermsGate } from "@/components/organisms/TermsGate";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
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
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <TermsGate>
          <AppHeader />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        </TermsGate>
      </body>
    </html>
  );
}
