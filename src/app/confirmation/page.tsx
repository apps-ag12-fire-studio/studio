
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Home, User, Briefcase, Award, MessageSquareText, DollarSign, Link2, QrCode } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface ConfirmationDetails {
  processId: string | null;
  buyerName: string | null;
  internalName: string | null;
  playerName: string | null;
  contractObjectName: string | null;
  contractValue: string | null;
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
          // It's a good practice to clean up localStorage after reading the data
          // to avoid it being reused on a subsequent visit to the page.
          localStorage.removeItem('contratoFacilConfirmationDetails'); 
        } catch (error) {
          console.error("Error parsing confirmation details from localStorage:", error);
          localStorage.removeItem('contratoFacilConfirmationDetails'); 
        }
      }
    }
  }, []);

  const handleShareViaWhatsApp = () => {
    if (!details || !details.processId) return;

    const { processId, buyerName, internalName, playerName, contractObjectName, contractValue } = details;
    
    let message = `🎉 Easy Contract: Process Complete! 🎉\n\n`;
    message += `*Process ID:* ${processId}\n`;
    
    if (contractObjectName) {
      message += `*Contract:* ${contractObjectName}\n`;
    }
    if (contractValue) {
      message += `*Value:* ${contractValue}\n`;
    }
    if (buyerName) {
      message += `*Buyer:* ${buyerName}\n`;
    }
    if (playerName) {
      message += `*Player/Expert:* ${playerName}\n`;
    }
    if (internalName) {
      message += `*Internal Responsible:* ${internalName}\n`;
    }
    
    const verificationBaseUrl = "https://contratofacil.app/verify"; // Replace with your actual domain
    const verificationUrl = `${verificationBaseUrl}?id=${processId}`;
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;

    message += `\n*Validation Link:* ${verificationUrl}\n`;
    message += `*Validation QR Code:* ${qrCodeImageUrl}\n`; // WhatsApp usually unfurls image links

    message += `\nDocuments submitted successfully through the Easy Contract platform!`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };


  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-background p-6 selection:bg-primary/20">
      <Card className="w-full max-w-lg shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="items-center pt-10">
          <CheckCircle2 className="h-24 w-24 text-green-400 animate-pulse" />
          <CardTitle className="mt-8 text-4xl font-headline text-primary text-center text-glow-gold">
            Submission Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-10 space-y-6 px-8">
          <CardDescription className="text-lg text-foreground/80">
            Your contract and documents have been successfully submitted.
          </CardDescription>
          
          {details && (
            <div className="text-left text-sm text-foreground/70 bg-muted/20 p-4 rounded-lg border border-border/30 space-y-2">
              {details.processId && <p><strong>Process ID:</strong> {details.processId}</p>}
              {details.contractObjectName && <p><strong>Contract Object:</strong> {details.contractObjectName}</p>}
              {details.contractValue && (
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-4 w-4 text-primary/80" />
                  <p><strong>Contract Value:</strong> {details.contractValue}</p>
                </div>
              )}
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4 text-primary/80" />
                <p><strong>Buyer:</strong> {details.buyerName || "N/A"}</p>
              </div>
              <div className="flex items-center">
                <Award className="mr-2 h-4 w-4 text-primary/80" />
                <p><strong>Player/Expert:</strong> {details.playerName || "N/A"}</p>
              </div>
              <div className="flex items-center">
                <Briefcase className="mr-2 h-4 w-4 text-primary/80" />
                <p><strong>Internal Responsible:</strong> {details.internalName || "N/A"}</p>
              </div>
            </div>
          )}

          <p className="text-base text-muted-foreground">
            Thank you for using our exclusive platform.
          </p>
          <div className="flex flex-col space-y-4 pt-4">
            <Button asChild className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-5 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
              <Link href="/">
                <Home className="mr-2 h-6 w-6" />
                Start New Process
              </Link>
            </Button>
            {details && details.processId && (
              <Button 
                onClick={handleShareViaWhatsApp}
                variant="outline" 
                className="w-full border-green-500/70 text-green-400 hover:bg-green-500/10 hover:text-green-300 text-lg py-5 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 whitespace-normal leading-snug"
              >
                <MessageSquareText className="mr-2 h-6 w-6 flex-shrink-0" /> 
                <span className="text-center">Share via WhatsApp</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
