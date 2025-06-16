
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
  | "rgFrente" | "rgVerso" | "cnhFrente" | "cnhVerso" 
  | "cartaoCnpjFile" | "docSocioFrente" | "docSocioVerso" | "comprovanteEndereco"
>;

export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [analyzingDocKey, setAnalyzingDocKey] = useState<DocumentSlotKey | null>(null);
  const [localFiles, setLocalFiles] = useState<Record<DocumentSlotKey, File | null>>({});
  const [selectedPfDocType, setSelectedPfDocType] = useState<'rg' | 'cnh' | ''>('');

  useEffect(() => {
    const loadedState = loadProcessState();
    if (!loadedState.companyInfo && loadedState.buyerType === 'pj') {
      loadedState.companyInfo = { razaoSocial: '', nomeFantasia: '', cnpj: '' };
    }
    setProcessState(loadedState);
    if (loadedState.buyerType === 'pf') {
      if (loadedState.rgFrente || loadedState.rgVerso) {
        setSelectedPfDocType('rg');
      } else if (loadedState.cnhFrente || loadedState.cnhVerso) {
        setSelectedPfDocType('cnh');
      }
    }
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, docKey: DocumentSlotKey) => {
    const file = event.target.files?.[0];
    const inputElement = event.target; 

    if (file) {
      setLocalFiles(prev => ({ ...prev, [docKey]: file }));
      try {
        const previewUrl = await fileToDataUri(file);
        setProcessState(prevState => ({
          ...prevState,
          [docKey]: {
            name: file.name,
            previewUrl: previewUrl,
            analysisResult: prevState[docKey]?.analysisResult 
          } as DocumentFile
        }));
      } catch (error) {
        console.error(`Error processing file for ${docKey}:`, error);
        toast({ 
          title: "Erro ao Processar Imagem", 
          description: `Não foi possível gerar a pré-visualização para ${file.name}. Por favor, tente novamente ou escolha outro arquivo.`, 
          variant: "destructive" 
        });
        setProcessState(prevState => ({
          ...prevState,
          [docKey]: null 
        }));
        setLocalFiles(prev => ({ ...prev, [docKey]: null }));
        if (inputElement) {
          inputElement.value = "";
        }
      }
    } else {
      if (inputElement && inputElement.files && inputElement.files.length === 0) {
         setProcessState(prevState => ({
          ...prevState,
          [docKey]: null
        }));
        setLocalFiles(prev => ({ ...prev, [docKey]: null }));
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
    const currentDocInState = processState[docKey] as DocumentFile | null;
    const localFile = localFiles[docKey];

    let photoDataUri: string | undefined | null = currentDocInState?.previewUrl;
    let docName = currentDocInState?.name;

    if (!photoDataUri && localFile) {
      try {
        photoDataUri = await fileToDataUri(localFile);
        docName = localFile.name; 
      } catch (error) {
        toast({ title: "Erro ao processar arquivo local", description: "Não foi possível ler o arquivo para análise.", variant: "destructive"});
        setAnalyzingDocKey(null);
        return;
      }
    }
    
    if (!photoDataUri) {
      toast({ title: "Arquivo não encontrado", description: "Carregue um arquivo para ser analisado.", variant: "destructive"});
      setAnalyzingDocKey(null);
      return;
    }

    setAnalyzingDocKey(docKey);
    try {
      const result = await extractBuyerDocumentData({ photoDataUri });
      
      setProcessState(prevState => {
        const baseDoc = prevState[docKey] as DocumentFile | null;
        return {
          ...prevState,
          [docKey]: {
            name: baseDoc?.name || docName, 
            previewUrl: baseDoc?.previewUrl || photoDataUri, 
            analysisResult: result,
          } as DocumentFile, 
        };
      });

      toast({ 
        title: `Análise de ${docName || docKey} Concluída!`, 
        description: "Dados extraídos do documento. Verifique abaixo.",
        className: "bg-secondary text-secondary-foreground border-secondary"
      });

    } catch (error) {
      console.error(`AI Document Analysis Error for ${docKey} (${docName}):`, error);
      
      const userFriendlyErrorMessage = "A IA não conseguiu processar o documento. Verifique a qualidade da imagem ou tente novamente.";

      setProcessState(prevState => {
        const baseDoc = prevState[docKey] as DocumentFile | null;
        return {
          ...prevState,
          [docKey]: {
            name: baseDoc?.name || docName,
            previewUrl: baseDoc?.previewUrl || photoDataUri,
            analysisResult: { error: userFriendlyErrorMessage },
          } as DocumentFile,
        };
      });
      toast({ 
        title: `Erro na Análise de ${docName || docKey}`, 
        description: "Não foi possível extrair os dados. Tente novamente ou verifique a imagem.", // This toast is already user-friendly
        variant: "destructive" 
      });
    } finally {
      setAnalyzingDocKey(null);
    }
  };
  
  const validateStep = useCallback(() => {
    if (processState.buyerType === 'pf') {
      if (!selectedPfDocType) {
        toast({ title: "Tipo de Documento Necessário", description: "Selecione RG ou CNH para anexar.", variant: "destructive" });
        return false;
      }
      if (selectedPfDocType === 'rg' && (!processState.rgFrente?.name || !processState.rgVerso?.name)) {
        toast({ title: "Documentos Insuficientes (RG)", description: `Anexe RG (frente e verso).`, variant: "destructive" });
        return false;
      }
      if (selectedPfDocType === 'cnh' && (!processState.cnhFrente?.name || !processState.cnhVerso?.name)) {
        toast({ title: "Documentos Insuficientes (CNH)", description: `Anexe CNH (frente e verso).`, variant: "destructive" });
        return false;
      }
      if (!processState.comprovanteEndereco?.name) {
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
      if (!processState.cartaoCnpjFile?.name || !(processState.docSocioFrente?.name && processState.docSocioVerso?.name) || !processState.comprovanteEndereco?.name) {
         toast({ title: "Documentos Insuficientes (PJ)", description: `Anexe Cartão CNPJ, Documento do Sócio (frente e verso), e Comprovante de Endereço da empresa.`, variant: "destructive" });
        return false;
      }
    }
    return true;
  }, [processState, selectedPfDocType, toast]);

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
      rgFrente: value === 'pj' ? null : prevState.rgFrente,
      rgVerso: value === 'pj' ? null : prevState.rgVerso,
      cnhFrente: value === 'pj' ? null : prevState.cnhFrente,
      cnhVerso: value === 'pj' ? null : prevState.cnhVerso,
      cartaoCnpjFile: value === 'pf' ? null : prevState.cartaoCnpjFile,
      docSocioFrente: value === 'pf' ? null : prevState.docSocioFrente,
      docSocioVerso: value === 'pf' ? null : prevState.docSocioVerso,
    }));
    if (value === 'pj') {
      setSelectedPfDocType(''); 
    }
  };

  const handlePfDocTypeChange = (value: 'rg' | 'cnh') => {
    setSelectedPfDocType(value);
    setProcessState(prevState => {
      const newState = {...prevState};
      if (value === 'rg') {
        newState.cnhFrente = null;
        newState.cnhVerso = null;
        setLocalFiles(prevLocals => ({...prevLocals, cnhFrente: null, cnhVerso: null}));
      } else if (value === 'cnh') {
        newState.rgFrente = null;
        newState.rgVerso = null;
        setLocalFiles(prevLocals => ({...prevLocals, rgFrente: null, rgVerso: null}));
      }
      return newState;
    });
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
    const localFileSelected = localFiles[docKey]; 
    const displayDocName = currentDoc?.name || localFileSelected?.name;
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
                  disabled={isAnalyzing || (!displayPreviewUrl && !localFileSelected)} 
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
                onValueChange={(val) => handlePfDocTypeChange(val as 'rg' | 'cnh')}
                className="flex space-x-4 mb-4"
              >
                <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30">
                  <RadioGroupItem value="rg" id="doc-rg" className="border-primary/50 text-primary focus:ring-primary"/>
                  <Label htmlFor="doc-rg" className="font-medium text-lg cursor-pointer flex items-center"><FileBadge className="mr-2 h-5 w-5"/>RG</Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30">
                  <RadioGroupItem value="cnh" id="doc-cnh" className="border-primary/50 text-primary focus:ring-primary"/>
                  <Label htmlFor="doc-cnh" className="font-medium text-lg cursor-pointer flex items-center"><FileBadge2 className="mr-2 h-5 w-5"/>CNH</Label>
                </div>
              </RadioGroup>

              {selectedPfDocType === 'rg' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderDocumentSlot('rgFrente', 'RG (Frente)')}
                  {renderDocumentSlot('rgVerso', 'RG (Verso)')}
                </div>
              )}
              {selectedPfDocType === 'cnh' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderDocumentSlot('cnhFrente', 'CNH (Frente)')}
                  {renderDocumentSlot('cnhVerso', 'CNH (Verso)')}
                </div>
              )}
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
          disabled={analyzingDocKey !== null}
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Próximo <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
    
