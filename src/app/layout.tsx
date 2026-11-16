import type { Metadata, Viewport } from "next";
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

/**
 * Canonical origin: not yet assigned. Rillio is pre-launch, so the metadata
 * deliberately carries no absolute canonical (inventing one would point
 * crawlers at a host this product does not yet serve) and is noindex.
 * Flip `robots` and add `metadataBase` on launch day.
 */
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
    "budgeting app",
    "AI AZIMARA",
    "financial progress",
  ],
  authors: [{ name: "AI AZIMARA", url: "https://aiazimara.com/" }],
  creator: "AI AZIMARA",
  publisher: "AI AZIMARA",
  applicationName: "Rillio",
  referrer: "strict-origin-when-cross-origin",
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
    locale: "en_AE",
    alternateLocale: ["en_US", "en_GB"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rillio — Small habits. Stronger financial futures.",
    description:
      "The financial progress app connecting spending insight, savings goals and onchain ownership.",
  },
  robots: { index: false, follow: false },
  other: {
    "geo.region": "AE-DU",
    "geo.placename": "Dubai — Dubai International Financial Centre, Sheikh Zayed Road",
    "geo.position": "25.2138;55.2773",
    "geo.country": "AE",
    ICBM: "25.2138, 55.2773",
    "content-language": "en",
    "article:modified_time": "2026-11-16",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://aiazimara.com/#organization",
                  name: "AI AZIMARA",
                  url: "https://aiazimara.com/",
                  description:
                    "AI AZIMARA builds agentic distributed systems, AI platforms, cybersecurity technology and applied research from the Dubai International Financial Centre, UAE.",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: "Dubai",
                    addressRegion: "Dubai",
                    addressCountry: "AE",
                    streetAddress: "Dubai International Financial Centre, Sheikh Zayed Road",
                  },
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Rillio",
                  applicationCategory: "FinanceApplication",
                  operatingSystem: "web",
                  description:
                    "Small habits, stronger financial futures. Real transaction import, deterministic cash-flow insight, honest savings planning, and read-only Solana portfolio visibility by AI AZIMARA. In development.",
                  creator: { "@id": "https://aiazimara.com/#organization" },
                  publisher: { "@id": "https://aiazimara.com/#organization" },
                },
              ],
            }),
          }}
        />
      </head>
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
              description:
                "!text-slate-300",
            },
          }}
        />
      </body>
    </html>
  );
}
