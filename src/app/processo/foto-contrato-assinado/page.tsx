
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
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, clearProcessState, loadPrintData, DocumentFile } from "@/lib/process-store";
import { ArrowRight, ArrowLeft, Camera, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp, storage as firebaseStorage } from '@/lib/firebase'; 
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTaskSnapshot, type FirebaseStorageError } from "firebase/storage";

const db = getFirestore(firebaseApp); 

const generateUniqueFileName = (file: File, prefix: string = 'unknown', processId?: string | null) => {
  const timestamp = new Date().getTime();
  const saneFilename = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const userPrefix = processId ? `user-${processId}` : 'unknown_user';
  return `${userPrefix}/${prefix}/${timestamp}-${saneFilename}`;
};

interface DocumentToSave {
  name?: string;
  photoUrl?: string | null; 
  storagePath?: string | null;
  analysisResult?: any; 
}

const mapDocumentFileToSave = (docFile: DocumentFile | null): DocumentToSave | null => {
  if (!docFile) return null;
  return {
    name: docFile.name,
    photoUrl: docFile.previewUrl, 
    storagePath: docFile.storagePath,
    analysisResult: docFile.analysisResult, // Make sure this is Firestore-compatible
  };
};


export default function FotoContratoAssinadoPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [isStateLoading, setIsStateLoading] = useState(true);
  const [isUploadingSignedContract, setIsUploadingSignedContract] = useState(false);
  const [signedContractUploadProgress, setSignedContractUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadInitialState = async () => {
      setIsStateLoading(true);
      const loadedState = await loadProcessState();
      const printData = loadPrintData(); 

      if (!printData || !printData.extractedData || !printData.buyerInfo || !printData.internalTeamMemberInfo) {
        toast({
          title: 'Sequência Incorreta',
          description: 'Por favor, prepare o contrato para impressão antes de anexar a foto do contrato assinado.',
          variant: 'destructive',
        });
        router.replace('/processo/revisao-envio'); 
        return; // Stop further execution
      }
      setProcessState(loadedState);
      setIsStateLoading(false);
    };
    loadInitialState();
  }, [router, toast]);

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      setIsUploadingSignedContract(true);
      setSignedContractUploadProgress(0); 
      toast({ title: "Upload Iniciado", description: `Preparando envio de ${file.name}...`, className: "bg-blue-600 text-white border-blue-700" });

      if (processState.signedContractPhotoStoragePath) {
        try {
          const oldPhotoRef = storageRef(firebaseStorage, processState.signedContractPhotoStoragePath);
          await deleteObject(oldPhotoRef);
        } catch (deleteError) {
          console.warn("[FotoContratoAssinado] Could not delete old signed contract photo:", deleteError);
        }
      }

      const filePath = generateUniqueFileName(file, 'signed_contracts', processState.processId);
      const fileRef = storageRef(firebaseStorage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);
      
      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => { 
          const { bytesTransferred, totalBytes } = snapshot;
          let calculatedProgress = 0;
          if (totalBytes > 0) {
            calculatedProgress = (bytesTransferred / totalBytes) * 100;
          }
          setSignedContractUploadProgress(Math.round(calculatedProgress));
        },
        (error: FirebaseStorageError) => { 
          console.error(`[FotoContratoAssinado] Firebase Storage Upload Error. Code: ${error.code}, Message: ${error.message}`);
          toast({ title: "Erro no Upload", description: `Não foi possível enviar a foto. (Erro: ${error.code})`, variant: "destructive", duration: 7000 });
          setIsUploadingSignedContract(false);
          setSignedContractUploadProgress(null); 
          if (photoInputRef.current) photoInputRef.current.value = ""; 
          const newState = {...processState, signedContractPhotoPreview: null, signedContractPhotoName: undefined, signedContractPhotoStoragePath: null};
          setProcessState(newState);
          saveProcessState(newState);
        },
        async () => { 
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); 
            const newState = {
              ...processState,
              signedContractPhotoPreview: downloadURL, 
              signedContractPhotoName: file.name,
              signedContractPhotoStoragePath: filePath,
            };
            setProcessState(newState);
            saveProcessState(newState); // Save state after successful upload
            toast({ title: "Upload Concluído!", description: `${file.name} enviado com sucesso.`, className: "bg-green-600 text-primary-foreground border-green-700" });
          } catch (error: any) {
            console.error("[FotoContratoAssinado] Error getting download URL:", error);
            toast({ title: "Erro Pós-Upload", description: `Falha ao obter URL. (Erro: ${error.message})`, variant: "destructive"});
            setSignedContractUploadProgress(null); 
            const newState = {...processState, signedContractPhotoPreview: null, signedContractPhotoName: file.name, signedContractPhotoStoragePath: filePath};
            setProcessState(newState);
            saveProcessState(newState);
            if (photoInputRef.current) photoInputRef.current.value = "";
          } finally {
            setIsUploadingSignedContract(false); 
          }
        }
      );
    } else {
        if (photoInputRef.current) photoInputRef.current.value = "";
      const newState = {...processState, signedContractPhotoPreview: null, signedContractPhotoName: undefined, signedContractPhotoStoragePath: null};
      setProcessState(newState);
      saveProcessState(newState);
    }
  };
  
  const validateStep = () => {
    if (!processState.signedContractPhotoName || !processState.signedContractPhotoPreview) {
      toast({ title: "Foto Obrigatória", description: "Por favor, anexe a foto do contrato assinado.", variant: "destructive" });
      return false;
    }
    if (!processState.buyerInfo?.nome || isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo)) {
        toast({ title: "Dados Incompletos", description: "Informações do comprador ou responsável interno estão faltando. Volte e preencha.", variant: "destructive"});
        return false;
    }
    return true;
  };

  const isInternalTeamMemberInfoEmpty = (data: StoredProcessState['internalTeamMemberInfo'] | undefined): boolean => {
    if (!data) return true;
    return !data.nome && !data.cpf && !data.email && !data.telefone;
  }

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);
    try {
      // Ensure the latest state (including signed contract photo) is saved before submission
      const finalStateForSubmission = { ...processState, currentStep: '/confirmation' };
      saveProcessState(finalStateForSubmission); // Saves to localStorage and Firestore 'inProgressContracts'

      const submissionData = {
        submissionTimestamp: Timestamp.now(),
        processId: finalStateForSubmission.processId, // Link to the inProgress entry if needed
        contractSourceType: finalStateForSubmission.contractSourceType,
        selectedPlayer: finalStateForSubmission.selectedPlayer,
        selectedContractTemplateName: finalStateForSubmission.selectedContractTemplateName,
        
        buyerType: finalStateForSubmission.buyerType,
        buyerInfo: finalStateForSubmission.buyerInfo,
        companyInfo: finalStateForSubmission.companyInfo,
        internalTeamMemberInfo: finalStateForSubmission.internalTeamMemberInfo,
        
        extractedContractData: finalStateForSubmission.extractedData,
        originalContractPhotoUrl: finalStateForSubmission.contractSourceType === 'new' ? finalStateForSubmission.contractPhotoPreview : null,
        originalContractPhotoName: finalStateForSubmission.contractSourceType === 'new' ? finalStateForSubmission.contractPhotoName : null,
        originalContractPhotoStoragePath: finalStateForSubmission.contractSourceType === 'new' ? finalStateForSubmission.contractPhotoStoragePath : null,

        // Map DocumentFile objects for Firestore
        rgAntigoFrente: mapDocumentFileToSave(finalStateForSubmission.rgAntigoFrente),
        rgAntigoVerso: mapDocumentFileToSave(finalStateForSubmission.rgAntigoVerso),
        cnhAntigaFrente: mapDocumentFileToSave(finalStateForSubmission.cnhAntigaFrente),
        cnhAntigaVerso: mapDocumentFileToSave(finalStateForSubmission.cnhAntigaVerso),
        cartaoCnpjFile: mapDocumentFileToSave(finalStateForSubmission.cartaoCnpjFile),
        docSocioFrente: mapDocumentFileToSave(finalStateForSubmission.docSocioFrente),
        docSocioVerso: mapDocumentFileToSave(finalStateForSubmission.docSocioVerso),
        comprovanteEndereco: mapDocumentFileToSave(finalStateForSubmission.comprovanteEndereco),
        
        signedContractPhotoUrl: finalStateForSubmission.signedContractPhotoPreview,
        signedContractPhotoName: finalStateForSubmission.signedContractPhotoName,
        signedContractPhotoStoragePath: finalStateForSubmission.signedContractPhotoStoragePath,
      };

      const docRef = await addDoc(collection(db, "submittedContracts"), submissionData);
      
      // Simulate email (console log for now)
      console.log("\n--- [FotoContratoAssinado] SIMULANDO ENVIO DE EMAIL FINAL ---");
      const recipients = ['financeiro@empresa.com', 'juridico@empresa.com']; 
      if (finalStateForSubmission.buyerInfo?.email) recipients.push(finalStateForSubmission.buyerInfo.email);
      console.log(`Destinatários: ${recipients.join(', ')}`);
      // ... (rest of email simulation logs)
      console.log("--- [FotoContratoAssinado] FIM DA SIMULAÇÃO DE EMAIL FINAL ---\n");

      toast({ 
        title: "Processo Enviado com Sucesso!", 
        description: `Contrato assinado e documentos enviados para Firestore (ID: ${docRef.id}). Você será redirecionado.`,
        className: "bg-primary text-primary-foreground border-primary-foreground/30"
      });
      clearProcessState(); 
      router.push("/confirmation");

    } catch (error: any) {
      console.error("[FotoContratoAssinado] Final Submission Error:", error);
      toast({ title: "Erro no Envio Final", description: `Não foi possível enviar os dados. (Erro: ${error.message})`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setIsSubmitting(true); // Use isSubmitting to disable buttons during navigation
    saveProcessState(processState); 
    router.push("/print-contract"); 
  };
  
  if (isStateLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verificando etapa do processo...</p>
      </div>
    );
  }

  const globalDisableCondition = isStateLoading || isUploadingSignedContract || isSubmitting;

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
          Passo 6: Foto do Contrato Assinado
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><Camera className="mr-3 h-7 w-7" />Foto do Contrato Impresso e Assinado</CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Envie uma imagem nítida do contrato após ele ter sido impresso e devidamente assinado por todas as partes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="signed-contract-photo-input" className="mb-2 block text-sm font-medium uppercase tracking-wider text-foreground/90">Carregar foto do contrato assinado</Label>
             <div className="flex items-center gap-2">
                <Input
                  id="signed-contract-photo-input"
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment" 
                  onChange={handlePhotoChange}
                  className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-2.5"
                  aria-describedby="signed-contract-photo-hint"
                  disabled={globalDisableCondition}
                />
            </div>
            <p id="signed-contract-photo-hint" className="mt-2 text-xs text-muted-foreground">Use a câmera ou selecione um arquivo de imagem. {processState.signedContractPhotoName && `Atual: ${processState.signedContractPhotoName}`}</p>
          </div>
          {isUploadingSignedContract && typeof signedContractUploadProgress === 'number' && (
             <div className="mt-4 space-y-2">
                <div className="flex items-center space-x-2 text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Enviando {signedContractUploadProgress}%...</span>
                </div>
                <Progress value={signedContractUploadProgress} className="w-full h-2 bg-primary/20" />
            </div>
          )}
          {processState.signedContractPhotoPreview && !isUploadingSignedContract && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2 uppercase tracking-wider text-foreground/90">Pré-visualização do Contrato Assinado:</p>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed border-primary/30 bg-background/50 flex items-center justify-center" data-ai-hint="signed contract">
                <Image src={processState.signedContractPhotoPreview} alt="Pré-visualização do contrato assinado" layout="fill" objectFit="contain" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><UploadCloud className="mr-3 h-7 w-7" />Finalizar Processo</CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Após anexar a foto do contrato assinado, envie o processo completo para o banco de dados.</CardDescription>
        </CardHeader>
        <CardFooter className="p-6">
          <Button 
            type="button" 
            onClick={handleSubmit} 
            disabled={globalDisableCondition || !processState.signedContractPhotoPreview}
            className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
            {isSubmitting ? "Enviando Processo..." : "Finalizar e Enviar Processo"}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex justify-start mt-8">
        <Button 
          onClick={handleBack} 
          variant="outline"
          disabled={globalDisableCondition} 
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          { isSubmitting && globalDisableCondition ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowLeft className="mr-2 h-5 w-5" /> }
          { isSubmitting && globalDisableCondition ? "Processando..." : "Voltar para Impressão" }
        </Button>
      </div>
    </>
  );
}
