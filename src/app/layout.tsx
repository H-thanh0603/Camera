import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/state/store";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { SearchOverlay } from "@/components/search/search-overlay";
import { Toaster } from "@/components/ui/toaster";

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
  return (
    <html lang="vi" className={`dark ${syne.variable} ${hanken.variable} ${jetbrains.variable}`}>
      <head>
        {/* display=block cho icon font: tránh flash text ligature gây layout shift (CLS) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
      </head>
      <body className="bg-background font-body-md text-on-surface antialiased">
        <StoreProvider>
          <Header />
          <main id="main" className="w-full bg-background pt-20">
            {children}
          </main>
          <Footer />
          <CartDrawer />
          <SearchOverlay />
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
