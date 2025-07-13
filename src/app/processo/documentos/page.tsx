
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
  PfDocumentType,
  addUploadedFileToFirestore
} from "@/lib/process-store";
import { extractBuyerDocumentData, type ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowRight, ArrowLeft, Paperclip, FileText, Trash2, ScanSearch, Loader2, Building, UserCircle, FileBadge, FileBadge2, CheckCircle2 } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTaskSnapshot, type FirebaseStorageError } from "firebase/storage";

const generateUniqueFileName = (file: File, processId: string) => {
  const timestamp = new Date().getTime();
  const saneFilename = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return `processos/${processId}/${timestamp}-${saneFilename}`;
};

type DocumentSlotKey = Extract<keyof StoredProcessState,
  | "rgAntigoFrente" | "rgAntigoVerso"
  | "cnhAntigaFrente" | "cnhAntigaVerso"
  | "cartaoCnpjFile" | "docSocioFrente" | "docSocioVerso" | "comprovanteEndereco"
>;

const pfDocOptions: { value: PfDocumentType; label: string; icon: React.ElementType }[] = [
  { value: 'rgAntigo', label: 'ID Card (Old)', icon: FileBadge },
  { value: 'cnhAntiga', label: 'Driver\'s License (Old)', icon: FileBadge2 },
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

    if (file && processState.processId) {
      setUploadingDocKey(docKey);
      setUploadProgress(prev => ({ ...prev, [docKey]: 0 }));
      toast({ title: "Upload Started", description: `Preparing to upload ${file.name}...`, className: "bg-blue-600 text-white border-blue-700" });

      const currentDoc = processState[docKey] as DocumentFile | null;
      if (currentDoc?.storagePath) {
        try {
          const oldFileRef = storageRef(storage, currentDoc.storagePath);
          await deleteObject(oldFileRef);
        } catch (deleteError) {
          console.warn(`[${docKey}] Could not delete old file from Firebase Storage:`, deleteError);
        }
      }
      
      const filePath = generateUniqueFileName(file, processState.processId);
      const fileRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const { bytesTransferred, totalBytes } = snapshot;
          let calculatedProgress = 0;
          if (totalBytes > 0) calculatedProgress = (bytesTransferred / totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [docKey]: Math.round(calculatedProgress) }));
        },
        (error: FirebaseStorageError) => {
          console.error(`[${docKey}] Firebase Storage Upload Error. Code: ${error.code}, Message: ${error.message}, Full Error Object:`, error);
          toast({ title: "Upload Error", description: `Could not upload ${file.name}. (Error: ${error.code})`, variant: "destructive", duration: 7000 });
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
            if (processState.processId) {
                await addUploadedFileToFirestore(processState.processId, file, downloadURL, filePath);
            }

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
            await saveProcessState(newState);
            toast({ title: "Upload Complete!", description: `${file.name} has been uploaded and registered.`, className: "bg-green-600 text-primary-foreground border-green-700" });
          } catch (error: any) {
            console.error(`[${docKey}] Error getting download URL or saving to Firestore for ${file.name}:`, error);
            toast({ title: "Post-Upload Error", description: `Failed to process the file ${file.name}. (Error: ${error.message})`, variant: "destructive"});
            setUploadProgress(prev => ({ ...prev, [docKey]: null }));
             const newState = { ...processState, [docKey]: {
                name: (processState[docKey] as DocumentFile)?.name || file.name,
                previewUrl: null,
                storagePath: filePath,
                analysisResult: null
              } as DocumentFile };
            setProcessState(newState);
            await saveProcessState(newState);
            if (inputElement) inputElement.value = "";
          } finally {
            setUploadingDocKey(null);
          }
        }
      );
    } else if (!processState.processId) {
        toast({ title: "Session Error", description: "Process ID not found. Cannot upload.", variant: "destructive"});
        if (inputElement) inputElement.value = "";
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
        toast({ title: "File Removed from Storage", description: `${currentDoc.name} removed from the server.`, className: "bg-orange-500 text-white border-orange-600" });
      } catch (error: any) {
        console.error(`[${docKey}] Error deleting file ${currentDoc.storagePath} from Firebase Storage:`, error);
        toast({ title: "Error Removing File from Storage", description: `Could not remove ${currentDoc.name} from the server. (Error: ${error.message})`, variant: "destructive"});
      }
    }

    const newState = { ...processState, [docKey]: null };
    if(uploadingDocKey === docKey) {
        setUploadingDocKey(null);
    }
    setUploadProgress(prev => ({...prev, [docKey]: null}));
    setProcessState(newState);
    await saveProcessState(newState);

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
      toast({ title: "File not found", description: "Upload a file to be analyzed.", variant: "destructive"});
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
      await saveProcessState(newState);

      toast({
        title: `Analysis of ${docName || docKey} Complete!`,
        description: "Data extracted from the document. Please check below.",
        className: "bg-secondary text-secondary-foreground border-secondary"
      });

    } catch (error: any) {
      console.error(`[${docKey}] AI Document Analysis Error for ${docName}:`, error);
      let userFriendlyErrorMessage = "The AI could not process the document. Check the image quality or try again.";
      if (error?.message?.includes("An error occurred in the Server Components render") || error?.message?.includes("flow execution failed")) {
         userFriendlyErrorMessage = "Analysis Failed: The AI could not process this document. Try a clearer image, check the Genkit logs, or see if the document is supported.";
      } else if (error.message) {
        userFriendlyErrorMessage = `Analysis Error: ${error.message}`;
      }

      const newState = {
        ...processState,
        [docKey]: {
          ...(currentDocInState!),
          analysisResult: { error: userFriendlyErrorMessage },
        } as DocumentFile,
      };
      setProcessState(newState);
      await saveProcessState(newState);
      toast({
        title: `Error Analyzing ${docName || docKey}`,
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
        toast({ title: "Document Type Required", description: "Select a personal document type to attach.", variant: "destructive" });
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
        const docLabel = pfDocOptions.find(opt => opt.value === selectedPfDocType)?.label || 'Personal Document';
        toast({ title: `Insufficient Documents (${docLabel})`, description: `Attach both front and back of the ${docLabel}.`, variant: "destructive" });
        return false;
      }
      if (!processState.comprovanteEndereco?.previewUrl) {
        toast({ title: "Proof of Address Required", description: "Please attach a proof of address.", variant: "destructive" });
        return false;
      }
    } else { // PJ
      if (!processState.companyInfo?.razaoSocial || !processState.companyInfo?.cnpj) {
        toast({ title: "Incomplete Company Data", description: "Fill in the Company's Legal Name and Tax ID.", variant: "destructive"});
        return false;
      }
      if (!processState.buyerInfo?.nome || !processState.buyerInfo?.cpf) {
        toast({ title: "Incomplete Representative Data", description: "Fill in the legal representative's Name and ID.", variant: "destructive"});
        return false;
      }
      if (!processState.cartaoCnpjFile?.previewUrl || !(processState.docSocioFrente?.previewUrl && processState.docSocioVerso?.previewUrl) || !processState.comprovanteEndereco?.previewUrl) {
         toast({ title: "Insufficient Documents (Company)", description: `Attach Company Registration, Representative's ID (front and back), and Company's Proof of Address.`, variant: "destructive" });
        return false;
      }
    }
    return true;
  }, [processState, selectedPfDocType, toast]);

  const handleNext = async () => {
    if (!validateStep()) return;
    setIsNavigating(true);
    const newState = { ...processState, currentStep: "/processo/revisao-envio" };
    await saveProcessState(newState);
    setProcessState(newState);
    toast({ 
      title: (
        <div className="flex items-center">
          <CheckCircle2 className="mr-2 h-5 w-5 text-green-300" />
          Step 3 Complete!
        </div>
      ), 
      description: "Documents and information saved.", 
      className: "bg-green-600 text-primary-foreground border-green-700" 
    });
    router.push("/processo/revisao-envio");
  };

  const handleBack = async () => {
    setIsNavigating(true);
    await saveProcessState(processState);
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
    const currentProcessStateForEffect = processState;
    const saveOnUnmountOrChange = async () => {
        if (!isNavigating && !isStateLoading && !uploadingDocKey && !analyzingDocKey) {
            await saveProcessState(currentProcessStateForEffect);
        }
    };
    
    const timerId = setTimeout(() => {
        saveOnUnmountOrChange();
    }, 1000);

    return () => {
      clearTimeout(timerId);
      if (!isNavigating) {
          saveOnUnmountOrChange();
      }
    };
  }, [processState, isNavigating, isStateLoading, uploadingDocKey, analyzingDocKey]);

  const renderDocumentSlot = (docKey: DocumentSlotKey, label: string) => {
    const currentDoc = processState[docKey] as DocumentFile | null;
    const isCurrentlyUploadingThisSlot = uploadingDocKey === docKey;
    const currentUploadPercent = uploadProgress[docKey];
    const isCurrentlyAnalyzing = analyzingDocKey === docKey;
    const displayDocName = currentDoc?.name;
    const displayPreviewUrl = currentDoc?.previewUrl;
    const isPdf = displayDocName?.toLowerCase().endsWith('.pdf') || displayPreviewUrl?.startsWith('data:application/pdf') || currentDoc?.storagePath?.toLowerCase().endsWith('.pdf');

    const elementsToRender: React.ReactNode[] = [];
    if (currentDoc?.analysisResult && !(currentDoc.analysisResult as any).error && !isCurrentlyUploadingThisSlot) {
      const analysisData = currentDoc.analysisResult as ExtractBuyerDocumentDataOutput;
      const MAX_TOTAL_CHARS = 700;
      let accumulatedChars = 0;

      let fieldsToDisplayOrder = [
        { label: "Name", value: analysisData.nomeCompleto },
        { label: "ID/SSN", value: analysisData.cpf },
        { label: "Birth Date", value: analysisData.dataNascimento },
        { label: "Mother's Name", value: analysisData.nomeMae },
        { label: "ID Card No.", value: analysisData.rg },
        { label: "Address Line", value: analysisData.logradouro },
        { label: "Neighborhood", value: analysisData.bairro },
        { label: "City", value: analysisData.cidade },
        { label: "State", value: analysisData.estado },
        { label: "ZIP Code", value: analysisData.cep },
      ];

      if (docKey === 'comprovanteEndereco') {
        fieldsToDisplayOrder = [
          { label: "Address Line", value: analysisData.logradouro },
          { label: "Neighborhood", value: analysisData.bairro },
          { label: "City", value: analysisData.cidade },
          { label: "State", value: analysisData.estado },
          { label: "ZIP Code", value: analysisData.cep },
          { label: "Holder Name", value: analysisData.nomeCompleto },
          { label: "Holder ID/SSN", value: analysisData.cpf },
        ];
      }

      for (const field of fieldsToDisplayOrder) {
        if (field.value) {
          const fieldString = `${field.label}: ${field.value}\n`;
          if (accumulatedChars + fieldString.length > MAX_TOTAL_CHARS && accumulatedChars > 0) {
            elementsToRender.push(
              <p key="truncation-message" className="text-muted-foreground italic break-all text-xs">
                ... (more extracted data, display limited)
              </p>
            );
            break;
          }
          elementsToRender.push(
            <p key={field.label} className="break-all text-xs">
              <strong>{field.label}:</strong> {field.value}
            </p>
          );
          accumulatedChars += fieldString.length;

          if (accumulatedChars >= MAX_TOTAL_CHARS) {
            if (elementsToRender.length < fieldsToDisplayOrder.filter(f => f.value).length) {
                 elementsToRender.push(
                    <p key="truncation-message-after-fill" className="text-muted-foreground italic break-all text-xs">
                    ... (more data may have been omitted)
                    </p>
                );
            }
            break;
          }
        }
      }
      if (elementsToRender.length === 0) {
        elementsToRender.push(
          <p key="no-data-extracted" className="text-muted-foreground italic text-xs">
            AI analyzed the document but did not extract data for the expected fields.
          </p>
        );
      }
    }


    return (
      <div className="p-4 border border-border/50 rounded-lg bg-background/30 space-y-3">
        <Label htmlFor={docKey} className="text-base font-medium text-foreground/90">{label}</Label>
        {isCurrentlyUploadingThisSlot && typeof currentUploadPercent === 'number' && (
          <div className="flex flex-col items-center justify-center p-4 space-y-2 text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Uploading {currentUploadPercent}%...</span>
            <Progress value={currentUploadPercent} className="w-full h-2 mt-1 bg-primary/20" />
          </div>
        )}
        {displayPreviewUrl && !isPdf && !isCurrentlyUploadingThisSlot && (
          <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden border border-dashed border-primary/30">
            <Image src={displayPreviewUrl} alt={`Preview of ${label}`} layout="fill" objectFit="contain" />
          </div>
        )}
        {displayPreviewUrl && isPdf && !isCurrentlyUploadingThisSlot && (
            <div className="p-4 text-center text-muted-foreground border border-dashed border-primary/30 rounded-md">
                <FileText className="mx-auto h-12 w-12 mb-2" />
                PDF uploaded: {displayDocName}. Preview not available.
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
                  {isCurrentlyAnalyzing ? "Analyzing..." : (currentDoc?.analysisResult && !(currentDoc.analysisResult as any).error ? "Re-analyze" : "Analyze AI")}
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
            <p className="font-semibold text-primary/80 text-sm">AI Extracted Data:</p>
            {(currentDoc.analysisResult as any).error ? (
                <p className="text-destructive break-all">{(currentDoc.analysisResult as any).error}</p>
            ) : (
              <>
                {elementsToRender}
              </>
            )}
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
            {renderDocumentSlot('rgAntigoFrente', 'ID Card (Old) - Front')}
            {renderDocumentSlot('rgAntigoVerso', 'ID Card (Old) - Back')}
          </div>
        );
      case 'cnhAntiga':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDocumentSlot('cnhAntigaFrente', 'Driver\'s License (Old) - Front')}
            {renderDocumentSlot('cnhAntigaVerso', 'Driver\'s License (Old) - Back')}
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
        <p className="mt-4 text-muted-foreground">Loading process data...</p>
      </div>
    );
  }

  const globalDisableCondition = isNavigating || uploadingDocKey !== null || analyzingDocKey !== null || isStateLoading;

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-1 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Easy Contract
        </div>
        <p className="mb-4 text-sm text-foreground/80">
          International Platform Financial - SAAS Solution with Artificial Intelligence in training by Antônio Fogaça.
        </p>
        <p className="text-xl text-muted-foreground font-headline">
          Step 3: Buyer's Documents and Data
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><Paperclip className="mr-3 h-7 w-7" />Buyer Type</CardTitle>
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
              <Label htmlFor="type-pf" className="font-medium text-sm sm:text-base cursor-pointer flex items-center"><UserCircle className="mr-2 h-5 w-5"/>Individual</Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer flex-1 bg-background/30 has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
              <RadioGroupItem value="pj" id="type-pj" className="border-primary/50 text-primary focus:ring-primary" disabled={globalDisableCondition}/>
              <Label htmlFor="type-pj" className="font-medium text-sm sm:text-base cursor-pointer flex items-center"><Building className="mr-2 h-5 w-5"/>Company</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {processState.buyerType === 'pj' && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-xl font-headline text-primary"><Building className="mr-3 h-6 w-6" />Company Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div>
              <Label htmlFor="razaoSocial">Legal Name</Label>
              <Input id="razaoSocial" value={processState.companyInfo?.razaoSocial || ''} onChange={(e) => handleCompanyInfoChange(e, 'razaoSocial')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
            </div>
            <div>
              <Label htmlFor="nomeFantasia">Trade Name</Label>
              <Input id="nomeFantasia" value={processState.companyInfo?.nomeFantasia || ''} onChange={(e) => handleCompanyInfoChange(e, 'nomeFantasia')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
            </div>
            <div>
              <Label htmlFor="cnpj">Company Tax ID</Label>
              <Input id="cnpj" value={processState.companyInfo?.cnpj || ''} onChange={(e) => handleCompanyInfoChange(e, 'cnpj')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
            </div>
             {renderDocumentSlot('cartaoCnpjFile', 'Company Registration Doc (PDF or Image)')}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-xl font-headline text-primary">
            <UserCircle className="mr-3 h-6 w-6" />
            {processState.buyerType === 'pf' ? "Buyer's Personal Documents" : "Legal Representative's Data & Documents"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          {processState.buyerType === 'pj' && processState.buyerInfo && (
            <>
              <div>
                <Label htmlFor="repNome">Representative's Full Name</Label>
                <Input id="repNome" value={processState.buyerInfo.nome} onChange={(e) => handleBuyerInfoChange(e, 'nome')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
              </div>
              <div>
                <Label htmlFor="repCPF">Representative's ID/SSN</Label>
                <Input id="repCPF" value={processState.buyerInfo.cpf} onChange={(e) => handleBuyerInfoChange(e, 'cpf')} className="mt-1 bg-input" disabled={globalDisableCondition}/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderDocumentSlot('docSocioFrente', 'Representative\'s ID (Front)')}
                {renderDocumentSlot('docSocioVerso', 'Representative\'s ID (Back)')}
              </div>
            </>
          )}

          {processState.buyerType === 'pf' && (
            <>
              <Label className="text-base font-medium text-foreground/90 block mb-2">Which personal document do you want to attach?</Label>
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
          {renderDocumentSlot('comprovanteEndereco', processState.buyerType === 'pf' ? 'Personal Proof of Address (PDF or Image)' : 'Company Proof of Address (PDF or Image)')}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-8">
        <Button
          onClick={handleBack}
          variant="outline"
          disabled={globalDisableCondition}
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={globalDisableCondition}
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          {isNavigating && !globalDisableCondition ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Please wait...
            </>
          ) : (
            <>
              Next <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
