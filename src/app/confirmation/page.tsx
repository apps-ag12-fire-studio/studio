
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Home, User, Briefcase, Award, MessageSquareText } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfirmationDetails {
  processId: string | null;
  buyerName: string | null;
  internalName: string | null;
  playerName: string | null;
  contractObjectName: string | null;
}

export default function ConfirmationPage() {
  const [details, setDetails] = useState<ConfirmationDetails | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const detailsString = localStorage.getItem('contratoFacilConfirmationDetails');
      if (detailsString) {
        try {
          const parsedDetails = JSON.parse(detailsString);
          setDetails(parsedDetails);
          localStorage.removeItem('contratoFacilConfirmationDetails'); // Clean up after reading
        } catch (error) {
          console.error("Error parsing confirmation details from localStorage:", error);
          localStorage.removeItem('contratoFacilConfirmationDetails');
        }
      }
    }
  }, []);

  const handleShareViaWhatsApp = () => {
    if (!details) return;

    const { processId, buyerName, internalName, playerName, contractObjectName } = details;
    
    let message = `🎉 Contrato Fácil: Processo Concluído! 🎉\n\n`;
    if (processId) {
      message += `*ID do Processo:* ${processId}\n`;
    }
    if (contractObjectName) {
      message += `*Contrato:* ${contractObjectName}\n`;
    }
    if (buyerName) {
      message += `*Comprador:* ${buyerName}\n`;
    }
    if (playerName) {
      message += `*Player/Expert:* ${playerName}\n`;
    }
    if (internalName) {
      message += `*Responsável Interno:* ${internalName}\n`;
    }
    message += `\nDocumentos submetidos com sucesso através da plataforma Contrato Fácil!`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };


  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-background p-6 selection:bg-primary/20">
      <Card className="w-full max-w-lg shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="items-center pt-10">
          <CheckCircle2 className="h-24 w-24 text-green-400 animate-pulse" />
          <CardTitle className="mt-8 text-4xl font-headline text-primary text-center text-glow-gold">
            Envio Concluído!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-10 space-y-6 px-8">
          <CardDescription className="text-lg text-foreground/80">
            Seu contrato e documentos foram submetidos com sucesso.
          </CardDescription>
          
          {details && (
            <div className="text-left text-sm text-foreground/70 bg-muted/20 p-4 rounded-lg border border-border/30 space-y-2">
              {details.processId && <p><strong>ID do Processo:</strong> {details.processId}</p>}
              {details.contractObjectName && <p><strong>Objeto do Contrato:</strong> {details.contractObjectName}</p>}
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-primary/80" />
                <p><strong>Comprador:</strong> {details.buyerName || "N/A"}</p>
              </div>
              <div className="flex items-center">
                <Award className="mr-2 h-4 w-4 text-primary/80" />
                <p><strong>Player/Expert:</strong> {details.playerName || "N/A"}</p>
              </div>
              <div className="flex items-center">
                <Briefcase className="mr-2 h-4 w-4 text-primary/80" />
                <p><strong>Responsável Interno:</strong> {details.internalName || "N/A"}</p>
              </div>
            </div>
          )}

          <p className="text-base text-muted-foreground">
            Obrigado por utilizar nossa plataforma exclusiva.
          </p>
          <div className="flex flex-col space-y-4 pt-4">
            <Button asChild className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-5 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
              <Link href="/">
                <Home className="mr-2 h-6 w-6" />
                Iniciar Novo Processo
              </Link>
            </Button>
            {details && (
              <Button 
                onClick={handleShareViaWhatsApp}
                variant="outline" 
                className="w-full border-green-500/70 text-green-400 hover:bg-green-500/10 hover:text-green-300 text-lg py-5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
              >
                <MessageSquareText className="mr-2 h-6 w-6" /> {/* Using MessageSquareText as a WhatsApp-like icon */}
                Compartilhar via WhatsApp
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

