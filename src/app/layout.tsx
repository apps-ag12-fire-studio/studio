
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppFooter } from '@/components/layout/app-footer'; // Import the new footer component
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
  title: 'Contrato Fácil',
  description: 'Capture a foto do contrato, analise-o e anexe os documentos necessários.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body className="font-body antialiased bg-background text-foreground">
        <main className="flex-grow">
          {children}
        </main>
        <Toaster />
        <AppFooter /> {/* Use the new client component for the footer */}
      </body>
    </html>
  );
}
