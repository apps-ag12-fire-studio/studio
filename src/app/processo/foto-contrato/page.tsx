
"use client";

import { useState, useEffect, ChangeEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, BuyerInfo } from "@/lib/process-store";
import { verifyContractPhoto, type VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import { extractContractData, type ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import { ArrowRight, ArrowLeft, Camera, Loader2, Sparkles, AlertTriangle, CheckCircle2, ScanText, UserRound } from "lucide-react";

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
  
  const contractPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedState = loadProcessState();
    
    if (
      loadedState.contractSourceType === 'existing' &&
      loadedState.extractedData &&
      !loadedState.buyerInfo.nome // Check if buyerInfo.nome is empty to avoid re-pre-filling if already done
    ) {
      const preFilledInfo = attemptToPreFillBuyerInfo(loadedState.extractedData);
      loadedState.buyerInfo = preFilledInfo;
      toast({ 
        title: "Informações do Comprador Pré-preenchidas", 
        description: "Dados do modelo de contrato foram usados para iniciar o preenchimento.",
        className: "bg-secondary text-secondary-foreground border-secondary"  
      });
    }
    
    setProcessState(loadedState);

     if (loadedState.contractPhotoName && !contractPhotoFile && loadedState.contractPhotoPreview) {
      // This implies a page reload or navigation back. We don't have the File object.
    }
  }, []);

  const handleBuyerInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    setProcessState(prevState => ({
      ...prevState,
      buyerInfo: {
        ...prevState.buyerInfo,
        [field]: e.target.value,
      }
    }));
  };

  const handleContractPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setContractPhotoFile(file); 
      const preview = URL.createObjectURL(file);
      setProcessState(prevState => ({
        ...prevState,
        contractPhotoPreview: preview,
        contractPhotoName: file.name,
        photoVerificationResult: null,
        photoVerified: false,
        extractedData: null, 
        buyerInfo: initialStoredProcessState.buyerInfo, // Reset buyer info when new photo is selected
      }));
    }
  };

  const handleVerifyPhoto = async () => {
    if (!contractPhotoFile) {
      toast({ title: "Verificação Necessária", description: "Por favor, carregue a foto do contrato.", variant: "destructive" });
      return;
    }
    setIsVerifyingPhoto(true);
    
    try {
      const photoDataUri = await fileToDataUri(contractPhotoFile);
      const result = await verifyContractPhoto({ photoDataUri });
      setProcessState(prevState => ({
        ...prevState,
        photoVerificationResult: result,
        photoVerified: result.isCompleteAndClear,
      }));
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
      setProcessState(prevState => ({
        ...prevState,
        photoVerificationResult: { isCompleteAndClear: false, reason: "Erro ao verificar. Tente novamente." },
        photoVerified: false,
      }));
      toast({ title: "Erro na Verificação", description: "Não foi possível concluir a verificação da foto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsVerifyingPhoto(false);
    }
  };

  const attemptToPreFillBuyerInfo = (extractedData: ExtractContractDataOutput | null): BuyerInfo => {
    const newBuyerInfo = { ...initialStoredProcessState.buyerInfo }; 
    if (extractedData?.nomesDasPartes) {
      for (let i = 0; i < extractedData.nomesDasPartes.length; i++) {
        const parte = extractedData.nomesDasPartes[i].toUpperCase();
        if (parte.includes("COMPRADOR")) {
          let nome = extractedData.nomesDasPartes[i].split(/,|\bCOMPRADOR\b/i)[0].trim();
          nome = nome.replace(/\b(SR\.?|SRA\.?|DR\.?|DRA\.?)\b/gi, '').trim();
          newBuyerInfo.nome = nome;

          if (extractedData.documentosDasPartes && extractedData.documentosDasPartes[i]) {
            const doc = extractedData.documentosDasPartes[i].replace(/\D/g, '');
            if (doc.length === 11 || doc.length === 14) { 
                 newBuyerInfo.cpf = extractedData.documentosDasPartes[i];
            }
          }
          break; 
        }
      }
    }
    return newBuyerInfo;
  };

  const handleExtractContractData = async () => {
    if (processState.contractSourceType === 'new' && (!contractPhotoFile || !processState.photoVerified)) {
      toast({ title: "Ação Requerida", description: "Carregue e verifique a foto do contrato antes da análise.", variant: "destructive" });
      return;
    }
     if (processState.contractSourceType === 'new' && !contractPhotoFile) {
      toast({ title: "Foto não encontrada", description: "Carregue a foto do contrato para análise.", variant: "destructive" });
      return;
    }

    setIsExtractingData(true);
    try {
      if (processState.contractSourceType === 'new' && contractPhotoFile) {
         const photoDataUri = await fileToDataUri(contractPhotoFile);
         const result = await extractContractData({ photoDataUri });
         const preFilledBuyerInfo = attemptToPreFillBuyerInfo(result);

         setProcessState(prevState => ({
           ...prevState,
           extractedData: result,
           buyerInfo: preFilledBuyerInfo, 
         }));
         toast({ 
           title: "Análise do Contrato Concluída!", 
           description: "Dados extraídos do contrato com sucesso. Verifique as informações do comprador.", 
           className: "bg-secondary text-secondary-foreground border-secondary" 
         });
      }
    } catch (error) {
      console.error("AI Extraction Error:", error);
      setProcessState(prevState => ({ ...prevState, extractedData: null, buyerInfo: initialStoredProcessState.buyerInfo })); 
      toast({ title: "Erro na Análise do Contrato", description: "Não foi possível extrair os dados. Verifique a imagem ou tente novamente.", variant: "destructive" });
    } finally {
      setIsExtractingData(false);
    }
  };
  
  const validateStep = () => {
    const { buyerInfo, contractSourceType, photoVerified, extractedData } = processState;
    
    if (contractSourceType === 'new') {
      if (!processState.contractPhotoPreview || !photoVerified || !extractedData) { // Changed contractPhotoFile to contractPhotoPreview
        toast({ title: "Etapas Incompletas (Novo Contrato)", description: "Capture, verifique e analise a foto do contrato.", variant: "destructive" });
        return false;
      }
    } else { 
      if (!extractedData) {
        toast({ title: "Etapas Incompletas (Contrato Existente)", description: "Modelo de contrato não carregado. Volte e selecione um.", variant: "destructive" });
        return false;
      }
    }

    if (!buyerInfo.nome || !buyerInfo.cpf || !buyerInfo.telefone || !buyerInfo.email) {
      toast({ title: "Campos Obrigatórios", description: "Preencha todas as 'Informações do Comprador'.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    saveProcessState({ ...processState, currentStep: "/processo/documentos" });
    router.push("/processo/documentos");
  };

  const handleBack = () => {
    saveProcessState(processState);
    router.push("/processo/dados-iniciais");
  };

  useEffect(() => {
    const previewUrl = processState.contractPhotoPreview;
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) { 
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [processState.contractPhotoPreview]);


  const shouldShowPhotoUploadAndVerify = processState.contractSourceType === 'new';
  const shouldShowAnalysisButton = processState.contractSourceType === 'new' && processState.photoVerified && !isExtractingData;
  const shouldShowBuyerInfoForm = !!processState.extractedData;


  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
          Passo 2: {processState.contractSourceType === 'new' ? "Foto do Contrato e Dados do Comprador" : "Dados do Comprador (Contrato Existente)"}
        </p>
      </header>

      {shouldShowPhotoUploadAndVerify && (
        <>
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center text-2xl font-headline text-primary"><Camera className="mr-3 h-7 w-7" />Foto do Contrato</CardTitle>
              <CardDescription className="text-foreground/70 pt-1">Envie uma imagem nítida e completa do contrato assinado.</CardDescription>
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

      {shouldShowAnalysisButton && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><ScanText className="mr-3 h-7 w-7" />
              Análise do Contrato
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1">
              {processState.extractedData 
                ? "Dados extraídos. Verifique as 'Informações do Comprador' abaixo. Clique aqui para reanalisar se necessário." 
                : "Foto verificada. Prossiga para extrair informações chave do contrato e preencher dados do comprador."
              }
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-6">
            <Button 
              type="button" 
              onClick={handleExtractContractData} 
              disabled={isVerifyingPhoto || isExtractingData} 
              className="w-full bg-gradient-to-br from-accent to-blue-700 hover:from-accent/90 hover:to-blue-700/90 text-lg py-6 rounded-lg text-accent-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
            >
                {isExtractingData ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" /> }
                {processState.extractedData ? "Reanalisar Contrato com IA" : "Analisar Contrato e Preencher Dados do Comprador"}
            </Button>
          </CardFooter>
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

      {shouldShowBuyerInfoForm && (
         <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <UserRound className="mr-3 h-7 w-7" /> Informações do Comprador
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1">
              {processState.contractSourceType === 'new'
                ? "Para 'Novo Contrato', a IA analisou a foto do contrato e tentou pré-preencher os dados do comprador abaixo. "
                : "Para 'Contrato Existente', os dados do comprador podem ter sido pré-preenchidos com base no modelo de contrato selecionado. "
              }
              Confirme, corrija ou complete todas as informações.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6 pt-0">
            <div>
              <Label htmlFor="comprador-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
              <Input id="comprador-nome" value={processState.buyerInfo.nome} onChange={(e) => handleBuyerInputChange(e, 'nome')} placeholder="Nome completo do comprador" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="comprador-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">CPF</Label>
                <Input id="comprador-cpf" value={processState.buyerInfo.cpf} onChange={(e) => handleBuyerInputChange(e, 'cpf')} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
              </div>
              <div>
                <Label htmlFor="comprador-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Telefone (WhatsApp)</Label>
                <Input id="comprador-telefone" type="tel" value={processState.buyerInfo.telefone} onChange={(e) => handleBuyerInputChange(e, 'telefone')} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
              </div>
            </div>
            <div>
              <Label htmlFor="comprador-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
              <Input id="comprador-email" type="email" value={processState.buyerInfo.email} onChange={(e) => handleBuyerInputChange(e, 'email')} placeholder="seu.email@dominio.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
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
            isVerifyingPhoto || 
            isExtractingData || 
            (processState.contractSourceType === 'new' && (!processState.contractPhotoPreview || !processState.photoVerified || !processState.extractedData)) || // Ensure preview exists
            (processState.contractSourceType === 'existing' && !processState.extractedData) ||
            !processState.buyerInfo.nome || 
            !processState.buyerInfo.cpf ||
            !processState.buyerInfo.telefone ||
            !processState.buyerInfo.email
          }
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Próximo <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
    
