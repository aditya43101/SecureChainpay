import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "SecureChain Pay | Enterprise Blockchain Payments",
  description: "Secure, instant, and scalable decentralized payment infrastructure.",
  keywords: ["Blockchain", "Payments", "Crypto", "Polygon", "Fintech"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans bg-brand-dark text-white selection:bg-brand-gold/30 selection:text-brand-goldLight">
        <div className="flex-1 flex flex-col w-full">
          {children}
        </div>
        <footer className="w-full py-6 text-center text-xs text-neutral-500 border-t border-white/5 bg-black/10 backdrop-blur-sm z-50">
          <p>© {new Date().getFullYear()} SecureChain Pay. All rights reserved.</p>
          <p className="mt-1.5 text-neutral-600 font-medium">Developed by Aditya Singh</p>
        </footer>
      </body>
    </html>
  );
}
