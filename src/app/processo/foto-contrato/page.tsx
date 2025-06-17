
"use client";

import { useState, useEffect, ChangeEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState } from "@/lib/process-store";
import { verifyContractPhoto, type VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import { extractContractData, type ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import { ArrowRight, ArrowLeft, Camera, Loader2, Sparkles, AlertTriangle, CheckCircle2, ScanText } from "lucide-react";
import { storage } from "@/lib/firebase"; 
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTaskSnapshot } from "firebase/storage";

const generateUniqueFileName = (file: File, prefix: string = 'unknown') => {
  const timestamp = new Date().getTime();
  const saneFilename = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return `${prefix}/${timestamp}-${saneFilename}`;
};

export default function FotoContratoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  
  const [isUploadingContractPhoto, setIsUploadingContractPhoto] = useState(false);
  const [contractPhotoUploadProgress, setContractPhotoUploadProgress] = useState<number | null>(null);
  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
  const [isExtractingData, setIsExtractingData] = useState(false);
  const [isNavigatingNext, setIsNavigatingNext] = useState(false);
  
  const contractPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedState = loadProcessState();
    setProcessState(loadedState);
  }, []);

  const handleContractPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploadingContractPhoto(true);
      setContractPhotoUploadProgress(0); // Initial progress to 0
      toast({ title: "Upload Iniciado", description: `Enviando ${file.name}...`, className: "bg-blue-600 text-white border-blue-700" });

      if (processState.contractPhotoStoragePath) {
        try {
          const oldPhotoRef = storageRef(storage, processState.contractPhotoStoragePath);
          await deleteObject(oldPhotoRef);
        } catch (deleteError) {
          console.warn("Could not delete old contract photo from Firebase Storage:", deleteError);
        }
      }
      
      const filePath = generateUniqueFileName(file, 'original_contracts');
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progressValue = snapshot.totalBytes > 0
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            : (snapshot.state === 'success' ? 100 : 0);
          setContractPhotoUploadProgress(Math.round(progressValue));
        },
        (error) => {
          console.error("Error uploading contract photo to Firebase Storage:", error);
          toast({ 
            title: "Erro no Upload", 
            description: `Não foi possível enviar ${file.name}. Tente novamente. (Erro: ${error.code} - ${error.message})`, 
            variant: "destructive"
          });
          setIsUploadingContractPhoto(false);
          setContractPhotoUploadProgress(null);
          if (contractPhotoInputRef.current) {
            contractPhotoInputRef.current.value = "";
          }
          const newState = {...processState, contractPhotoPreview: null, contractPhotoName: undefined, contractPhotoStoragePath: null, photoVerified: false, photoVerificationResult: null, extractedData: null};
          setProcessState(newState);
          saveProcessState(newState);
        },
        async () => { 
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newState = {
              ...processState,
              contractPhotoPreview: downloadURL,
              contractPhotoName: file.name,
              contractPhotoStoragePath: filePath,
              photoVerificationResult: null,
              photoVerified: false,
              extractedData: null, 
            };
            setProcessState(newState);
            saveProcessState(newState);
            toast({ title: "Upload Concluído!", description: `${file.name} enviado com sucesso.`, className: "bg-green-600 text-primary-foreground border-green-700" });
          } catch (error: any) {
            console.error("Error getting download URL for contract photo:", error);
            toast({ title: "Erro Pós-Upload", description: `Falha ao obter URL do arquivo ${file.name}. (Erro: ${error.message})`, variant: "destructive"});
          } finally {
            setIsUploadingContractPhoto(false);
            setContractPhotoUploadProgress(null); 
          }
        }
      );
    }
  };

  const handleVerifyPhoto = async () => {
    if (!processState.contractPhotoPreview) {
      toast({ title: "Verificação Necessária", description: "Por favor, carregue a foto do contrato.", variant: "destructive" });
      return;
    }
    setIsVerifyingPhoto(true);
    
    try {
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
    } catch (error: any) {
      console.error("AI Verification Error:", error);
      const newState = {
        ...processState,
        photoVerificationResult: { isCompleteAndClear: false, reason: `Erro ao verificar com IA: ${error.message}` },
        photoVerified: false,
      };
      setProcessState(newState);
      saveProcessState(newState);
      toast({ title: "Erro na Verificação com IA", description: `Não foi possível concluir a verificação da foto. (Erro: ${error.message})`, variant: "destructive" });
    } finally {
      setIsVerifyingPhoto(false);
    }
  };

  const handleExtractContractData = async () => {
    if (processState.contractSourceType === 'new' && (!processState.contractPhotoPreview || !processState.photoVerified)) {
      toast({ title: "Ação Requerida", description: "Carregue e verifique a foto do contrato antes da análise.", variant: "destructive" });
      return;
    }
     if (processState.contractSourceType === 'new' && !processState.contractPhotoPreview) {
      toast({ title: "Foto não encontrada", description: "Carregue a foto do contrato para análise.", variant: "destructive" });
      return;
    }

    setIsExtractingData(true);
    try {
      if (processState.contractSourceType === 'new' && processState.contractPhotoPreview) {
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
    } catch (error: any) {
      console.error("AI Extraction Error:", error);
      const newState = { ...processState, extractedData: null };
      setProcessState(newState); 
      saveProcessState(newState);
      toast({ title: "Erro na Análise do Contrato", description: `Não foi possível extrair os dados com IA. (Erro: ${error.message})`, variant: "destructive" });
    } finally {
      setIsExtractingData(false);
    }
  };
  
  const validateStep = () => {
    const { contractSourceType, photoVerified, extractedData, contractPhotoPreview } = processState;
    
    if (contractSourceType === 'new') {
      if (!contractPhotoPreview || !photoVerified || !extractedData) { 
        toast({ title: "Etapas Incompletas (Novo Contrato)", description: "Capture/envie, verifique e analise a foto do contrato.", variant: "destructive" });
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
    saveProcessState({ ...processState, currentStep: "/processo/documentos" });
    toast({
      title: "Etapa 2 Concluída!",
      description: "Contrato processado. Carregando próxima etapa...",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push("/processo/documentos");
  };

  const handleBack = () => {
    setIsNavigatingNext(true);
    saveProcessState(processState);
    router.push("/processo/dados-iniciais");
  };

  const shouldShowPhotoUploadAndVerify = processState.contractSourceType === 'new';
  const shouldShowAnalysisButton = processState.contractSourceType === 'new' && processState.photoVerified && !isExtractingData && !processState.extractedData && !isUploadingContractPhoto;
  const shouldShowReAnalysisButton = processState.contractSourceType === 'new' && processState.photoVerified && !isExtractingData && !!processState.extractedData && !isUploadingContractPhoto;
  const globalDisableCondition = isNavigatingNext || isUploadingContractPhoto || isVerifyingPhoto || isExtractingData;

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
                <div className="flex items-center gap-2">
                  <Input
                    id="contract-photo-input"
                    ref={contractPhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleContractPhotoChange}
                    className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-2.5"
                    aria-describedby="contract-photo-hint"
                    disabled={globalDisableCondition}
                  />
                </div>
                <p id="contract-photo-hint" className="mt-2 text-xs text-muted-foreground">Use a câmera ou selecione um arquivo de imagem. {processState.contractPhotoName && `Atual: ${processState.contractPhotoName}`}</p>
              </div>
              {isUploadingContractPhoto && (
                <div className="mt-4 space-y-2">
                    <div className="flex items-center space-x-2 text-primary">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>{contractPhotoUploadProgress === null ? 'Preparando envio...' : `Enviando ${contractPhotoUploadProgress}%...`}</span>
                    </div>
                    {contractPhotoUploadProgress !== null && (
                      <Progress value={contractPhotoUploadProgress} className="w-full h-2 bg-primary/20" />
                    )}
                </div>
              )}
              {processState.contractPhotoPreview && !isUploadingContractPhoto && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2 uppercase tracking-wider text-foreground/90">Pré-visualização:</p>
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/30 bg-background/50 flex items-center justify-center" data-ai-hint="contract document">
                    <Image src={processState.contractPhotoPreview} alt="Pré-visualização do contrato" layout="fill" objectFit="contain" />
                  </div>
                </div>
              )}
            </CardContent>
            {processState.contractPhotoPreview && !processState.photoVerified && !isUploadingContractPhoto && !isVerifyingPhoto && (
              <CardFooter className="p-6">
                <Button type="button" onClick={handleVerifyPhoto} disabled={globalDisableCondition} className="w-full bg-gradient-to-br from-accent to-blue-700 hover:from-accent/90 hover:to-blue-700/90 text-lg py-6 rounded-lg text-accent-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
                  <Sparkles className="mr-2 h-6 w-6" />
                  Verificar Foto com IA
                </Button>
              </CardFooter>
            )}
          </Card>

          {isVerifyingPhoto && (
              <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium text-lg">Verificando qualidade da foto com IA...</p>
                </CardContent>
            </Card>
          )}
          
          {processState.photoVerificationResult && !isUploadingContractPhoto && !isVerifyingPhoto && (
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
                  <Button type="button" onClick={() => contractPhotoInputRef.current?.click()} variant="outline" className="w-full border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg" disabled={globalDisableCondition}>
                    <Camera className="mr-2 h-5 w-5" /> Tentar Nova Foto
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      { (shouldShowAnalysisButton || shouldShowReAnalysisButton) && !isVerifyingPhoto && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <ScanText className="mr-3 h-7 w-7" />
              {shouldShowReAnalysisButton ? "Reanalisar Contrato com IA" : "Análise do Contrato com IA"}
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1">
              {shouldShowReAnalysisButton 
                ? "Dados já extraídos. Clique abaixo para reanalisar a foto do contrato com IA se necessário." 
                : "Foto verificada. Prossiga para extrair informações chave do contrato com IA."
              }
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-6">
            <Button 
              type="button" 
              onClick={handleExtractContractData} 
              disabled={globalDisableCondition} 
              className="w-full bg-gradient-to-br from-accent to-blue-700 hover:from-accent/90 hover:to-blue-700/90 text-lg py-6 rounded-lg text-accent-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
            >
                {isExtractingData ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" /> }
                {shouldShowReAnalysisButton ? "Reanalisar Contrato com IA" : "Analisar Contrato com IA"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {isExtractingData && processState.contractSourceType === 'new' && ( 
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium text-lg">
                Analisando contrato e extraindo dados com IA...
              </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between mt-8">
        <Button 
          onClick={handleBack} 
          variant="outline"
          disabled={globalDisableCondition}
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          { isNavigatingNext && !isUploadingContractPhoto ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowLeft className="mr-2 h-5 w-5" /> }
          { isNavigatingNext && !isUploadingContractPhoto ? "Voltando..." : "Voltar" }
        </Button>
        <Button 
          onClick={handleNext} 
          disabled={
            globalDisableCondition ||
            (processState.contractSourceType === 'new' && (!processState.contractPhotoPreview || !processState.photoVerified || !processState.extractedData))
          }
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          {isNavigatingNext && !globalDisableCondition ? (
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
