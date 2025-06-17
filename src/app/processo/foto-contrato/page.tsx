
"use client";

import { useState, useEffect, ChangeEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState } from "@/lib/process-store";
import { verifyContractPhoto, type VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import { extractContractData, type ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import { ArrowRight, ArrowLeft, Camera, Loader2, Sparkles, AlertTriangle, CheckCircle2, ScanText } from "lucide-react";

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function FotoContratoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  
  const [contractPhotoFile, setContractPhotoFile] = useState<File | null>(null);

  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
  const [isExtractingData, setIsExtractingData] = useState(false);
  const [isNavigatingNext, setIsNavigatingNext] = useState(false);
  
  const contractPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedState = loadProcessState();
    setProcessState(loadedState);

     // If a photo name exists in loaded state but no file, it means it was loaded from localStorage
     // We don't need to re-instantiate a File object from data URI here,
     // as contractPhotoFile is primarily for new uploads.
     // The preview will come from processState.contractPhotoPreview (data URI).
  }, []);


  const handleContractPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setContractPhotoFile(file); 
      try {
        const dataUri = await fileToDataUri(file); // Convert to data URI
        const newState = {
          ...processState,
          contractPhotoPreview: dataUri, // Store data URI
          contractPhotoName: file.name,
          photoVerificationResult: null,
          photoVerified: false,
          extractedData: null, 
        };
        setProcessState(newState);
        saveProcessState(newState); // Attempt to save to localStorage immediately
      } catch (error) {
        console.error("Error converting file to Data URI:", error);
        toast({ title: "Erro ao processar imagem", description: "Não foi possível carregar a imagem para pré-visualização.", variant: "destructive"});
        // Reset relevant parts of state if conversion fails
        const newState = {
            ...processState,
            contractPhotoPreview: null,
            contractPhotoName: undefined,
            photoVerificationResult: null,
            photoVerified: false,
            extractedData: null,
        };
        setProcessState(newState);
        saveProcessState(newState);
        if (contractPhotoInputRef.current) {
          contractPhotoInputRef.current.value = ""; // Clear the file input
        }
      }
    }
  };

  const handleVerifyPhoto = async () => {
    // Use processState.contractPhotoPreview (data URI) instead of relying on contractPhotoFile for verification
    if (!processState.contractPhotoPreview) {
      toast({ title: "Verificação Necessária", description: "Por favor, carregue a foto do contrato.", variant: "destructive" });
      return;
    }
    setIsVerifyingPhoto(true);
    
    try {
      // photoDataUri is already in processState.contractPhotoPreview
      const result = await verifyContractPhoto({ photoDataUri: processState.contractPhotoPreview });
      const newState = {
        ...processState,
        photoVerificationResult: result,
        photoVerified: result.isCompleteAndClear,
      };
      setProcessState(newState);
      saveProcessState(newState);

      if (result.isCompleteAndClear) {
        toast({ 
          title: "Verificação da Foto Concluída!", 
          description: "A imagem do contrato é nítida e completa.", 
          className: "bg-secondary text-secondary-foreground border-secondary" 
        });
      } else {
        toast({ title: "Falha na Verificação da Foto", description: result.reason || "A imagem do contrato não está ideal. Por favor, tente novamente.", variant: "destructive" });
      }
    } catch (error) {
      console.error("AI Verification Error:", error);
      const newState = {
        ...processState,
        photoVerificationResult: { isCompleteAndClear: false, reason: "Erro ao verificar. Tente novamente." },
        photoVerified: false,
      };
      setProcessState(newState);
      saveProcessState(newState);
      toast({ title: "Erro na Verificação", description: "Não foi possível concluir a verificação da foto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsVerifyingPhoto(false);
    }
  };

  const handleExtractContractData = async () => {
    if (processState.contractSourceType === 'new' && (!processState.contractPhotoPreview || !processState.photoVerified)) {
      toast({ title: "Ação Requerida", description: "Carregue e verifique a foto do contrato antes da análise.", variant: "destructive" });
      return;
    }
     if (processState.contractSourceType === 'new' && !processState.contractPhotoPreview) { // Check for preview (data URI)
      toast({ title: "Foto não encontrada", description: "Carregue a foto do contrato para análise.", variant: "destructive" });
      return;
    }

    setIsExtractingData(true);
    try {
      if (processState.contractSourceType === 'new' && processState.contractPhotoPreview) { // Use data URI from state
         const result = await extractContractData({ photoDataUri: processState.contractPhotoPreview });
         const newState = {
           ...processState,
           extractedData: result,
         };
         setProcessState(newState);
         saveProcessState(newState);
         toast({ 
           title: "Análise do Contrato Concluída!", 
           description: "Dados extraídos do contrato com sucesso. Prossiga para anexar os documentos do comprador.", 
           className: "bg-secondary text-secondary-foreground border-secondary" 
         });
      }
    } catch (error) {
      console.error("AI Extraction Error:", error);
      const newState = { ...processState, extractedData: null };
      setProcessState(newState); 
      saveProcessState(newState);
      toast({ title: "Erro na Análise do Contrato", description: "Não foi possível extrair os dados. Verifique a imagem ou tente novamente.", variant: "destructive" });
    } finally {
      setIsExtractingData(false);
    }
  };
  
  const validateStep = () => {
    const { contractSourceType, photoVerified, extractedData } = processState;
    
    if (contractSourceType === 'new') {
      if (!processState.contractPhotoPreview || !photoVerified || !extractedData) { 
        toast({ title: "Etapas Incompletas (Novo Contrato)", description: "Capture, verifique e analise a foto do contrato.", variant: "destructive" });
        return false;
      }
    } else { 
      if (!extractedData) {
        toast({ title: "Etapas Incompletas (Contrato Existente)", description: "Modelo de contrato não carregado. Volte para Dados Iniciais e selecione um.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setIsNavigatingNext(true);
    // State is already saved by individual actions or load, but good practice to ensure it's current before nav
    saveProcessState({ ...processState, currentStep: "/processo/documentos" });
    toast({
      title: "Etapa 2 Concluída!",
      description: "Contrato processado. Carregando próxima etapa...",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push("/processo/documentos");
  };

  const handleBack = () => {
    saveProcessState(processState); // Ensure current state (even if no new photo) is saved
    router.push("/processo/dados-iniciais");
  };

  // No need to revoke ObjectURL if we are consistently using data URIs in processState.contractPhotoPreview
  // If contractPhotoPreview was a blob URL, then revoke would be needed.
  // useEffect(() => {
  //   const previewUrl = processState.contractPhotoPreview;
  //   return () => {
  //     if (previewUrl && previewUrl.startsWith('blob:')) { 
  //       URL.revokeObjectURL(previewUrl);
  //     }
  //   };
  // }, [processState.contractPhotoPreview]);


  const shouldShowPhotoUploadAndVerify = processState.contractSourceType === 'new';
  const shouldShowAnalysisButton = processState.contractSourceType === 'new' && processState.photoVerified && !isExtractingData && !processState.extractedData;
  const shouldShowReAnalysisButton = processState.contractSourceType === 'new' && processState.photoVerified && !isExtractingData && !!processState.extractedData;

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-1 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mb-4 text-sm text-foreground/80">
          Financeiro Plataforma Internacional - Solução SAAS com Inteligência Artificial em treinamento por Antônio Fogaça.
        </p>
        <p className="text-xl text-muted-foreground font-headline">
          Passo 2: Foto do Contrato Principal
        </p>
      </header>

      {shouldShowPhotoUploadAndVerify && (
        <>
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center text-2xl font-headline text-primary"><Camera className="mr-3 h-7 w-7" />Foto do Contrato Principal</CardTitle>
              <CardDescription className="text-foreground/70 pt-1">Envie uma imagem nítida e completa do contrato que será analisado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-0">
              <div>
                <Label htmlFor="contract-photo-input" className="mb-2 block text-sm font-medium uppercase tracking-wider text-foreground/90">Carregar foto do contrato</Label>
                <Input
                  id="contract-photo-input"
                  ref={contractPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleContractPhotoChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-2.5"
                  aria-describedby="contract-photo-hint"
                />
                <p id="contract-photo-hint" className="mt-2 text-xs text-muted-foreground">Use a câmera ou selecione um arquivo de imagem. {processState.contractPhotoName && `Selecionado: ${processState.contractPhotoName}`}</p>
              </div>
              {processState.contractPhotoPreview && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 uppercase tracking-wider text-foreground/90">Pré-visualização:</p>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/30 bg-background/50 flex items-center justify-center" data-ai-hint="contract document">
                    <Image src={processState.contractPhotoPreview} alt="Pré-visualização do contrato" layout="fill" objectFit="contain" />
                  </div>
                </div>
              )}
            </CardContent>
            {processState.contractPhotoPreview && !processState.photoVerified && (
              <CardFooter className="p-6">
                <Button type="button" onClick={handleVerifyPhoto} disabled={isVerifyingPhoto || isExtractingData} className="w-full bg-gradient-to-br from-accent to-blue-700 hover:from-accent/90 hover:to-blue-700/90 text-lg py-6 rounded-lg text-accent-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
                  {isVerifyingPhoto ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                  Verificar Foto com IA
                </Button>
              </CardFooter>
            )}
          </Card>

          {isVerifyingPhoto && (
              <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium text-lg">Verificando qualidade da foto...</p>
                </CardContent>
            </Card>
          )}
          
          {processState.photoVerificationResult && (
            <Card className={`shadow-card-premium rounded-2xl border-2 ${processState.photoVerificationResult.isCompleteAndClear ? "border-green-500/70" : "border-red-500/70"} bg-card/80 backdrop-blur-sm`}>
              <CardHeader className="p-6">
                <CardTitle className="flex items-center font-headline text-xl">
                  {processState.photoVerificationResult.isCompleteAndClear ? <CheckCircle2 className="mr-3 h-7 w-7 text-green-400" /> : <AlertTriangle className="mr-3 h-7 w-7 text-red-400" />}
                  Resultado da Verificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6 pt-0">
                <p className="text-base text-foreground/90">{processState.photoVerificationResult.reason || (processState.photoVerificationResult.isCompleteAndClear ? "A foto parece nítida e completa." : "A foto precisa de ajustes.")}</p>
                {!processState.photoVerificationResult.isCompleteAndClear && (
                  <Button type="button" onClick={() => contractPhotoInputRef.current?.click()} variant="outline" className="w-full border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
                    <Camera className="mr-2 h-5 w-5" /> Tentar Novamente
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      { (shouldShowAnalysisButton || shouldShowReAnalysisButton) && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <ScanText className="mr-3 h-7 w-7" />
              {shouldShowReAnalysisButton ? "Reanalisar Contrato" : "Análise do Contrato"}
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1">
              {shouldShowReAnalysisButton 
                ? "Dados já extraídos. Clique abaixo para reanalisar a foto do contrato com IA se necessário." 
                : "Foto verificada. Prossiga para extrair informações chave do contrato."
              }
            </CardDescription>
          </CardHeader>
          {(shouldShowAnalysisButton || shouldShowReAnalysisButton) && (
            <CardFooter className="p-6">
              <Button 
                type="button" 
                onClick={handleExtractContractData} 
                disabled={isVerifyingPhoto || isExtractingData} 
                className="w-full bg-gradient-to-br from-accent to-blue-700 hover:from-accent/90 hover:to-blue-700/90 text-lg py-6 rounded-lg text-accent-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
              >
                  {isExtractingData ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" /> }
                  {shouldShowReAnalysisButton ? "Reanalisar Contrato com IA" : "Analisar Contrato com IA"}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {isExtractingData && processState.contractSourceType === 'new' && ( 
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium text-lg">
                Analisando contrato e extraindo dados...
              </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between mt-8">
        <Button 
          onClick={handleBack} 
          variant="outline"
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={
            isNavigatingNext ||
            isVerifyingPhoto || 
            isExtractingData || 
            (processState.contractSourceType === 'new' && (!processState.contractPhotoPreview || !processState.photoVerified || !processState.extractedData))
          }
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          {isNavigatingNext ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Aguarde...
            </>
          ) : (
            <>
              Próximo <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
