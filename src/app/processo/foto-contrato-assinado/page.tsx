
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
import { 
    StoredProcessState, 
    loadProcessState, 
    saveProcessState, 
    initialStoredProcessState, 
    clearProcessState, 
    DocumentFile,
    addUploadedFileToFirestore 
} from "@/lib/process-store";
import { ArrowRight, ArrowLeft, Camera, Loader2, Sparkles, UploadCloud, CheckCircle2 } from "lucide-react";
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore'; 
import { firebaseApp, storage as firebaseStorage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTaskSnapshot, type FirebaseStorageError } from "firebase/storage";

const db = getFirestore(firebaseApp);

const generateUniqueFileName = (file: File, processId: string) => { 
  const timestamp = new Date().getTime();
  const saneFilename = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  
  return `processos/${processId}/${timestamp}-signed-${saneFilename}`;
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
    analysisResult: docFile.analysisResult, 
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

      if (!loadedState || !loadedState.extractedData || !loadedState.buyerInfo || !loadedState.internalTeamMemberInfo || !loadedState.processId) {
        toast({
          title: 'Sequência Incorreta ou Dados Incompletos',
          description: 'Por favor, complete todas as etapas anteriores, incluindo a preparação para impressão, antes de anexar a foto do contrato assinado.',
          variant: 'destructive',
          duration: 7000,
        });
        router.replace('/processo/revisao-envio'); 
        return; 
      }
      setProcessState(loadedState);
      setIsStateLoading(false);
    };
    loadInitialState();
  }, [router, toast]);

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file && processState.processId) { 
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
      
      const filePath = generateUniqueFileName(file, processState.processId); 
      const fileRef = storageRef(firebaseStorage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const { bytesTransferred, totalBytes } = snapshot;
          let calculatedProgress = 0;
          if (totalBytes > 0) calculatedProgress = (bytesTransferred / totalBytes) * 100;
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
            
            if (processState.processId) {
                await addUploadedFileToFirestore(processState.processId, file, downloadURL, filePath);
            }

            const newState = {
              ...processState,
              signedContractPhotoPreview: downloadURL,
              signedContractPhotoName: file.name,
              signedContractPhotoStoragePath: filePath,
            };
            setProcessState(newState);
            await saveProcessState(newState); 
            toast({ title: "Upload Concluído!", description: `${file.name} enviado e registrado.`, className: "bg-green-600 text-primary-foreground border-green-700" });
          } catch (error: any) {
            console.error("[FotoContratoAssinado] Error getting download URL or saving to Firestore:", error);
            toast({ title: "Erro Pós-Upload", description: `Falha ao processar o arquivo ${file.name}. (Erro: ${error.message})`, variant: "destructive"});
            setSignedContractUploadProgress(null);
            const newState = {...processState, signedContractPhotoPreview: null, signedContractPhotoName: file.name, signedContractPhotoStoragePath: filePath};
            setProcessState(newState);
            await saveProcessState(newState);
            if (photoInputRef.current) photoInputRef.current.value = "";
          } finally {
            setIsUploadingSignedContract(false);
          }
        }
      );
    } else if (!processState.processId) {
        toast({ title: "Erro de Sessão", description: "ID do processo não encontrado. Não é possível fazer upload.", variant: "destructive"});
        if (photoInputRef.current) photoInputRef.current.value = "";
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
    
    return !data.nome && !data.cpf && !data.email && !data.telefone && !data.cargo;
  }

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);
    try {
      const finalStateForSubmission = { ...processState, currentStep: '/confirmation' };
      await saveProcessState(finalStateForSubmission); 

      
      const submissionData = {
        submissionTimestamp: Timestamp.now(),
        processId: finalStateForSubmission.processId, 
        
        responsavelInterno: finalStateForSubmission.internalTeamMemberInfo,
        buyerInfo: finalStateForSubmission.buyerInfo,
        companyInfo: finalStateForSubmission.companyInfo,
        contractSourceType: finalStateForSubmission.contractSourceType,
        selectedPlayer: finalStateForSubmission.selectedPlayer,
        extractedContractData: finalStateForSubmission.extractedData,
        
        originalContractPhotoUrl: finalStateForSubmission.contractSourceType === 'new' ? finalStateForSubmission.contractPhotoPreview : null,
        signedContractPhotoUrl: finalStateForSubmission.signedContractPhotoPreview,
        
      };

      const docRef = await addDoc(collection(db, "submittedContracts"), submissionData);

      const confirmationDetails = {
        processId: finalStateForSubmission.processId,
        buyerName: finalStateForSubmission.buyerInfo?.nome,
        internalName: finalStateForSubmission.internalTeamMemberInfo?.nome,
        playerName: finalStateForSubmission.selectedPlayer,
        contractObjectName: finalStateForSubmission.extractedData?.objetoDoContrato,
        contractValue: finalStateForSubmission.extractedData?.valorPrincipal, // Added contract value
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('contratoFacilConfirmationDetails', JSON.stringify(confirmationDetails));
      }


      console.log("\n--- [FotoContratoAssinado] SIMULANDO ENVIO DE EMAIL FINAL ---");
      const recipients = ['financeiro@empresa.com', 'juridico@empresa.com'];
      if (finalStateForSubmission.buyerInfo?.email) recipients.push(finalStateForSubmission.buyerInfo.email);
      console.log(`Destinatários: ${recipients.join(', ')}`);
      console.log("--- [FotoContratoAssinado] FIM DA SIMULAÇÃO DE EMAIL FINAL ---\n");

      toast({
        title: (
          <div className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-300" />
            Processo Enviado com Sucesso!
          </div>
        ),
        description: `Contrato assinado e documentos enviados para Firestore (ID: ${docRef.id}). Você será redirecionado.`,
        className: "bg-green-600 text-primary-foreground border-green-700", 
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

  const handleBack = async () => {
    setIsSubmitting(true); 
    await saveProcessState(processState);
    router.push("/print-contract");
  };

  
  useEffect(() => {
    const currentProcessStateForEffect = processState;
    const saveOnUnmountOrChange = async () => {
        if (!isSubmitting && !isStateLoading && !isUploadingSignedContract) {
            await saveProcessState(currentProcessStateForEffect);
        }
    };

    const timerId = setTimeout(() => {
        saveOnUnmountOrChange();
    }, 1000);

    return () => {
        clearTimeout(timerId);
        if (!isSubmitting) { 
            saveOnUnmountOrChange();
        }
    };
  }, [processState, isSubmitting, isStateLoading, isUploadingSignedContract]);


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

