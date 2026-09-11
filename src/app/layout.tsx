import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/state/store";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { SearchOverlay } from "@/components/search/search-overlay";
import { Toaster } from "@/components/ui/toaster";
import { WebVitalsReporter } from "@/components/analytics/web-vitals";
import { QueryProvider } from "@/components/providers/query-provider";

const syne = Syne({ subsets: ["latin", "latin-ext"], variable: "--font-syne", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-hanken", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn"),
  title: {
    default: "LUMINA Optics — Thiết Bị Quang Học Cine & Medium Format Cao Cấp",
    template: "%s | LUMINA Optics",
  },
  description:
    "Không gian trưng bày và phân phối máy ảnh flagship, medium format, ống kính cine và phụ kiện cao cấp — kiểm chuẩn collimator, bảo hành 5 năm tận nơi.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "LUMINA Optics",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "LUMINA Optics",
        url: siteUrl,
        description:
          "Không gian trưng bày và phân phối máy ảnh flagship, medium format, ống kính cine và phụ kiện cao cấp.",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "LUMINA Optics",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "vi-VN",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/products?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return (
    <html lang="vi" className={`dark ${syne.variable} ${hanken.variable} ${jetbrains.variable}`}>
      <head>
        {/* Pre-paint theme: đọc localStorage trước khi render — chống flash sai theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem("lumina.theme")||'"dark"');if(t!=="light")t="dark";document.documentElement.classList.toggle("light",t==="light");document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`,
          }}
        />
        {/* display=block cho icon font: tránh flash text ligature gây layout shift (CLS).
            2 warning next/font không áp dụng: đây là icon font trong App Router. */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g, "\u003c") }}
        />
      </head>
      <body className="bg-background font-body-md text-on-surface antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-black focus:outline-none"
        >
          Bỏ qua tới nội dung chính
        </a>
        <StoreProvider>
          <QueryProvider>
          <Header />
          <main id="main" className="w-full bg-background pt-20 lg:pt-[125px]">
            {children}
          </main>
          <Footer />
          <CartDrawer />
          <SearchOverlay />
          <Toaster />
          <WebVitalsReporter />
          </QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
