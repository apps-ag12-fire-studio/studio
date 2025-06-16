
"use client";

import { useState, useEffect, ChangeEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, clearProcessState, loadPrintData } from "@/lib/process-store";
import { ArrowRight, ArrowLeft, Camera, Loader2, Sparkles, UploadCloud } from "lucide-react";

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function FotoContratoAssinadoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [signedContractPhotoFile, setSignedContractPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedState = loadProcessState();
    const printData = loadPrintData();

    if (!printData || !printData.extractedData || !printData.responsavel || !printData.internalTeamMemberInfo) {
      toast({
        title: 'Sequência Incorreta',
        description: 'Por favor, prepare o contrato para impressão antes de anexar a foto do contrato assinado.',
        variant: 'destructive',
      });
      router.replace('/processo/revisao-envio'); 
      return;
    }

    setProcessState(loadedState);
    setIsLoading(false);
  }, [router, toast]);

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSignedContractPhotoFile(file); 
      try {
        const preview = await fileToDataUri(file); 
        setProcessState(prevState => ({
          ...prevState,
          signedContractPhotoPreview: preview,
          signedContractPhotoName: file.name,
        }));
      } catch (error) {
        console.error("Error creating data URI for preview:", error);
        toast({ title: "Erro ao Carregar Imagem", description: "Não foi possível gerar a pré-visualização.", variant: "destructive"});
        setProcessState(prevState => ({
          ...prevState,
          signedContractPhotoPreview: null, 
          signedContractPhotoName: undefined,
        }));
      }
    }
  };
  
  const validateStep = () => {
    if (!processState.signedContractPhotoName || !processState.signedContractPhotoPreview) {
      toast({ title: "Foto Obrigatória", description: "Por favor, anexe a foto do contrato assinado.", variant: "destructive" });
      return false;
    }
    if (!processState.buyerInfo.nome || isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo)) {
        toast({ title: "Dados Incompletos", description: "Informações do comprador ou responsável interno estão faltando. Volte e preencha.", variant: "destructive"});
        return false;
    }
    return true;
  };

  const isInternalTeamMemberInfoEmpty = (data: StoredProcessState['internalTeamMemberInfo']): boolean => {
    if (!data) return true;
    return !data.nome && !data.cpf && !data.email && !data.telefone;
  }

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);
    try {
      console.log("Submitting final data (simulated):", { 
        ...processState,
        signedContractActualFile: signedContractPhotoFile ? signedContractPhotoFile.name : undefined 
      });
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      
      console.log("\n--- SIMULANDO ENVIO DE EMAIL FINAL ---");
      const recipients = ['financeiro@empresa.com', 'juridico@empresa.com'];
      if (processState.buyerInfo.email) {
        recipients.push(processState.buyerInfo.email);
      }
      console.log(`Destinatários: ${recipients.join(', ')}`);
      const subject = `CONTRATO FINALIZADO: ${processState.extractedData?.objetoDoContrato || 'Detalhes do Contrato'} - Comprador: ${processState.buyerInfo.nome} ${processState.selectedPlayer ? `(Player: ${processState.selectedPlayer})` : ''}`;
      console.log(`Assunto: ${subject}`);
      let emailBody = `Um processo de contrato foi finalizado e submetido com os seguintes detalhes:\n`;
      if (processState.selectedPlayer) emailBody += `Player: ${processState.selectedPlayer}\n`;
      if (processState.selectedContractTemplateName) emailBody += `Modelo do Contrato: ${processState.selectedContractTemplateName}\n`;
      emailBody += `Comprador: ${processState.buyerInfo.nome} (CPF: ${processState.buyerInfo.cpf})\n`;
      emailBody += `Objeto do Contrato: ${processState.extractedData?.objetoDoContrato || 'N/A'}\n`;
      emailBody += `Documentos Comprobatórios Anexados: ${processState.attachedDocumentNames.join(', ')}\n`;
      if(processState.signedContractPhotoName) emailBody += `Foto do Contrato Assinado Anexada: ${processState.signedContractPhotoName}\n`;
      if (!isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo)) {
        emailBody += `Processo conduzido por (Time Interno): ${processState.internalTeamMemberInfo.nome} (${processState.internalTeamMemberInfo.email || 'Email não informado'})\n`;
      }
      console.log(`Corpo do Email (resumido):\n${emailBody}`);
      console.log("--- FIM DA SIMULAÇÃO DE EMAIL FINAL ---\n");

      toast({ 
        title: "Processo Enviado com Sucesso!", 
        description: "Contrato assinado e documentos enviados (simulado). Você será redirecionado.",
        className: "bg-primary text-primary-foreground border-primary-foreground/30"
      });
      clearProcessState();
      router.push("/confirmation");

    } catch (error) {
      console.error("Final Submission Error:", error);
      toast({ title: "Erro no Envio Final", description: "Não foi possível enviar os dados. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleBack = () => {
    saveProcessState(processState); 
    router.push("/print-contract"); 
  };
  
  useEffect(() => {
    const previewUrl = processState.signedContractPhotoPreview;
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [processState.signedContractPhotoPreview]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verificando etapa do processo...</p>
      </div>
    );
  }

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
          Passo 6: Foto do Contrato Assinado
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><Camera className="mr-3 h-7 w-7" />Foto do Contrato Impresso e Assinado</CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Envie uma imagem nítida do contrato após ele ter sido impresso e devidamente assinado por todas as partes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="signed-contract-photo-input" className="mb-2 block text-sm font-medium uppercase tracking-wider text-foreground/90">Carregar foto do contrato assinado</Label>
            <Input
              id="signed-contract-photo-input"
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment" 
              onChange={handlePhotoChange}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-2.5"
              aria-describedby="signed-contract-photo-hint"
            />
            <p id="signed-contract-photo-hint" className="mt-2 text-xs text-muted-foreground">Use a câmera ou selecione um arquivo de imagem. {processState.signedContractPhotoName && `Selecionado: ${processState.signedContractPhotoName}`}</p>
          </div>
          {processState.signedContractPhotoPreview && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2 uppercase tracking-wider text-foreground/90">Pré-visualização do Contrato Assinado:</p>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/30 bg-background/50 flex items-center justify-center" data-ai-hint="signed contract">
                <Image src={processState.signedContractPhotoPreview} alt="Pré-visualização do contrato assinado" layout="fill" objectFit="contain" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><UploadCloud className="mr-3 h-7 w-7" />Finalizar Processo</CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Após anexar a foto do contrato assinado, envie o processo completo.</CardDescription>
        </CardHeader>
        <CardFooter className="p-6">
          <Button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSubmitting || !processState.signedContractPhotoName}
            className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
            {isSubmitting ? "Enviando Processo..." : "Finalizar e Enviar Processo"}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex justify-start mt-8">
        <Button 
          onClick={handleBack} 
          variant="outline"
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Impressão
        </Button>
      </div>
    </>
  );
}

    
