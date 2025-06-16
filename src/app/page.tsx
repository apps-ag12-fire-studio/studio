
"use client";

import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, UploadCloud, FileText, Trash2, Loader2, AlertTriangle, CheckCircle2, Paperclip, ScanText, Printer as PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { verifyContractPhoto, type VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import { extractContractData, type ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const MAX_DOCUMENTS = 4;
const MIN_DOCUMENTS = 2;

export default function ContratoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [contractPhoto, setContractPhoto] = useState<File | null>(null);
  const [contractPhotoPreview, setContractPhotoPreview] = useState<string | null>(null);
  
  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
  const [photoVerificationResult, setPhotoVerificationResult] = useState<VerifyContractPhotoOutput | null>(null);
  const [photoVerified, setPhotoVerified] = useState(false);

  const [isExtractingData, setIsExtractingData] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractContractDataOutput | null>(null);

  const [attachedDocuments, setAttachedDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContractPhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setContractPhoto(file);
      if (contractPhotoPreview) {
        URL.revokeObjectURL(contractPhotoPreview);
      }
      const preview = URL.createObjectURL(file);
      setContractPhotoPreview(preview);
      setPhotoVerificationResult(null);
      setPhotoVerified(false);
      setExtractedData(null);
    }
  };

  const handleVerifyPhoto = async () => {
    if (!contractPhoto) {
      toast({ title: "Erro", description: "Por favor, selecione uma foto do contrato.", variant: "destructive" });
      return;
    }
    setIsVerifyingPhoto(true);
    setPhotoVerificationResult(null);
    setExtractedData(null); 
    try {
      const photoDataUri = await fileToDataUri(contractPhoto);
      const result = await verifyContractPhoto({ photoDataUri });
      setPhotoVerificationResult(result);
      if (result.isCompleteAndClear) {
        setPhotoVerified(true);
        toast({ title: "Verificação Concluída", description: "A foto do contrato é nítida e completa."});
      } else {
        setPhotoVerified(false);
        toast({ title: "Verificação Falhou", description: result.reason || "A foto do contrato não está nítida ou completa. Por favor, tente novamente.", variant: "destructive" });
      }
    } catch (error) {
      console.error("AI Verification Error:", error);
      setPhotoVerificationResult({ isCompleteAndClear: false, reason: "Ocorreu um erro durante a verificação. Tente novamente." });
      setPhotoVerified(false);
      toast({ title: "Erro na Verificação", description: "Não foi possível verificar a foto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsVerifyingPhoto(false);
    }
  };

  const handleExtractContractData = async () => {
    if (!contractPhoto || !photoVerified) {
      toast({ title: "Ação Necessária", description: "Por favor, carregue e verifique a foto do contrato primeiro.", variant: "destructive" });
      return;
    }
    setIsExtractingData(true);
    try {
      const photoDataUri = await fileToDataUri(contractPhoto);
      const result = await extractContractData({ photoDataUri });
      setExtractedData(result);
      toast({ title: "Análise Concluída", description: "Dados extraídos do contrato." });
    } catch (error) {
      console.error("AI Extraction Error:", error);
      setExtractedData(null);
      toast({ title: "Erro na Análise", description: "Não foi possível extrair os dados do contrato. Verifique a qualidade da imagem ou tente novamente.", variant: "destructive" });
    } finally {
      setIsExtractingData(false);
    }
  };

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachedDocuments(prevDocs => {
        const combined = [...prevDocs, ...newFiles];
        if (combined.length > MAX_DOCUMENTS) {
          toast({ title: "Limite Excedido", description: `Você pode anexar no máximo ${MAX_DOCUMENTS} documentos.`, variant: "destructive"});
          return prevDocs;
        }
        return combined;
      });
    }
  };

  const removeDocument = (indexToRemove: number) => {
    setAttachedDocuments(prevDocs => prevDocs.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contractPhoto || !photoVerified) {
      toast({ title: "Envio Falhou", description: "Por favor, capture e verifique a foto do contrato.", variant: "destructive" });
      return;
    }
    if (attachedDocuments.length < MIN_DOCUMENTS) {
      toast({ title: "Envio Falhou", description: `Por favor, anexe pelo menos ${MIN_DOCUMENTS} documentos comprobatórios.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Submitting data:", { contractPhoto, attachedDocuments, extractedData });
      // Placeholder for actual submission logic
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      toast({ title: "Sucesso!", description: "Contrato e documentos enviados com sucesso."});
      router.push("/confirmation");
    } catch (error) {
      console.error("Submission Error:", error);
      toast({ title: "Erro no Envio", description: "Não foi possível enviar os dados. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrepareForPrint = () => {
    if (extractedData) {
      try {
        localStorage.setItem('extractedContractData', JSON.stringify(extractedData));
        router.push('/print-contract');
      } catch (error) {
        console.error("Error saving to localStorage:", error);
        toast({ title: "Erro", description: "Não foi possível preparar os dados para impressão.", variant: "destructive" });
      }
    } else {
      toast({ title: "Erro", description: "Nenhum dado extraído para preparar para impressão.", variant: "destructive" });
    }
  };


  useEffect(() => {
    return () => {
      if (contractPhotoPreview) {
        URL.revokeObjectURL(contractPhotoPreview);
      }
    };
  }, [contractPhotoPreview]);

  const isExtractedDataEmpty = (data: ExtractContractDataOutput | null): boolean => {
    if (!data) return true;
    return !Object.values(data).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-background p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-8">
        <header className="text-center py-6">
          <h1 className="text-3xl sm:text-4xl font-headline text-primary">Contrato Fácil - Financeiro Plataforma Internacional - Pablo Marçal</h1>
          <p className="mt-2 text-lg text-muted-foreground">Capture a foto do contrato, analise-o e anexe os documentos necessários.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-xl font-headline"><Camera className="mr-3 h-7 w-7 text-primary" />Etapa 1: Foto do Contrato</CardTitle>
              <CardDescription>Tire uma foto nítida e completa do contrato assinado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contract-photo-input" className="mb-2 block text-sm font-medium">Carregar foto do contrato</Label>
                <Input
                  id="contract-photo-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleContractPhotoChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  aria-describedby="contract-photo-hint"
                />
                <p id="contract-photo-hint" className="mt-1 text-xs text-muted-foreground">Use a câmera do seu dispositivo ou selecione um arquivo de imagem.</p>
              </div>
              {contractPhotoPreview && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Pré-visualização:</p>
                  <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border-2 border-dashed border-primary/30 bg-muted/30 flex items-center justify-center" data-ai-hint="contract document">
                    <Image src={contractPhotoPreview} alt="Pré-visualização do contrato" layout="fill" objectFit="contain" />
                  </div>
                </div>
              )}
            </CardContent>
            {contractPhoto && !photoVerified && (
              <CardFooter>
                <Button type="button" onClick={handleVerifyPhoto} disabled={isVerifyingPhoto || isExtractingData} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-3">
                  {isVerifyingPhoto && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  Verificar Foto com IA
                </Button>
              </CardFooter>
            )}
          </Card>

          {isVerifyingPhoto && (
             <Card className="shadow-md">
                <CardContent className="p-6 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Verificando a qualidade da foto...</p>
                </CardContent>
            </Card>
          )}
          
          {photoVerificationResult && (
            <Card className={`shadow-md ${photoVerificationResult.isCompleteAndClear ? "border-green-500" : "border-red-500"}`}>
              <CardHeader>
                <CardTitle className="flex items-center font-headline">
                  {photoVerificationResult.isCompleteAndClear ? <CheckCircle2 className="mr-3 h-7 w-7 text-green-500" /> : <AlertTriangle className="mr-3 h-7 w-7 text-red-500" />}
                  Resultado da Verificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-base">{photoVerificationResult.reason || (photoVerificationResult.isCompleteAndClear ? "A foto parece estar nítida e completa." : "A foto precisa de ajustes.")}</p>
                {!photoVerificationResult.isCompleteAndClear && (
                  <Button type="button" onClick={() => document.getElementById('contract-photo-input')?.click()} variant="outline" className="w-full border-primary text-primary hover:bg-primary/5">
                    <Camera className="mr-2 h-5 w-5" /> Tentar Novamente
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {photoVerified && !extractedData && !isExtractingData && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl font-headline"><ScanText className="mr-3 h-7 w-7 text-primary" />Etapa 1.5: Análise do Contrato</CardTitle>
                <CardDescription>Extraia informações chave do contrato para facilitar o preenchimento e verificação.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button type="button" onClick={handleExtractContractData} disabled={isVerifyingPhoto || isExtractingData} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-3">
                   Analisar Contrato com IA
                </Button>
              </CardFooter>
            </Card>
          )}

          {isExtractingData && (
            <Card className="shadow-md">
              <CardContent className="p-6 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground font-medium">Analisando o contrato e extraindo dados...</p>
              </CardContent>
            </Card>
          )}

          {extractedData && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center font-headline"><ScanText className="mr-3 h-7 w-7 text-primary" />Dados Extraídos do Contrato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isExtractedDataEmpty(extractedData) ? (
                   <p className="text-muted-foreground">Nenhum dado específico pôde ser extraído automaticamente ou o contrato não contém essas informações de forma clara. Verifique a qualidade da imagem.</p>
                ) : (
                  <>
                    {extractedData.nomesDasPartes && extractedData.nomesDasPartes.length > 0 && (
                      <div><strong>Partes:</strong> {extractedData.nomesDasPartes.join('; ')}</div>
                    )}
                    {extractedData.documentosDasPartes && extractedData.documentosDasPartes.length > 0 && (
                      <div><strong>Documentos das Partes:</strong> {extractedData.documentosDasPartes.join('; ')}</div>
                    )}
                    {extractedData.objetoDoContrato && (
                      <div><strong>Objeto do Contrato:</strong> {extractedData.objetoDoContrato}</div>
                    )}
                    {extractedData.valorPrincipal && (
                      <div><strong>Valor Principal:</strong> {extractedData.valorPrincipal}</div>
                    )}
                    {extractedData.prazoContrato && (
                      <div><strong>Prazo do Contrato:</strong> {extractedData.prazoContrato}</div>
                    )}
                    {extractedData.localEDataAssinatura && (
                      <div><strong>Local e Data de Assinatura:</strong> {extractedData.localEDataAssinatura}</div>
                    )}
                    {extractedData.foroEleito && (
                      <div><strong>Foro Eleito:</strong> {extractedData.foroEleito}</div>
                    )}
                    {extractedData.outrasObservacoesRelevantes && (
                      <div><strong>Outras Observações:</strong> {extractedData.outrasObservacoesRelevantes}</div>
                    )}
                  </>
                )}
                 <Button type="button" onClick={handleExtractContractData} variant="outline" disabled={isExtractingData || isVerifyingPhoto} className="w-full mt-4 border-primary text-primary hover:bg-primary/5">
                    {isExtractingData ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ScanText className="mr-2 h-5 w-5" />}
                    Reanalisar Contrato
                </Button>
              </CardContent>
              {!isExtractedDataEmpty(extractedData) && (
                <CardFooter className="flex-col space-y-2">
                    <Button type="button" onClick={handlePrepareForPrint} className="w-full bg-green-600 hover:bg-green-700 text-white text-base py-3">
                        <PrinterIcon className="mr-2 h-5 w-5" /> Preparar Contrato para Impressão
                    </Button>
                </CardFooter>
              )}
            </Card>
          )}


          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-xl font-headline"><Paperclip className="mr-3 h-7 w-7 text-primary" />Etapa 2: Documentos Comprobatórios</CardTitle>
              <CardDescription>Anexe os documentos necessários (ex: RG, CNH, CPF). Mínimo de {MIN_DOCUMENTS} documentos. Máximo de {MAX_DOCUMENTS}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="document-input" className="mb-2 block text-sm font-medium">Adicionar documentos</Label>
                <Input
                  id="document-input"
                  type="file"
                  multiple
                  onChange={handleDocumentChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  aria-describedby="document-hint"
                  disabled={attachedDocuments.length >= MAX_DOCUMENTS}
                />
                <p id="document-hint" className="mt-1 text-xs text-muted-foreground">
                  {attachedDocuments.length >= MAX_DOCUMENTS 
                    ? `Limite de ${MAX_DOCUMENTS} documentos atingido.`
                    : `Você pode anexar até ${MAX_DOCUMENTS} documentos. (${attachedDocuments.length}/${MAX_DOCUMENTS} anexados)`}
                </p>
              </div>
              {attachedDocuments.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium">Documentos Anexados:</h4>
                  <ul className="list-none space-y-2">
                    {attachedDocuments.map((doc, index) => (
                      <li key={index} className="flex items-center justify-between p-3 border rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileText className="h-6 w-6 text-primary shrink-0" />
                          <span className="truncate text-sm font-medium">{doc.name}</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(index)} aria-label={`Remover ${doc.name}`}>
                          <Trash2 className="h-5 w-5 text-destructive hover:text-destructive/80" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center text-xl font-headline"><UploadCloud className="mr-3 h-7 w-7 text-primary" />Etapa 3: Enviar Tudo</CardTitle>
                <CardDescription>Revise as informações e envie o contrato e os documentos.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting || !photoVerified || attachedDocuments.length < MIN_DOCUMENTS || isVerifyingPhoto || isExtractingData} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-base py-3">
                {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isSubmitting ? "Enviando..." : "Enviar Contrato e Documentos"}
              </Button>
            </CardFooter>
          </Card>
        </form>
        <footer className="text-center py-8 text-xs text-muted-foreground space-y-1">
            <p>© 2025 Financeiro Pablo Marçal - Todos os direitos reservados.</p>
            <p>Uma solução SAAS com Inteligência Artificial treinada por CFO - Antônio Fogaça.</p>
        </footer>
      </div>
    </main>
  );
}
