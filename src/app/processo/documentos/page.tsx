
"use client";

import { useState, useEffect, ChangeEvent, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
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
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTaskSnapshot, type FirebaseStorageError } from "firebase/storage";

const generateUniqueFileName = (file: File, docType: string, folderPrefix: string) => {
  const timestamp = new Date().getTime();
  const saneFilename = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return `${folderPrefix}/${docType}/${timestamp}-${saneFilename}`;
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
  const [isStateLoading, setIsStateLoading] = useState(true);
  const [analyzingDocKey, setAnalyzingDocKey] = useState<DocumentSlotKey | null>(null);
  const [uploadingDocKey, setUploadingDocKey] = useState<DocumentSlotKey | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<DocumentSlotKey, number | null>>({} as Record<DocumentSlotKey, number | null>);
  const [selectedPfDocType, setSelectedPfDocType] = useState<PfDocumentType | ''>('');
  const [isNavigating, setIsNavigating] = useState(false);
  const fileInputRefs = useRef<Record<DocumentSlotKey, HTMLInputElement | null>>({} as Record<DocumentSlotKey, HTMLInputElement | null>);


  useEffect(() => {
    const loadInitialState = async () => {
      setIsStateLoading(true);
      const loadedState = await loadProcessState();

      if (loadedState.buyerType === 'pj' && !loadedState.companyInfo) {
        loadedState.companyInfo = { ...initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' } };
      }

      setProcessState(loadedState);

      if (loadedState.buyerType === 'pf') {
        if (loadedState.rgAntigoFrente || loadedState.rgAntigoVerso) setSelectedPfDocType('rgAntigo');
        else if (loadedState.cnhAntigaFrente || loadedState.cnhAntigaVerso) setSelectedPfDocType('cnhAntiga');
      }
      setIsStateLoading(false);
    };
    loadInitialState();
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>, docKey: DocumentSlotKey) => {
    const file = event.target.files?.[0];
    const inputElement = event.target;

    if (file) {
      setUploadingDocKey(docKey);
      setUploadProgress(prev => ({ ...prev, [docKey]: 0 }));
      toast({ title: "Upload Iniciado", description: `Preparando envio de ${file.name}...`, className: "bg-blue-600 text-white border-blue-700" });

      const currentDoc = processState[docKey] as DocumentFile | null;
      if (currentDoc?.storagePath) {
        try {
          const oldFileRef = storageRef(storage, currentDoc.storagePath);
          await deleteObject(oldFileRef);
        } catch (deleteError) {
          console.warn(`[${docKey}] Could not delete old file from Firebase Storage:`, deleteError);
        }
      }
      const baseFolder = `user-${processState.processId || 'unknown_process'}/docs`;
      const filePath = generateUniqueFileName(file, docKey, baseFolder);
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const { bytesTransferred, totalBytes } = snapshot;
          let calculatedProgress = 0;
          if (totalBytes > 0) {
            calculatedProgress = (bytesTransferred / totalBytes) * 100;
          }
          setUploadProgress(prev => ({ ...prev, [docKey]: Math.round(calculatedProgress) }));
        },
        (error: FirebaseStorageError) => {
          console.error(`[${docKey}] Firebase Storage Upload Error. Code: ${error.code}, Message: ${error.message}, Full Error Object:`, error);
          toast({
            title: "Erro no Upload",
            description: `Não foi possível enviar ${file.name}. (Erro: ${error.code})`,
            variant: "destructive",
            duration: 7000
          });
          setUploadingDocKey(null);
          setUploadProgress(prev => ({ ...prev, [docKey]: null }));
          const newState = { ...processState, [docKey]: null };
          setProcessState(newState);
          saveProcessState(newState);
          if (inputElement) inputElement.value = "";
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const newState = {
              ...processState,
              [docKey]: {
                name: file.name,
                previewUrl: downloadURL,
                storagePath: filePath,
                analysisResult: null
              } as DocumentFile
            };
            setProcessState(newState);
            saveProcessState(newState);
            toast({ title: "Upload Concluído!", description: `${file.name} enviado com sucesso.`, className: "bg-green-600 text-primary-foreground border-green-700" });
          } catch (error: any) {
            console.error(`[${docKey}] Error getting download URL for ${file.name}:`, error);
            toast({ title: "Erro Pós-Upload", description: `Falha ao obter URL do arquivo ${file.name}. (Erro: ${error.message})`, variant: "destructive"});
            setUploadProgress(prev => ({ ...prev, [docKey]: null }));
             const newState = { ...processState, [docKey]: {
                name: (processState[docKey] as DocumentFile)?.name || file.name,
                previewUrl: null,
                storagePath: filePath,
                analysisResult: null
              } as DocumentFile };
            setProcessState(newState);
            saveProcessState(newState);
            if (inputElement) inputElement.value = "";
          } finally {
            setUploadingDocKey(null);
          }
        }
      );
    } else {
      const currentDoc = processState[docKey] as DocumentFile | null;
      if (currentDoc && inputElement && inputElement.files && inputElement.files.length === 0) {
        removeDocument(docKey);
      }
    }
  };

  const removeDocument = async (docKey: DocumentSlotKey) => {
    const currentDoc = processState[docKey] as DocumentFile | null;
    if (currentDoc?.storagePath) {
      try {
        const fileToDeleteRef = storageRef(storage, currentDoc.storagePath);
        await deleteObject(fileToDeleteRef);
        toast({ title: "Arquivo Removido", description: `${currentDoc.name} removido do servidor.`, className: "bg-orange-500 text-white border-orange-600" });
      } catch (error: any) {
        console.error(`[${docKey}] Error deleting file ${currentDoc.storagePath} from Firebase Storage:`, error);
        toast({ title: "Erro ao Remover Arquivo", description: `Não foi possível remover ${currentDoc.name} do servidor. (Erro: ${error.message}) Ele será removido apenas da listagem local.`, variant: "destructive"});
      }
    }

    const newState = { ...processState, [docKey]: null };
    if(uploadingDocKey === docKey) {
        setUploadingDocKey(null);
    }
    setUploadProgress(prev => ({...prev, [docKey]: null}));
    setProcessState(newState);
    saveProcessState(newState);

    const inputElement = fileInputRefs.current[docKey];
    if (inputElement) {
        inputElement.value = "";
    }
  };

  const handleAnalyzeDocument = async (docKey: DocumentSlotKey) => {
    const currentDocInState = processState[docKey] as DocumentFile | null;
    const photoDownloadUrl = currentDocInState?.previewUrl;
    const docName = currentDocInState?.name;

    if (!photoDownloadUrl) {
      toast({ title: "Arquivo não encontrado", description: "Carregue um arquivo para ser analisado.", variant: "destructive"});
      setAnalyzingDocKey(null);
      return;
    }

    setAnalyzingDocKey(docKey);
    try {
      const result = await extractBuyerDocumentData({ photoDataUri: photoDownloadUrl });

      const newState = {
        ...processState,
        [docKey]: {
          ...(currentDocInState!),
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
      console.error(`[${docKey}] AI Document Analysis Error for ${docName}:`, error);
      let userFriendlyErrorMessage = "A IA não conseguiu processar o documento. Verifique a qualidade da imagem ou tente novamente.";
      if (error?.message?.includes("An error occurred in the Server Components render") || error?.message?.includes("flow execution failed")) {
         userFriendlyErrorMessage = "Falha ao analisar: A IA não conseguiu processar este documento. Tente uma imagem mais nítida, verifique os logs do Genkit ou se o documento é suportado.";
      } else if (error.message) {
        userFriendlyErrorMessage = `Erro na análise: ${error.message}`;
      }

      const newState = {
        ...processState,
        [docKey]: {
          ...(currentDocInState!),
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
      if (!processState.buyerInfo?.nome || !processState.buyerInfo?.cpf) {
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
    setIsNavigating(true);
    const newState = { ...processState, currentStep: "/processo/revisao-envio" };
    saveProcessState(newState);
    setProcessState(newState);
    toast({ title: "Etapa 3 Concluída!", description: "Documentos e informações salvos.", className: "bg-green-600 text-primary-foreground border-green-700" });
    router.push("/processo/revisao-envio");
  };

  const handleBack = () => {
    setIsNavigating(true);
    saveProcessState(processState);
    const prevStep = processState.contractSourceType === 'new' ? "/processo/foto-contrato" : "/processo/dados-iniciais";
    router.push(prevStep);
  };

  const handleBuyerTypeChange = (value: BuyerType) => {
    const newState: StoredProcessState = {
      ...processState,
      buyerType: value,
      companyInfo: value === 'pj' ? (processState.companyInfo || { ...initialStoredProcessState.companyInfo! }) : null,
      rgAntigoFrente: value === 'pj' ? null : processState.rgAntigoFrente,
      rgAntigoVerso: value === 'pj' ? null : processState.rgAntigoVerso,
      cnhAntigaFrente: value === 'pj' ? null : processState.cnhAntigaFrente,
      cnhAntigaVerso: value === 'pj' ? null : processState.cnhAntigaVerso,
      cartaoCnpjFile: value === 'pf' ? null : processState.cartaoCnpjFile,
      docSocioFrente: value === 'pf' ? null : processState.docSocioFrente,
      docSocioVerso: value === 'pf' ? null : processState.docSocioVerso,
    };
    setProcessState(newState);
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

    allPfDocKeys.forEach(key => {
      let shouldClear = true;
      if (value === 'rgAntigo' && (key === 'rgAntigoFrente' || key === 'rgAntigoVerso')) shouldClear = false;
      else if (value === 'cnhAntiga' && (key === 'cnhAntigaFrente' || key === 'cnhAntigaVerso')) shouldClear = false;

      if (shouldClear && newState[key]) {
        newState[key] = null;
      }
    });
    setProcessState(newState);
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
  };

  const handleBuyerInfoChange = (e: ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    const newState = {
      ...processState,
      buyerInfo: {
        ...(processState.buyerInfo!),
        [field]: e.target.value,
      }
    };
    setProcessState(newState);
  };

  useEffect(() => { 
    return () => {
      if (!isNavigating) {
        saveProcessState(processState);
      }
    };
  }, [processState, isNavigating]);

  const renderDocumentSlot = (docKey: DocumentSlotKey, label: string) => {
    const currentDoc = processState[docKey] as DocumentFile | null;
    const isCurrentlyUploadingThisSlot = uploadingDocKey === docKey;
    const currentUploadPercent = uploadProgress[docKey];
    const isCurrentlyAnalyzing = analyzingDocKey === docKey;
    const displayDocName = currentDoc?.name;
    const displayPreviewUrl = currentDoc?.previewUrl;
    const isPdf = displayDocName?.toLowerCase().endsWith('.pdf') || displayPreviewUrl?.startsWith('data:application/pdf') || currentDoc?.storagePath?.toLowerCase().endsWith('.pdf');


    return (
      <div className="p-4 border border-border/50 rounded-lg bg-background/30 space-y-3">
        <Label htmlFor={docKey} className="text-base font-medium text-foreground/90">{label}</Label>
        {isCurrentlyUploadingThisSlot && typeof currentUploadPercent === 'number' && (
          <div className="flex flex-col items-center justify-center p-4 space-y-2 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Enviando {currentUploadPercent}%...</span>
            <Progress value={currentUploadPercent} className="w-full h-2 mt-1 bg-primary/20" />
          </div>
        )}
        {displayPreviewUrl && !isPdf && !isCurrentlyUploadingThisSlot && (
          <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden border border-dashed border-primary/30">
            <Image src={displayPreviewUrl} alt={`Pré-visualização de ${label}`} layout="fill" objectFit="contain" />
          </div>
        )}
        {displayPreviewUrl && isPdf && !isCurrentlyUploadingThisSlot && (
            <div className="p-4 text-center text-muted-foreground border border-dashed border-primary/30 rounded-md">
                <FileText className="mx-auto h-12 w-12 mb-2" />
                PDF carregado: {displayDocName}. Pré-visualização não disponível.
            </div>
        )}
        {!isCurrentlyUploadingThisSlot && (
          <Input
            id={docKey}
            ref={el => fileInputRefs.current[docKey] = el}
            type="file"
            accept={docKey === 'cartaoCnpjFile' || docKey === 'comprovanteEndereco' ? "image/*,application/pdf" : "image/*"}
            onChange={(e) => handleFileChange(e, docKey)}
            className="file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
            disabled={isCurrentlyAnalyzing || uploadingDocKey !== null || isNavigating || isStateLoading}
          />
        )}
        {displayDocName && !isCurrentlyUploadingThisSlot && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground truncate max-w-[calc(100%-150px)]">{displayDocName}</span>
            <div className="flex items-center space-x-2">
              {!isPdf && (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => handleAnalyzeDocument(docKey)}
                  disabled={isCurrentlyAnalyzing || uploadingDocKey !== null || (!displayPreviewUrl) || isNavigating || isStateLoading}
                  className="border-accent/80 text-accent hover:bg-accent/10 text-xs py-1 px-2"
                >
                  {isCurrentlyAnalyzing ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <ScanSearch className="mr-1 h-3 w-3"/>}
                  {isCurrentlyAnalyzing ? "Analisando..." : (currentDoc?.analysisResult && !(currentDoc.analysisResult as any).error ? "Reanalisar" : "Analisar IA")}
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(docKey)} disabled={uploadingDocKey !== null || isCurrentlyAnalyzing || isNavigating || isStateLoading} className="text-destructive/70 hover:text-destructive h-7 w-7">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {currentDoc?.analysisResult && !isCurrentlyUploadingThisSlot && (
           <div className="mt-2 p-3 border-t border-border/30 text-xs space-y-1 bg-muted/20 rounded-b-md overflow-x-auto">
            <p className="font-semibold text-primary/80">Dados Extraídos por IA:</p>
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

  if (isStateLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando dados do processo...</p>
      </div>
    );
  }

  const globalDisableCondition = isNavigating || uploadingDocKey !== null || analyzingDocKey !== null || isStateLoading;

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
            disabled={globalDisableCondition}
          >
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30 has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
              <RadioGroupItem value="pf" id="type-pf" className="border-primary/50 text-primary focus:ring-primary" disabled={globalDisableCondition}/>
              <Label htmlFor="type-pf" className="font-medium text-sm sm:text-base cursor-pointer flex items-center"><UserCircle className="mr-2 h-5 w-5"/>Pessoa Física</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30 has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
              <RadioGroupItem value="pj" id="type-pj" className="border-primary/50 text-primary focus:ring-primary" disabled={globalDisableCondition}/>
              <Label htmlFor="type-pj" className="font-medium text-sm sm:text-base cursor-pointer flex items-center"><Building className="mr-2 h-5 w-5"/>Pessoa Jurídica</Label>
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
              <Input id="razaoSocial" value={processState.companyInfo?.razaoSocial || ''} onChange={(e) => handleCompanyInfoChange(e, 'razaoSocial')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
            </div>
            <div>
              <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
              <Input id="nomeFantasia" value={processState.companyInfo?.nomeFantasia || ''} onChange={(e) => handleCompanyInfoChange(e, 'nomeFantasia')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={processState.companyInfo?.cnpj || ''} onChange={(e) => handleCompanyInfoChange(e, 'cnpj')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
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
          {processState.buyerType === 'pj' && processState.buyerInfo && (
            <>
              <div>
                <Label htmlFor="repNome">Nome Completo do Representante</Label>
                <Input id="repNome" value={processState.buyerInfo.nome} onChange={(e) => handleBuyerInfoChange(e, 'nome')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
              </div>
              <div>
                <Label htmlFor="repCPF">CPF do Representante</Label>
                <Input id="repCPF" value={processState.buyerInfo.cpf} onChange={(e) => handleBuyerInfoChange(e, 'cpf')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
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
                disabled={globalDisableCondition}
              >
                {pfDocOptions.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30 has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
                    <RadioGroupItem value={opt.value} id={`doc-${opt.value}`} className="border-primary/50 text-primary focus:ring-primary" disabled={globalDisableCondition}/>
                    <Label htmlFor={`doc-${opt.value}`} className="font-medium text-sm sm:text-base cursor-pointer flex items-center">
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
          disabled={globalDisableCondition}
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
        </Button>
        <Button
          onClick={handleNext}
          disabled={globalDisableCondition}
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          {isNavigating && !globalDisableCondition ? (
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
