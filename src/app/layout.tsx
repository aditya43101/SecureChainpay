import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased dark"
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
