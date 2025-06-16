
"use client";

import { useState, ChangeEvent, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, UploadCloud, FileText, Trash2, Loader2, AlertTriangle, CheckCircle2, Paperclip, ScanText, Printer as PrinterIcon, FileSearch, ListChecks, Users, Banknote, Scale, LifeBuoy, UserRound, Sparkles, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

  const [contractSourceType, setContractSourceType] = useState<'new' | 'existing'>('new');

  const [contractPhoto, setContractPhoto] = useState<File | null>(null);
  const [contractPhotoPreview, setContractPhotoPreview] = useState<string | null>(null);
  
  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
  const [photoVerificationResult, setPhotoVerificationResult] = useState<VerifyContractPhotoOutput | null>(null);
  const [photoVerified, setPhotoVerified] = useState(false);

  const [isExtractingData, setIsExtractingData] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractContractDataOutput | null>(null);

  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");

  const [attachedDocuments, setAttachedDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contractPhotoInputRef = useRef<HTMLInputElement>(null);

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
      toast({ title: "Verificação Necessária", description: "Por favor, carregue a foto do contrato.", variant: "destructive" });
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
        toast({ title: "Foto Verificada", description: "A imagem do contrato é nítida e completa.", className: "bg-secondary text-secondary-foreground border-secondary" });
      } else {
        setPhotoVerified(false);
        toast({ title: "Falha na Verificação", description: result.reason || "A imagem do contrato não está ideal. Por favor, tente novamente.", variant: "destructive" });
      }
    } catch (error) {
      console.error("AI Verification Error:", error);
      setPhotoVerificationResult({ isCompleteAndClear: false, reason: "Erro ao verificar. Tente novamente." });
      setPhotoVerified(false);
      toast({ title: "Erro na Verificação", description: "Não foi possível concluir a verificação da foto. Tente novamente.", variant: "destructive" });
    } finally {
      setIsVerifyingPhoto(false);
    }
  };

  const handleExtractContractData = async () => {
    if (contractSourceType === 'new') {
      if (!contractPhoto || !photoVerified) {
        toast({ title: "Ação Requerida", description: "Carregue e verifique a foto do contrato antes da análise.", variant: "destructive" });
        return;
      }
      setIsExtractingData(true);
      try {
        const photoDataUri = await fileToDataUri(contractPhoto);
        const result = await extractContractData({ photoDataUri });
        setExtractedData(result);
        toast({ title: "Análise Concluída", description: "Dados extraídos do contrato com sucesso.", className: "bg-secondary text-secondary-foreground border-secondary" });
      } catch (error) {
        console.error("AI Extraction Error:", error);
        setExtractedData(null);
        toast({ title: "Erro na Análise", description: "Não foi possível extrair os dados. Verifique a imagem ou tente novamente.", variant: "destructive" });
      } finally {
        setIsExtractingData(false);
      }
    }
  };

  const handleSelectExistingContract = () => {
    const sampleContractData: ExtractContractDataOutput = {
      nomesDasPartes: ["CLIENTE EXEMPLO, COMO COMPRADOR", "PABLO MARÇAL, COMO VENDEDOR"],
      documentosDasPartes: ["000.000.000-00", "[CNPJ DA EMPRESA VENDEDORA]"],
      objetoDoContrato: "PRODUTO DIGITAL EXEMPLO (ex: Mentoria XPTO)",
      valorPrincipal: "R$ 1.000,00 (mil reais)",
      condicoesDePagamento: "Pagamento único via Pix.",
      prazoContrato: "Acesso por 12 meses",
      localEDataAssinatura: "São Paulo, 15 de Agosto de 2024",
      foroEleito: "Comarca de São Paulo/SP",
      outrasObservacoesRelevantes: "Este é um contrato modelo carregado para demonstração."
    };
    setExtractedData(sampleContractData);
    toast({ title: "Modelo Carregado", description: "Contrato de Produto Digital carregado com dados de exemplo.", className: "bg-secondary text-secondary-foreground border-secondary" });
  };


  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachedDocuments(prevDocs => {
        const combined = [...prevDocs, ...newFiles];
        if (combined.length > MAX_DOCUMENTS) {
          toast({ title: "Limite Excedido", description: `Máximo de ${MAX_DOCUMENTS} documentos permitidos.`, variant: "destructive"});
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

    if (!responsavelNome || !responsavelCpf || !responsavelTelefone || !responsavelEmail) {
      toast({ title: "Envio Interrompido", description: "Preencha todas as 'Informações do Comprador'.", variant: "destructive" });
      return;
    }

    if (contractSourceType === 'new' && (!contractPhoto || !photoVerified || !extractedData)) {
      toast({ title: "Envio Interrompido", description: "Capture, verifique e analise a foto do contrato.", variant: "destructive" });
      return;
    }
    if (contractSourceType === 'existing' && !extractedData) {
        toast({ title: "Envio Interrompido", description: "Selecione um contrato existente ou carregue seus dados.", variant: "destructive" });
        return;
    }
    if (attachedDocuments.length < MIN_DOCUMENTS) {
      toast({ title: "Envio Interrompido", description: `Anexe ao menos ${MIN_DOCUMENTS} documentos comprobatórios.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Submitting data (simulated):", { 
        contractSourceType, 
        contractPhotoName: contractPhoto?.name, 
        attachedDocumentNames: attachedDocuments.map(d => d.name), 
        extractedData,
        comprador: {
          nome: responsavelNome,
          cpf: responsavelCpf,
          telefone: responsavelTelefone,
          email: responsavelEmail,
        }
      });
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      
      console.log("\n--- SIMULANDO ENVIO DE EMAIL ---");
      console.log(`Destinatários: financeiro@empresa.com, juridico@empresa.com, ${responsavelEmail}`);
      const subject = `Novo Contrato Submetido: ${extractedData?.objetoDoContrato || 'Detalhes do Contrato'} - Comprador: ${responsavelNome}`;
      console.log(`Assunto: ${subject}`);
      console.log("Corpo do Email (Resumo):");
      console.log(`  Tipo de Submissão: ${contractSourceType === 'new' ? "Novo Contrato (Foto)" : "Contrato Existente (Modelo)"}`);
      console.log(`  Dados do Comprador (Informado no formulário):`);
      console.log(`    Nome: ${responsavelNome}`);
      console.log(`    CPF: ${responsavelCpf}`);
      console.log(`    Telefone: ${responsavelTelefone}`);
      console.log(`    Email: ${responsavelEmail}`);
      if (extractedData) {
        console.log("  Detalhes do Contrato (Extraídos/Carregados):");
        console.log(`    Objeto: ${extractedData.objetoDoContrato || 'Não informado'}`);
        console.log(`    Valor Principal: ${extractedData.valorPrincipal || 'Não informado'}`);
        console.log(`    Condições de Pagamento: ${extractedData.condicoesDePagamento || 'Não informado'}`);
        console.log(`    Prazo: ${extractedData.prazoContrato || 'Não informado'}`);
        console.log(`    Local e Data Ass.: ${extractedData.localEDataAssinatura || 'Não informado'}`);
        console.log(`    Foro: ${extractedData.foroEleito || 'Não informado'}`);
        console.log(`    Observações Relevantes: ${extractedData.outrasObservacoesRelevantes || 'Nenhuma'}`);
      }
      if (contractSourceType === 'new' && contractPhoto) {
        console.log(`  Foto do Contrato Anexada: ${contractPhoto.name}`);
      }
      console.log(`  Documentos Comprobatórios Anexados: ${attachedDocuments.length} (${attachedDocuments.map(d => d.name).join(', ')})`);
      console.log("--- FIM DA SIMULAÇÃO DE EMAIL ---\n");

      toast({ title: "Operação Concluída!", description: "Contrato e documentos enviados com sucesso (simulado).", className: "bg-primary text-primary-foreground border-primary-foreground/30"});
      router.push("/confirmation");

    } catch (error) {
      console.error("Submission Error:", error);
      toast({ title: "Erro no Envio", description: "Não foi possível enviar os dados. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrepareForPrint = () => {
    if (isPrintDisabled()){
       toast({ title: "Ação Necessária", description: "Complete todas as etapas obrigatórias para preparar a impressão.", variant: "destructive" });
       return;
    }

    try {
      const printData = {
        extractedData: extractedData,
        responsavel: { 
          nome: responsavelNome,
          cpf: responsavelCpf,
          telefone: responsavelTelefone,
          email: responsavelEmail,
        }
      };
      localStorage.setItem('contractPrintData', JSON.stringify(printData));
      router.push('/print-contract');
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      toast({ title: "Erro", description: "Não foi possível preparar os dados para impressão.", variant: "destructive" });
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

  const isSubmitDisabled = () => {
    if (isSubmitting) return true;
    if (!responsavelNome || !responsavelCpf || !responsavelTelefone || !responsavelEmail) return true;
    if (attachedDocuments.length < MIN_DOCUMENTS) return true;

    if (contractSourceType === 'new') {
      return !photoVerified || !extractedData || isVerifyingPhoto || isExtractingData;
    }
    if (contractSourceType === 'existing') {
      return !extractedData; 
    }
    return true; 
  };
  
  const isPrintDisabled = () => {
    if (!responsavelNome || !responsavelCpf || !responsavelTelefone || !responsavelEmail) return true; 
    if (attachedDocuments.length < MIN_DOCUMENTS) return true; 

    if (contractSourceType === 'new') {
      if (!photoVerified) return true; 
      if (!extractedData) return true; 
    } else if (contractSourceType === 'existing') {
      if (!extractedData) return true; 
    } else {
      return true; 
    }
    
    return false; 
  };


  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-background p-6 sm:p-12 selection:bg-primary/20">
      <div className="w-full max-w-3xl space-y-10">
        <header className="text-center py-8">
          <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
            CONTRATOS EM FOCO
          </div>
          <p className="mt-2 text-xl text-muted-foreground font-headline">
            “O Código é Você.”
          </p>
          <p className="mt-3 text-base text-foreground/80 max-w-xl mx-auto">
            Eleve sua gestão de contratos a um novo patamar com análise inteligente e processos simplificados.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center text-2xl font-headline text-primary">
                <FileSearch className="mr-3 h-7 w-7" /> Origem do Contrato
              </CardTitle>
              <CardDescription className="text-foreground/70 pt-1">Escolha entre enviar um novo contrato por foto ou selecionar um modelo pré-definido.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <RadioGroup
                value={contractSourceType}
                onValueChange={(value: 'new' | 'existing') => {
                  setContractSourceType(value);
                  setContractPhoto(null);
                  setContractPhotoPreview(null);
                  setPhotoVerificationResult(null);
                  setPhotoVerified(false);
                  setExtractedData(null);
                  if (contractPhotoInputRef.current) {
                    contractPhotoInputRef.current.value = ""; 
                  }
                }}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
                  <RadioGroupItem value="new" id="source-new" className="border-primary/50 text-primary focus:ring-primary" />
                  <Label htmlFor="source-new" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Novo Contrato <span className="text-sm text-muted-foreground">(Enviar Foto)</span></Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
                  <RadioGroupItem value="existing" id="source-existing" className="border-primary/50 text-primary focus:ring-primary" />
                  <Label htmlFor="source-existing" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Contrato Existente <span className="text-sm text-muted-foreground">(Selecionar Modelo)</span></Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
          
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center text-2xl font-headline text-primary">
                <UserRound className="mr-3 h-7 w-7" /> Informações do Comprador
              </CardTitle>
              <CardDescription className="text-foreground/70 pt-1">Dados da parte que assinará como comprador, para preenchimento automático do contrato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-0">
              <div>
                <Label htmlFor="responsavel-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
                <Input id="responsavel-nome" value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} placeholder="Nome completo do comprador" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="responsavel-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">CPF</Label>
                  <Input id="responsavel-cpf" value={responsavelCpf} onChange={(e) => setResponsavelCpf(e.target.value)} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
                </div>
                <div>
                  <Label htmlFor="responsavel-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Telefone (WhatsApp)</Label>
                  <Input id="responsavel-telefone" type="tel" value={responsavelTelefone} onChange={(e) => setResponsavelTelefone(e.target.value)} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
                </div>
              </div>
              <div>
                <Label htmlFor="responsavel-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
                <Input id="responsavel-email" type="email" value={responsavelEmail} onChange={(e) => setResponsavelEmail(e.target.value)} placeholder="seu.email@dominio.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
              </div>
            </CardContent>
          </Card>


          {contractSourceType === 'new' && (
            <>
              <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="p-6">
                  <CardTitle className="flex items-center text-2xl font-headline text-primary"><Camera className="mr-3 h-7 w-7" />Etapa 1: Foto do Contrato</CardTitle>
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
                    <p id="contract-photo-hint" className="mt-2 text-xs text-muted-foreground">Use a câmera ou selecione um arquivo de imagem.</p>
                  </div>
                  {contractPhotoPreview && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2 uppercase tracking-wider text-foreground/90">Pré-visualização:</p>
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/30 bg-background/50 flex items-center justify-center" data-ai-hint="contract document">
                        <Image src={contractPhotoPreview} alt="Pré-visualização do contrato" layout="fill" objectFit="contain" />
                      </div>
                    </div>
                  )}
                </CardContent>
                {contractPhoto && !photoVerified && (
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
              
              {photoVerificationResult && (
                <Card className={`shadow-card-premium rounded-2xl border-2 ${photoVerificationResult.isCompleteAndClear ? "border-green-500/70" : "border-red-500/70"} bg-card/80 backdrop-blur-sm`}>
                  <CardHeader className="p-6">
                    <CardTitle className="flex items-center font-headline text-xl">
                      {photoVerificationResult.isCompleteAndClear ? <CheckCircle2 className="mr-3 h-7 w-7 text-green-400" /> : <AlertTriangle className="mr-3 h-7 w-7 text-red-400" />}
                      Resultado da Verificação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6 pt-0">
                    <p className="text-base text-foreground/90">{photoVerificationResult.reason || (photoVerificationResult.isCompleteAndClear ? "A foto parece nítida e completa." : "A foto precisa de ajustes.")}</p>
                    {!photoVerificationResult.isCompleteAndClear && (
                      <Button type="button" onClick={() => contractPhotoInputRef.current?.click()} variant="outline" className="w-full border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
                        <Camera className="mr-2 h-5 w-5" /> Tentar Novamente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {(photoVerified && !isExtractingData) && (
                <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="p-6">
                    <CardTitle className="flex items-center text-2xl font-headline text-primary"><ScanText className="mr-3 h-7 w-7" />Etapa 1.5: Análise do Contrato</CardTitle>
                    <CardDescription className="text-foreground/70 pt-1">
                      {extractedData ? "Dados extraídos. Clique abaixo para reanalisar se necessário." : "Foto verificada. Prossiga para extrair informações chave do contrato."}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="p-6">
                    <Button type="button" onClick={handleExtractContractData} disabled={isVerifyingPhoto || isExtractingData}  className="w-full bg-gradient-to-br from-accent to-blue-700 hover:from-accent/90 hover:to-blue-700/90 text-lg py-6 rounded-lg text-accent-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
                       {isExtractingData ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" /> }
                       {extractedData ? "Reanalisar Contrato com IA" : "Analisar Contrato com IA"}
                    </Button>
                  </CardFooter>
                </Card>
              )}


              {isExtractingData && (
                <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
                  <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-muted-foreground font-medium text-lg">Analisando contrato e extraindo dados...</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {contractSourceType === 'existing' && (
            <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center text-2xl font-headline text-primary">
                  <ListChecks className="mr-3 h-7 w-7" /> Selecionar Modelo de Contrato
                </CardTitle>
                <CardDescription className="text-foreground/70 pt-1">Escolha um modelo pré-definido para carregar dados de exemplo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6 pt-0">
                 <Button 
                    type="button" 
                    onClick={handleSelectExistingContract} 
                    variant="outline"
                    className="w-full border-primary/80 text-primary hover:bg-primary/10 text-base py-4 rounded-lg flex justify-between items-center group"
                  >
                    <div className="flex items-center">
                      <FileText className="mr-3 h-5 w-5" /> 
                      Modelo de Compra de Produto Digital (Pablo Marçal)
                    </div>
                    <ChevronRight className="h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
                  </Button>
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Simulação: Funcionalidade completa de listagem de contratos salvos será implementada futuramente.
                  </p>
              </CardContent>
            </Card>
          )}

          {extractedData && (
            <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center font-headline text-xl text-primary"><ScanText className="mr-3 h-7 w-7" />Dados Extraídos / Carregados</CardTitle>
                <CardDescription className="text-foreground/70 pt-1">Informações do contrato. Para impressão, os dados do "Comprador" informados acima serão utilizados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm p-6 pt-0 text-foreground/80 leading-relaxed">
                {isExtractedDataEmpty(extractedData) ? (
                   <p className="text-muted-foreground">Nenhum dado específico extraído. {contractSourceType === 'new' && "Verifique a qualidade da imagem."}</p>
                ) : (
                  <ul className="space-y-2">
                    {extractedData.nomesDasPartes && extractedData.nomesDasPartes.length > 0 && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Partes:</strong> {extractedData.nomesDasPartes.join('; ')}</li>
                    )}
                    {extractedData.documentosDasPartes && extractedData.documentosDasPartes.length > 0 && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Documentos das Partes:</strong> {extractedData.documentosDasPartes.join('; ')}</li>
                    )}
                    {extractedData.objetoDoContrato && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Objeto:</strong> {extractedData.objetoDoContrato}</li>
                    )}
                    {extractedData.valorPrincipal && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Valor:</strong> {extractedData.valorPrincipal}</li>
                    )}
                    {extractedData.condicoesDePagamento && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Pagamento:</strong> {extractedData.condicoesDePagamento}</li>
                    )}
                    {extractedData.prazoContrato && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Prazo:</strong> {extractedData.prazoContrato}</li>
                    )}
                    {extractedData.localEDataAssinatura && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Local e Data:</strong> {extractedData.localEDataAssinatura}</li>
                    )}
                    {extractedData.foroEleito && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Foro:</strong> {extractedData.foroEleito}</li>
                    )}
                    {extractedData.outrasObservacoesRelevantes && (
                      <li><strong className="text-primary/80 uppercase tracking-wider text-xs">Obs.:</strong> {extractedData.outrasObservacoesRelevantes}</li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
              <CardTitle className="flex items-center text-2xl font-headline text-primary"><Paperclip className="mr-3 h-7 w-7" />Etapa 2: Documentos Comprobatórios</CardTitle>
              <CardDescription className="text-foreground/70 pt-1">Anexe os documentos (RG, CNH, CPF, etc.). Mínimo de {MIN_DOCUMENTS}, máximo de {MAX_DOCUMENTS}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-0">
              <div>
                <Label htmlFor="document-input" className="mb-2 block text-sm font-medium uppercase tracking-wider text-foreground/90">Adicionar documentos</Label>
                <Input
                  id="document-input"
                  type="file"
                  multiple
                  onChange={handleDocumentChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-2.5"
                  aria-describedby="document-hint"
                  disabled={attachedDocuments.length >= MAX_DOCUMENTS}
                />
                <p id="document-hint" className="mt-2 text-xs text-muted-foreground">
                  {attachedDocuments.length >= MAX_DOCUMENTS 
                    ? `Limite de ${MAX_DOCUMENTS} documentos atingido.`
                    : `Você pode anexar até ${MAX_DOCUMENTS}. (${attachedDocuments.length}/${MAX_DOCUMENTS} anexados)`}
                </p>
              </div>
              {attachedDocuments.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium uppercase tracking-wider text-foreground/90">Documentos Anexados:</h4>
                  <ul className="list-none space-y-2">
                    {attachedDocuments.map((doc, index) => (
                      <li key={index} className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background/50 hover:border-primary/50 transition-colors">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileText className="h-6 w-6 text-primary shrink-0" />
                          <span className="truncate text-sm font-medium text-foreground/90">{doc.name}</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(index)} aria-label={`Remover ${doc.name}`} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
             <CardHeader className="p-6">
                <CardTitle className="flex items-center text-2xl font-headline text-primary"><PrinterIcon className="mr-3 h-7 w-7" />Etapa 3: Preparar para Impressão</CardTitle>
                <CardDescription className="text-foreground/70 pt-1">Após completar as etapas anteriores, prepare o contrato para impressão.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
                 <Button type="button" onClick={handlePrepareForPrint} className="w-full bg-gradient-to-br from-green-600 to-green-800 hover:from-green-600/90 hover:to-green-800/90 text-lg py-6 rounded-lg text-white shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted" disabled={isPrintDisabled()}>
                    <PrinterIcon className="mr-2 h-6 w-6" /> Preparar Contrato para Impressão
                </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
                <CardTitle className="flex items-center text-2xl font-headline text-primary"><UploadCloud className="mr-3 h-7 w-7" />Etapa 4: Enviar Processo</CardTitle>
                <CardDescription className="text-foreground/70 pt-1">Revise tudo e envie o contrato e os documentos para finalização.</CardDescription>
            </CardHeader>
            <CardFooter className="p-6">
              <Button type="submit" disabled={isSubmitDisabled()} className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted">
                {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
                {isSubmitting ? "Enviando..." : "Enviar Contrato e Documentos"}
              </Button>
            </CardFooter>
          </Card>
        </form>
        <footer className="text-center py-12 mt-10 border-t border-border/30">
            <div className="mb-8">
                <h3 className="text-lg font-headline text-primary mb-4 uppercase tracking-wider">Precisa de Ajuda?</h3>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                    {[
                        {label: "Time de Vendas", icon: Users},
                        {label: "Financeiro", icon: Banknote},
                        {label: "Jurídico", icon: Scale},
                        {label: "Contratual", icon: FileText},
                        {label: "Suporte Geral", icon: LifeBuoy}
                    ].map(item => (
                        <Button key={item.label} variant="outline" size="lg" asChild className="text-foreground/80 hover:text-primary hover:border-primary/70 bg-card/70 border-border/50 hover:bg-card text-sm rounded-lg py-3 px-5 transition-all hover:shadow-md">
                            <a href="#"> <item.icon className="mr-2 h-5 w-5" /> {item.label} </a>
                        </Button>
                    ))}
                </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">© {new Date().getFullYear()} Financeiro Pablo Marçal - Todos os direitos reservados.</p>
            <p className="mt-1 text-xs text-muted-foreground">Uma solução SAAS com Inteligência Artificial treinada por CFO - Antônio Fogaça.</p>
        </footer>
      </div>
    </main>
  );
}
