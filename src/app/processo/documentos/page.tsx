
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
  BuyerInfo,
  PfDocumentType
} from "@/lib/process-store";
import { extractBuyerDocumentData, type ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowRight, ArrowLeft, Paperclip, FileText, Trash2, ScanSearch, Loader2, Building, UserCircle, FileBadge, FileBadge2 } from "lucide-react";

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

type DocumentSlotKey = Extract<keyof StoredProcessState, 
  | "rgAntigoFrente" | "rgAntigoVerso" 
  | "cnhAntigaFrente" | "cnhAntigaVerso" 
  | "cartaoCnpjFile" | "docSocioFrente" | "docSocioVerso" | "comprovanteEndereco"
>;

const pfDocOptions: { value: PfDocumentType; label: string; icon: React.ElementType }[] = [
  { value: 'rgAntigo', label: 'RG (Antigo)', icon: FileBadge },
  { value: 'cnhAntiga', label: 'CNH (Antiga)', icon: FileBadge2 },
];

export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [analyzingDocKey, setAnalyzingDocKey] = useState<DocumentSlotKey | null>(null);
  // localFiles stores File objects for newly selected files, not for those loaded from localStorage (data URIs)
  const [localFiles, setLocalFiles] = useState<Partial<Record<DocumentSlotKey, File | null>>>({});
  const [selectedPfDocType, setSelectedPfDocType] = useState<PfDocumentType | ''>('');
  const [isNavigatingNext, setIsNavigatingNext] = useState(false);

  useEffect(() => {
    const loadedState = loadProcessState();
    if (!loadedState.companyInfo && loadedState.buyerType === 'pj') {
      loadedState.companyInfo = { razaoSocial: '', nomeFantasia: '', cnpj: '' };
    }
    setProcessState(loadedState);
    if (loadedState.buyerType === 'pf') {
      if (loadedState.rgAntigoFrente || loadedState.rgAntigoVerso) setSelectedPfDocType('rgAntigo');
      else if (loadedState.cnhAntigaFrente || loadedState.cnhAntigaVerso) setSelectedPfDocType('cnhAntiga');
    }
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, docKey: DocumentSlotKey) => {
    const file = event.target.files?.[0];
    const inputElement = event.target; 

    if (file) {
      setLocalFiles(prev => ({ ...prev, [docKey]: file })); // Keep local file object for potential re-analysis if needed
      try {
        const dataUri = await fileToDataUri(file);
        const newState = {
          ...processState,
          [docKey]: {
            name: file.name,
            previewUrl: dataUri, // Store data URI
            analysisResult: processState[docKey]?.analysisResult // Preserve existing analysis if any
          } as DocumentFile
        };
        setProcessState(newState);
        saveProcessState(newState); // Attempt to save to localStorage immediately
      } catch (error) {
        console.error(`Error processing file for ${docKey}:`, error);
        toast({ 
          title: "Erro ao Processar Imagem", 
          description: `Não foi possível gerar a pré-visualização para ${file.name}. Por favor, tente novamente ou escolha outro arquivo.`, 
          variant: "destructive" 
        });
        const newState = {
          ...processState,
          [docKey]: null 
        };
        setProcessState(newState);
        saveProcessState(newState);
        setLocalFiles(prev => ({ ...prev, [docKey]: null }));
        if (inputElement) {
          inputElement.value = "";
        }
      }
    } else {
      // If no file is selected (e.g., user cancels file dialog), clear the stored document for this key
      if (inputElement && inputElement.files && inputElement.files.length === 0) {
         const newState = {
          ...processState,
          [docKey]: null
        };
        setProcessState(newState);
        saveProcessState(newState);
        setLocalFiles(prev => ({ ...prev, [docKey]: null }));
      }
    }
  };

  const removeDocument = (docKey: DocumentSlotKey) => {
    const newState = {
      ...processState,
      [docKey]: null
    };
    setProcessState(newState);
    saveProcessState(newState);
    setLocalFiles(prev => ({...prev, [docKey]: null}));
     // Also clear the corresponding file input element if it exists
    const inputElement = document.getElementById(docKey) as HTMLInputElement | null;
    if (inputElement) {
        inputElement.value = "";
    }
  };

  const handleAnalyzeDocument = async (docKey: DocumentSlotKey) => {
    // Use processState[docKey].previewUrl (data URI) for analysis
    const currentDocInState = processState[docKey] as DocumentFile | null;
    const photoDataUri = currentDocInState?.previewUrl;
    const docName = currentDocInState?.name;
    
    if (!photoDataUri) {
      toast({ title: "Arquivo não encontrado", description: "Carregue um arquivo para ser analisado.", variant: "destructive"});
      setAnalyzingDocKey(null);
      return;
    }

    setAnalyzingDocKey(docKey);
    try {
      const result = await extractBuyerDocumentData({ photoDataUri });
      
      const newState = {
        ...processState,
        [docKey]: {
          name: docName, 
          previewUrl: photoDataUri, 
          analysisResult: result,
        } as DocumentFile, 
      };
      setProcessState(newState);
      saveProcessState(newState);

      toast({ 
        title: `Análise de ${docName || docKey} Concluída!`, 
        description: "Dados extraídos do documento. Verifique abaixo.",
        className: "bg-secondary text-secondary-foreground border-secondary"
      });

    } catch (error: any) {
      console.error(`AI Document Analysis Error for ${docKey} (${docName}):`, error);
      
      let userFriendlyErrorMessage = "A IA não conseguiu processar o documento. Verifique a qualidade da imagem ou tente novamente.";
      if (error?.message?.includes("An error occurred in the Server Components render") || error?.message?.includes("flow execution failed")) {
         userFriendlyErrorMessage = "Falha ao analisar: A IA não conseguiu processar este documento. Tente uma imagem mais nítida, verifique os logs do Genkit ou se o documento é suportado.";
      }

      const newState = {
        ...processState,
        [docKey]: {
          name: docName,
          previewUrl: photoDataUri,
          analysisResult: { error: userFriendlyErrorMessage },
        } as DocumentFile,
      };
      setProcessState(newState);
      saveProcessState(newState);
      toast({ 
        title: `Erro na Análise de ${docName || docKey}`, 
        description: userFriendlyErrorMessage,
        variant: "destructive" 
      });
    } finally {
      setAnalyzingDocKey(null);
    }
  };
  
  const validateStep = useCallback(() => {
    if (processState.buyerType === 'pf') {
      if (!selectedPfDocType) {
        toast({ title: "Tipo de Documento Necessário", description: "Selecione um tipo de documento pessoal para anexar.", variant: "destructive" });
        return false;
      }
      let docIsValid = false;
      switch(selectedPfDocType) {
        case 'rgAntigo':
          docIsValid = !!(processState.rgAntigoFrente?.previewUrl && processState.rgAntigoVerso?.previewUrl);
          break;
        case 'cnhAntiga':
          docIsValid = !!(processState.cnhAntigaFrente?.previewUrl && processState.cnhAntigaVerso?.previewUrl);
          break;
      }
      if (!docIsValid) {
        const docLabel = pfDocOptions.find(opt => opt.value === selectedPfDocType)?.label || 'Documento Pessoal';
        toast({ title: `Documentos Insuficientes (${docLabel})`, description: `Anexe frente e verso do ${docLabel}.`, variant: "destructive" });
        return false;
      }
      if (!processState.comprovanteEndereco?.previewUrl) {
        toast({ title: "Comprovante de Endereço Necessário", description: "Anexe um comprovante de endereço.", variant: "destructive" });
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
      if (!processState.cartaoCnpjFile?.previewUrl || !(processState.docSocioFrente?.previewUrl && processState.docSocioVerso?.previewUrl) || !processState.comprovanteEndereco?.previewUrl) {
         toast({ title: "Documentos Insuficientes (PJ)", description: `Anexe Cartão CNPJ, Documento do Sócio (frente e verso), e Comprovante de Endereço da empresa.`, variant: "destructive" });
        return false;
      }
    }
    return true;
  }, [processState, selectedPfDocType, toast]);

  const handleNext = () => {
    if (!validateStep()) return;
    setIsNavigatingNext(true);
    saveProcessState({ ...processState, currentStep: "/processo/revisao-envio" });
    toast({
      title: "Etapa 3 Concluída!",
      description: "Documentos e informações salvos. Carregando próxima etapa...",
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
    const newState = {
      ...processState,
      buyerType: value,
      companyInfo: value === 'pj' ? (processState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) : null,
      // Clear PF docs if switching to PJ, and vice-versa for PJ docs
      rgAntigoFrente: value === 'pj' ? null : processState.rgAntigoFrente,
      rgAntigoVerso: value === 'pj' ? null : processState.rgAntigoVerso,
      cnhAntigaFrente: value === 'pj' ? null : processState.cnhAntigaFrente,
      cnhAntigaVerso: value === 'pj' ? null : processState.cnhAntigaVerso,
      cartaoCnpjFile: value === 'pf' ? null : processState.cartaoCnpjFile,
      docSocioFrente: value === 'pf' ? null : processState.docSocioFrente,
      docSocioVerso: value === 'pf' ? null : processState.docSocioVerso,
    };
    setProcessState(newState);
    saveProcessState(newState);
    if (value === 'pj') {
      setSelectedPfDocType(''); 
    }
  };

  const handlePfDocTypeChange = (value: PfDocumentType) => {
    setSelectedPfDocType(value);
    const newState = {...processState};
    const allPfDocKeys: (keyof StoredProcessState)[] = [
      'rgAntigoFrente', 'rgAntigoVerso',
      'cnhAntigaFrente', 'cnhAntigaVerso',
    ];
    const localFilesToClear: Partial<Record<DocumentSlotKey, null>> = {};

    allPfDocKeys.forEach(key => {
      let shouldClear = true;
      if (value === 'rgAntigo' && (key === 'rgAntigoFrente' || key === 'rgAntigoVerso')) shouldClear = false;
      else if (value === 'cnhAntiga' && (key === 'cnhAntigaFrente' || key === 'cnhAntigaVerso')) shouldClear = false;
      
      if (shouldClear) {
        newState[key] = null;
        localFilesToClear[key as DocumentSlotKey] = null;
      }
    });
    setProcessState(newState);
    saveProcessState(newState);
    setLocalFiles(prevLocals => ({...prevLocals, ...localFilesToClear}));
  };
  
  const handleCompanyInfoChange = (e: ChangeEvent<HTMLInputElement>, field: keyof CompanyInfo) => {
    const newState = {
      ...processState,
      companyInfo: {
        ...(processState.companyInfo as CompanyInfo), 
        [field]: e.target.value,
      }
    };
    setProcessState(newState);
    saveProcessState(newState);
  };
  
  const handleBuyerInfoChange = (e: ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    const newState = {
      ...processState,
      buyerInfo: {
        ...(processState.buyerInfo as BuyerInfo),
        [field]: e.target.value,
      }
    };
    setProcessState(newState);
    saveProcessState(newState);
  };

  const renderDocumentSlot = (docKey: DocumentSlotKey, label: string) => {
    const currentDoc = processState[docKey] as DocumentFile | null;
    const isAnalyzing = analyzingDocKey === docKey;
    const displayDocName = currentDoc?.name;
    const displayPreviewUrl = currentDoc?.previewUrl; 
    const isPdf = displayDocName?.toLowerCase().endsWith('.pdf');

    return (
      <div className="p-4 border border-border/50 rounded-lg bg-background/30 space-y-3">
        <Label htmlFor={docKey} className="text-base font-medium text-foreground/90">{label}</Label>
        {displayPreviewUrl && !isPdf && (
          <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden border border-dashed border-primary/30">
            <Image src={displayPreviewUrl} alt={`Pré-visualização de ${label}`} layout="fill" objectFit="contain" />
          </div>
        )}
        {displayPreviewUrl && isPdf && (
            <div className="p-4 text-center text-muted-foreground border border-dashed border-primary/30 rounded-md">
                <FileText className="mx-auto h-12 w-12 mb-2" />
                PDF carregado: {displayDocName}. Pré-visualização não disponível.
            </div>
        )}
        <Input
          id={docKey}
          type="file"
          accept={docKey === 'cartaoCnpjFile' || docKey === 'comprovanteEndereco' ? "image/*,application/pdf" : "image/*"}
          onChange={(e) => handleFileChange(e, docKey)}
          className="file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
        />
        {displayDocName && ( 
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground truncate max-w-[calc(100%-150px)]">{displayDocName}</span>
            <div className="flex items-center space-x-2">
              {!isPdf && ( 
                <Button 
                  type="button" variant="outline" size="sm" 
                  onClick={() => handleAnalyzeDocument(docKey)}
                  disabled={isAnalyzing || (!displayPreviewUrl)} 
                  className="border-accent/80 text-accent hover:bg-accent/10 text-xs py-1 px-2"
                >
                  {isAnalyzing ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <ScanSearch className="mr-1 h-3 w-3"/>}
                  {isAnalyzing ? "Analisando..." : (currentDoc?.analysisResult ? "Reanalisar" : "Analisar IA")}
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(docKey)} className="text-destructive/70 hover:text-destructive h-7 w-7">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {currentDoc?.analysisResult && ( 
           <div className="mt-2 p-2 border-t border-border/30 text-xs space-y-1 bg-muted/20 rounded-b-md overflow-hidden">
            <p className="font-semibold text-primary/80">Dados Extraídos:</p>
            {(currentDoc.analysisResult as any).error ? <p className="text-destructive break-all">{(currentDoc.analysisResult as any).error}</p> : <>
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeCompleto && <p className="break-all"><strong>Nome:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeCompleto}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).cpf && <p className="break-all"><strong>CPF:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).cpf}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).dataNascimento && <p className="break-all"><strong>Nasc.:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).dataNascimento}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeMae && <p className="break-all"><strong>Mãe:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).nomeMae}</p>}
              {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).rg && <p className="break-all"><strong>RG:</strong> {(currentDoc.analysisResult as ExtractBuyerDocumentDataOutput).rg}</p>}
            </>}
          </div>
        )}
      </div>
    );
  };
  
  const renderCurrentPfDocumentSlots = () => {
    if (processState.buyerType !== 'pf' || !selectedPfDocType) return null;

    switch(selectedPfDocType) {
      case 'rgAntigo':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDocumentSlot('rgAntigoFrente', 'RG (Antigo) - Frente')}
            {renderDocumentSlot('rgAntigoVerso', 'RG (Antigo) - Verso')}
          </div>
        );
      case 'cnhAntiga':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDocumentSlot('cnhAntigaFrente', 'CNH (Antiga) - Frente')}
            {renderDocumentSlot('cnhAntigaVerso', 'CNH (Antiga) - Verso')}
          </div>
        );
      default:
        return null;
    }
  }

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
            className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4"
          >
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30">
              <RadioGroupItem value="pf" id="type-pf" className="border-primary/50 text-primary focus:ring-primary"/>
              <Label htmlFor="type-pf" className="font-medium text-base cursor-pointer flex items-center"><UserCircle className="mr-2 h-5 w-5"/>Pessoa Física</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30">
              <RadioGroupItem value="pj" id="type-pj" className="border-primary/50 text-primary focus:ring-primary"/>
              <Label htmlFor="type-pj" className="font-medium text-base cursor-pointer flex items-center"><Building className="mr-2 h-5 w-5"/>Pessoa Jurídica</Label>
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
             {renderDocumentSlot('cartaoCnpjFile', 'Cartão CNPJ (PDF ou Imagem)')}
          </CardContent>
        </Card>
      )}
      
      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-xl font-headline text-primary">
            <UserCircle className="mr-3 h-6 w-6" />
            {processState.buyerType === 'pf' ? "Documentos Pessoais do Comprador" : "Dados e Documentos do Representante Legal/Sócio"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          {processState.buyerType === 'pj' && ( 
            <>
              <div>
                <Label htmlFor="repNome">Nome Completo do Representante</Label>
                <Input id="repNome" value={processState.buyerInfo.nome} onChange={(e) => handleBuyerInfoChange(e, 'nome')} className="mt-1 bg-input"/>
              </div>
              <div>
                <Label htmlFor="repCPF">CPF do Representante</Label>
                <Input id="repCPF" value={processState.buyerInfo.cpf} onChange={(e) => handleBuyerInfoChange(e, 'cpf')} className="mt-1 bg-input"/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderDocumentSlot('docSocioFrente', 'Doc. Representante (Frente)')}
                {renderDocumentSlot('docSocioVerso', 'Doc. Representante (Verso)')}
              </div>
            </>
          )}

          {processState.buyerType === 'pf' && (
            <>
              <Label className="text-base font-medium text-foreground/90 block mb-2">Qual documento pessoal deseja anexar?</Label>
              <RadioGroup
                value={selectedPfDocType}
                onValueChange={(val) => handlePfDocTypeChange(val as PfDocumentType)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
              >
                {pfDocOptions.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
                    <RadioGroupItem value={opt.value} id={`doc-${opt.value}`} className="border-primary/50 text-primary focus:ring-primary"/>
                    <Label htmlFor={`doc-${opt.value}`} className="font-medium text-base cursor-pointer flex items-center">
                      <opt.icon className="mr-2 h-5 w-5 flex-shrink-0"/>
                      <span className="whitespace-normal break-words">{opt.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {renderCurrentPfDocumentSlots()}
            </>
          )}
          {renderDocumentSlot('comprovanteEndereco', processState.buyerType === 'pf' ? 'Comprovante de Endereço Pessoal (PDF ou Imagem)' : 'Comprovante de Endereço da Empresa (PDF ou Imagem)')}
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
          disabled={isNavigatingNext || analyzingDocKey !== null}
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
