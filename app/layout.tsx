import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import type { Metadata } from "next";
import { bodyFont, displayFont } from "./fonts";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL("https://kantioo.local"),
  title: {
    default: "Kantioo | Materiaux BTP au Cameroun",
    template: "%s | Kantioo",
  },
  description:
    "Marketplace BTP pour sourcer des materiaux, comparer des fournisseurs et commander rapidement a Douala et Yaoundé.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="bg-background text-foreground antialiased">
        {/* Hotjar Tracking Code */}
        <Script id="hotjar">
          {`
            (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:6682443,hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(232,101,10,0.16),_transparent_32%),radial-gradient(circle_at_80%_10%,_rgba(21,128,61,0.12),_transparent_26%),linear-gradient(180deg,_#fffdf9_0%,_#f6f3ed_52%,_#f8f6f0_100%)]" />
        <div className="fixed inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(180deg,_rgba(255,255,255,0.82),_transparent)]" />
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
