
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
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
        <footer className="w-full py-6 text-center text-xs text-muted-foreground border-t border-border/30 print-hidden">
          <p>© {new Date().getFullYear()} Financeiro Pablo Marçal - Todos os direitos reservados.</p>
          <p className="mt-1">Uma solução SAAS com Inteligência Artificial treinada por CFO - Antônio Fogaça.</p>
        </footer>
      </body>
    </html>
  );
}
