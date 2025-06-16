"use client";

import Link from "next/link";
import { CheckCircle2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfirmationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 selection:bg-accent/30">
      <Card className="w-full max-w-md shadow-xl rounded-xl">
        <CardHeader className="items-center pt-8">
          <CheckCircle2 className="h-20 w-20 text-green-500" /> {/* Using direct color for status */}
          <CardTitle className="mt-6 text-3xl font-headline text-primary text-center">Envio Concluído!</CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-8 space-y-3">
          <CardDescription className="text-lg text-muted-foreground">
            Seu contrato e documentos foram enviados com sucesso.
          </CardDescription>
          <p className="text-base text-muted-foreground">
            Obrigado por utilizar o Contrato Fácil.
          </p>
          <Button asChild className="mt-8 w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-3 rounded-lg">
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Enviar Novo Contrato
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
