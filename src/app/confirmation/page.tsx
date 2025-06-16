
"use client";

import Link from "next/link";
import { CheckCircle2, Home } from "lucide-react"; // Removed Sparkles as it's not used here
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfirmationPage() {
  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-background p-6 selection:bg-primary/20">
      <Card className="w-full max-w-lg shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="items-center pt-10">
          <CheckCircle2 className="h-24 w-24 text-green-400 animate-pulse" />
          <CardTitle className="mt-8 text-4xl font-headline text-primary text-center text-glow-gold">
            Envio Concluído!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-10 space-y-4 px-8">
          <CardDescription className="text-lg text-foreground/80">
            Seu contrato e documentos foram submetidos com sucesso.
          </CardDescription>
          <p className="text-base text-muted-foreground">
            Obrigado por utilizar nossa plataforma exclusiva.
          </p>
          <Button asChild className="mt-10 w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
            <Link href="/">
              <Home className="mr-2 h-6 w-6" />
              Iniciar Novo Processo
            </Link>
          </Button>
        </CardContent>
      </Card>
      {/* Footer is now global in RootLayout */}
    </div>
  );
}
