
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FooterWrapper } from '@/components/layout/footer-wrapper';
import { Inter, Playfair_Display } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Easy Contract',
  description: 'Capture a photo of the contract, analyze it, and attach the necessary documents.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body className="font-body antialiased bg-background text-foreground" suppressHydrationWarning={true}>
        <main className="flex-grow">
          {children}
        </main>
        <Toaster />
        <FooterWrapper />
      </body>
    </html>
  );
}
