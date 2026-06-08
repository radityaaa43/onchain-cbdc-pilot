import type { Metadata } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const sans = Fira_Sans({ subsets: ["latin"], weight: ["300","400","500","600","700"], variable: "--font-sans" });
const mono = Fira_Code({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-mono" });

export const metadata: Metadata = { title: "CBDC & Bond Platform", description: "Wholesale CBDC and digital bond operations" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`dark ${sans.variable} ${mono.variable}`}>
      <body className="bg-background text-foreground font-sans antialiased">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
