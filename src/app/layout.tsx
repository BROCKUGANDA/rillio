import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rillio — Small habits. Stronger financial futures.",
  description:
    "The financial progress app connecting spending insight, savings goals and onchain ownership. Real transaction import, deterministic cash-flow insight, honest savings planning, read-only Solana portfolio visibility.",
  keywords: [
    "personal finance",
    "cash flow",
    "savings goals",
    "Solana portfolio",
    "transaction import",
    "Rillio",
  ],
  authors: [{ name: "Rillio" }],
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/rillio-app-icon.png",
  },
  openGraph: {
    title: "Rillio — Small habits. Stronger financial futures.",
    description:
      "Connect spending, saving and ownership in one understandable experience.",
    siteName: "Rillio",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!bg-ink-800 !border !border-white/10 !text-paper-100 !rounded-xl",
              description: "!text-slate-300",
            },
          }}
        />
      </body>
    </html>
  );
}
