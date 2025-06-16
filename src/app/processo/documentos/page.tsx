
"use client";

import { useState, useEffect, ChangeEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { 
  StoredProcessState, 
  loadProcessState, 
  saveProcessState, 
  initialStoredProcessState,
  DocumentFile,
  BuyerType,
  CompanyInfo,
  BuyerInfo
} from "@/lib/process-store";
import { extractBuyerDocumentData, type ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowRight, ArrowLeft, Paperclip, FileText, Trash2, ScanSearch, Loader2, Building, UserCircle } from "lucide-react";

const MIN_DOCUMENTS_PF = 2; // e.g., RG (frente+verso) or CNH (frente+verso) counts as 1 set, plus comprovante
const MIN_DOCUMENTS_PJ = 2; // e.g., Cartao CNPJ, Doc Socio (frente+verso), plus comprovante

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

type DocumentSlotKey = Exclude<keyof StoredProcessState, 
  | "currentStep" | "contractSourceType" | "selectedPlayer" | "selectedContractTemplateName" 
  | "buyerType" | "buyerInfo" | "companyInfo" | "internalTeamMemberInfo" 
  | "contractPhotoPreview" | "contractPhotoName" | "photoVerificationResult" | "photoVerified" 
  | "extractedData" | "signedContractPhotoPreview" | "signedContractPhotoName"
>;


export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [analyzingDocKey, setAnalyzingDocKey] = useState<DocumentSlotKey | null>(null);
  const [localFiles, setLocalFiles] = useState<Record<DocumentSlotKey, File | null>>({});

  useEffect(() => {
    const loadedState = loadProcessState();
    if (!loadedState.companyInfo && loadedState.buyerType === 'pj') {
      loadedState.companyInfo = { razaoSocial: '', nomeFantasia: '', cnpj: '' };
    }
    setProcessState(loadedState);
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, docKey: DocumentSlotKey) => {
    const file = event.target.files?.[0];
    if (file) {
      setLocalFiles(prev => ({...prev, [docKey]: file}));
      try {
        const previewUrl = await fileToDataUri(file);
        setProcessState(prevState => ({
          ...prevState,
          [docKey]: {
            name: file.name,
            previewUrl: previewUrl,
            analysisResult: prevState[docKey]?.analysisResult // Preserve existing analysis if re-uploading
          } as DocumentFile
        }));
      } catch (error) {
        toast({ title: "Erro ao carregar imagem", description: "Não foi possível gerar a pré-visualização.", variant: "destructive" });
      }
    }
  };

  const removeDocument = (docKey: DocumentSlotKey) => {
    setProcessState(prevState => ({
      ...prevState,
      [docKey]: null
    }));
    setLocalFiles(prev => ({...prev, [docKey]: null}));
  };

  const handleAnalyzeDocument = async (docKey: DocumentSlotKey) => {
    const currentDocFile = processState[docKey] as DocumentFile | null;
    const localFile = localFiles[docKey];

    if (!currentDocFile?.previewUrl && !localFile) {
      toast({ title: "Arquivo não encontrado", description: "Carregue um arquivo para ser analisado.", variant: "destructive"});
      return;
    }
    setAnalyzingDocKey(docKey);
    try {
      let photoDataUri = currentDocFile?.previewUrl;
      if (localFile && !photoDataUri) { // If preview wasn't set due to quick succession or if file changed
         photoDataUri = await fileToDataUri(localFile);
      }
      if (!photoDataUri) {
        throw new Error("Não foi possível obter os dados da imagem para análise.");
      }

      const result = await extractBuyerDocumentData({ photoDataUri });
      
      setProcessState(prevState => ({
        ...prevState,
        [docKey]: {
          ...(prevState[docKey] as DocumentFile),
          analysisResult: result,
        }
      }));
      toast({ 
        title: `Análise de ${currentDocFile?.name || docKey} Concluída!`, 
        description: "Dados extraídos do documento. Verifique abaixo.",
        className: "bg-secondary text-secondary-foreground border-secondary"
      });

    } catch (error) {
      console.error(`AI Document Analysis Error for ${docKey}:`, error);
      setProcessState(prevState => ({
        ...prevState,
        [docKey]: {
          ...(prevState[docKey] as DocumentFile),
          analysisResult: { error: `Falha ao analisar: ${(error as Error).message || "Erro desconhecido"}` },
        }
      }));
      toast({ title: `Erro na Análise de ${currentDocFile?.name || docKey}`, description: "Não foi possível extrair os dados. Tente novamente ou verifique a imagem.", variant: "destructive" });
    } finally {
      setAnalyzingDocKey(null);
    }
  };
  
  const validateStep = useCallback(() => {
    let requiredDocsCount = 0;
    if (processState.buyerType === 'pf') {
      if (processState.rgFrente && processState.rgVerso) requiredDocsCount++;
      else if (processState.cnhFrente && processState.cnhVerso) requiredDocsCount++;
      if (processState.comprovanteEndereco) requiredDocsCount++;
      if (requiredDocsCount < MIN_DOCUMENTS_PF) {
        toast({ title: "Documentos Insuficientes (PF)", description: `Anexe RG (frente e verso) ou CNH (frente e verso), e um comprovante de endereço.`, variant: "destructive" });
        return false;
      }
    } else { // PJ
      if (!processState.companyInfo?.razaoSocial || !processState.companyInfo?.cnpj) {
        toast({ title: "Dados da Empresa Incompletos", description: "Preencha Razão Social e CNPJ da empresa.", variant: "destructive"});
        return false;
      }
      if (!processState.buyerInfo.nome || !processState.buyerInfo.cpf) {
        toast({ title: "Dados do Representante Incompletos", description: "Preencha Nome e CPF do representante legal.", variant: "destructive"});
        return false;
      }
      if (processState.cartaoCnpjFile) requiredDocsCount++;
      if (processState.docSocioFrente && processState.docSocioVerso) requiredDocsCount++;
      if (processState.comprovanteEndereco) requiredDocsCount++;
      if (requiredDocsCount < MIN_DOCUMENTS_PJ) {
         toast({ title: "Documentos Insuficientes (PJ)", description: `Anexe Cartão CNPJ, Documento do Sócio (frente e verso), e Comprovante de Endereço da empresa.`, variant: "destructive" });
        return false;
      }
    }
    return true;
  }, [processState]);

  const handleNext = () => {
    if (!validateStep()) return;
    saveProcessState({ ...processState, currentStep: "/processo/revisao-envio" });
    toast({
      title: "Etapa 3 Concluída!",
      description: "Documentos e informações do comprador/empresa salvos.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push("/processo/revisao-envio");
  };

  const handleBack = () => {
    saveProcessState(processState);
    const prevStep = processState.contractSourceType === 'new' ? "/processo/foto-contrato" : "/processo/dados-iniciais"; 
    router.push(prevStep);
  };

  const handleBuyerTypeChange = (value: BuyerType) => {
    setProcessState(prevState => ({
      ...prevState,
      buyerType: value,
      companyInfo: value === 'pj' ? (prevState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) : null,
      // Optionally clear buyerInfo if switching from PJ rep to PF, or vice-versa, or let user manage
    }));
  };
  
  const handleCompanyInfoChange = (e: ChangeEvent<HTMLInputElement>, field: keyof CompanyInfo) => {
    setProcessState(prevState => ({
      ...prevState,
      companyInfo: {
        ...(prevState.companyInfo as CompanyInfo),
        [field]: e.target.value,
      }
    }));
  };
  
  const handleBuyerInfoChange = (e: ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    setProcessState(prevState => ({
      ...prevState,
      buyerInfo: {
        ...(prevState.buyerInfo as BuyerInfo),
        [field]: e.target.value,
      }
    }));
  };

  const renderDocumentSlot = (docKey: DocumentSlotKey, label: string) => {
    const currentDoc = processState[docKey] as DocumentFile | null;
    const isAnalyzing = analyzingDocKey === docKey;

    return (
      <div className="p-4 border border-border/50 rounded-lg bg-background/30 space-y-3">
        <Label htmlFor={docKey} className="text-base font-medium text-foreground/90">{label}</Label>
        {currentDoc?.previewUrl && (
          <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden border border-dashed border-primary/30">
            <Image src={currentDoc.previewUrl} alt={`Pré-visualização de ${label}`} layout="fill" objectFit="contain" />
          </div>
        )}
        <Input
          id={docKey}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, docKey)}
          className="file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
        />
        {currentDoc && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground truncate max-w-[calc(100%-150px)]">{currentDoc.name}</span>
            <div className="flex items-center space-x-2">
              <Button 
                type="button" variant="outline" size="sm" 
                onClick={() => handleAnalyzeDocument(docKey)}
                disabled={isAnalyzing || !currentDoc.previewUrl}
                className="border-accent/80 text-accent hover:bg-accent/10 text-xs py-1 px-2"
              >
                {isAnalyzing ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <ScanSearch className="mr-1 h-3 w-3"/>}
                {isAnalyzing ? "Analisando..." : (currentDoc.analysisResult ? "Reanalisar" : "Analisar IA")}
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(docKey)} className="text-destructive/70 hover:text-destructive h-7 w-7">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {currentDoc?.analysisResult && (
          <div className="mt-2 p-2 border-t border-border/30 text-xs space-y-1 bg-muted/20 rounded-b-md">
            <p className="font-semibold text-primary/80">Dados Extraídos:</p>
            {(currentDoc.analysisResult as any).error ? <p className="text-destructive">{(currentDoc.analysisResult as any).error}</p> : <>
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeCompleto && <p><strong>Nome:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeCompleto}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).cpf && <p><strong>CPF:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).cpf}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).dataNascimento && <p><strong>Nasc.:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).dataNascimento}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeMae && <p><strong>Mãe:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeMae}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).rg && <p><strong>RG:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).rg}</p>}
            </>}
          </div>
        )}
      </div>
    );
  };
  

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
          Passo 3: Documentos e Dados do Comprador
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><Paperclip className="mr-3 h-7 w-7" />Tipo de Comprador</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <RadioGroup
            value={processState.buyerType}
            onValueChange={(val) => handleBuyerTypeChange(val as BuyerType)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30">
              <RadioGroupItem value="pf" id="type-pf" className="border-primary/50 text-primary focus:ring-primary"/>
              <Label htmlFor="type-pf" className="font-medium text-lg cursor-pointer flex items-center"><UserCircle className="mr-2 h-5 w-5"/>Pessoa Física</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30">
              <RadioGroupItem value="pj" id="type-pj" className="border-primary/50 text-primary focus:ring-primary"/>
              <Label htmlFor="type-pj" className="font-medium text-lg cursor-pointer flex items-center"><Building className="mr-2 h-5 w-5"/>Pessoa Jurídica</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {processState.buyerType === 'pj' && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-xl font-headline text-primary"><Building className="mr-3 h-6 w-6" />Dados da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div>
              <Label htmlFor="razaoSocial">Razão Social</Label>
              <Input id="razaoSocial" value={processState.companyInfo?.razaoSocial || ''} onChange={(e) => handleCompanyInfoChange(e, 'razaoSocial')} className="mt-1 bg-input"/>
            </div>
            <div>
              <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
              <Input id="nomeFantasia" value={processState.companyInfo?.nomeFantasia || ''} onChange={(e) => handleCompanyInfoChange(e, 'nomeFantasia')} className="mt-1 bg-input"/>
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={processState.companyInfo?.cnpj || ''} onChange={(e) => handleCompanyInfoChange(e, 'cnpj')} className="mt-1 bg-input"/>
            </div>
             {renderDocumentSlot('cartaoCnpjFile', 'Cartão CNPJ')}
          </CardContent>
        </Card>
      )}
      
      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-xl font-headline text-primary">
            <UserCircle className="mr-3 h-6 w-6" />
            {processState.buyerType === 'pf' ? "Dados Pessoais e Documentos do Comprador" : "Dados Pessoais e Documentos do Representante Legal/Sócio"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          {processState.buyerType === 'pj' && ( // Only show name/cpf inputs for PJ rep here; PF data is on next page
            <>
              <div>
                <Label htmlFor="repNome">Nome Completo do Representante</Label>
                <Input id="repNome" value={processState.buyerInfo.nome} onChange={(e) => handleBuyerInfoChange(e, 'nome')} className="mt-1 bg-input"/>
              </div>
              <div>
                <Label htmlFor="repCPF">CPF do Representante</Label>
                <Input id="repCPF" value={processState.buyerInfo.cpf} onChange={(e) => handleBuyerInfoChange(e, 'cpf')} className="mt-1 bg-input"/>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processState.buyerType === 'pf' ? renderDocumentSlot('rgFrente', 'RG (Frente)') : renderDocumentSlot('docSocioFrente', 'Doc. Representante (Frente)')}
            {processState.buyerType === 'pf' ? renderDocumentSlot('rgVerso', 'RG (Verso)') : renderDocumentSlot('docSocioVerso', 'Doc. Representante (Verso)')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {processState.buyerType === 'pf' && renderDocumentSlot('cnhFrente', 'CNH (Frente)')}
            {processState.buyerType === 'pf' && renderDocumentSlot('cnhVerso', 'CNH (Verso)')}
          </div>
          {renderDocumentSlot('comprovanteEndereco', processState.buyerType === 'pf' ? 'Comprovante de Endereço Pessoal' : 'Comprovante de Endereço da Empresa')}
        </CardContent>
      </Card>

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
          disabled={analyzingDocKey !== null}
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Próximo <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
