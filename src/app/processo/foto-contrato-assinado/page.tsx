
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
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, type UploadTaskSnapshot } from "firebase/storage";

const db = getFirestore(firebaseApp); 

const generateUniqueFileName = (file: File, prefix: string = 'unknown') => {
  const timestamp = new Date().getTime();
  const saneFilename = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return `${prefix}/${timestamp}-${saneFilename}`;
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
  const [isUploadingSignedContract, setIsUploadingSignedContract] = useState(false);
  const [signedContractUploadProgress, setSignedContractUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedState = loadProcessState();
    const printData = loadPrintData(); 

    if (!printData || !printData.extractedData || !printData.buyerInfo || !printData.internalTeamMemberInfo) {
      toast({
        title: 'Sequência Incorreta',
        description: 'Por favor, prepare o contrato para impressão antes de anexar a foto do contrato assinado.',
        variant: 'destructive',
      });
      router.replace('/processo/revisao-envio'); 
      return;
    }

    setProcessState(loadedState);
    setIsLoading(false);
  }, [router, toast]);

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploadingSignedContract(true);
      setSignedContractUploadProgress(0); // Initial progress to 0
      toast({ title: "Upload Iniciado", description: `Enviando ${file.name}...`, className: "bg-blue-600 text-white border-blue-700" });

      if (processState.signedContractPhotoStoragePath) {
        try {
          const oldPhotoRef = storageRef(firebaseStorage, processState.signedContractPhotoStoragePath);
          await deleteObject(oldPhotoRef);
        } catch (deleteError) {
          console.warn("Could not delete old signed contract photo from Firebase Storage:", deleteError);
        }
      }

      const filePath = generateUniqueFileName(file, 'signed_contracts');
      const fileRef = storageRef(firebaseStorage, filePath);
      const uploadTask = uploadBytesResumable(fileRef, file);
      
      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progressValue = snapshot.totalBytes > 0
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            : (snapshot.state === 'success' ? 100 : 0);
          setSignedContractUploadProgress(Math.round(progressValue));
        },
        (error) => {
          console.error("Error uploading signed contract photo to Firebase Storage:", error);
          toast({ 
            title: "Erro no Upload", 
            description: `Não foi possível enviar a foto do contrato assinado. (Erro: ${error.code} - ${error.message})`, 
            variant: "destructive"
          });
          setIsUploadingSignedContract(false);
          setSignedContractUploadProgress(null);
          if (photoInputRef.current) {
              photoInputRef.current.value = "";
          }
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
            saveProcessState(newState);
            toast({ title: "Upload Concluído!", description: `${file.name} enviado com sucesso.`, className: "bg-green-600 text-primary-foreground border-green-700" });
          } catch (error: any) {
            console.error("Error getting download URL for signed contract photo:", error);
            toast({ title: "Erro Pós-Upload", description: `Falha ao obter URL do arquivo ${file.name}. (Erro: ${error.message})`, variant: "destructive"});
          } finally {
            setIsUploadingSignedContract(false);
            setSignedContractUploadProgress(null); 
          }
        }
      );
    }
  };
  
  const validateStep = () => {
    if (!processState.signedContractPhotoName || !processState.signedContractPhotoPreview) {
      toast({ title: "Foto Obrigatória", description: "Por favor, anexe a foto do contrato assinado.", variant: "destructive" });
      return false;
    }
    if (!processState.buyerInfo.nome || isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo)) {
        toast({ title: "Dados Incompletos", description: "Informações do comprador ou responsável interno estão faltando. Volte e preencha.", variant: "destructive"});
        return false;
    }
    return true;
  };

  const isInternalTeamMemberInfoEmpty = (data: StoredProcessState['internalTeamMemberInfo']): boolean => {
    if (!data) return true;
    return !data.nome && !data.cpf && !data.email && !data.telefone;
  }

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setIsSubmitting(true);
    try {
      const submissionData = {
        submissionTimestamp: Timestamp.now(),
        contractSourceType: processState.contractSourceType,
        selectedPlayer: processState.selectedPlayer,
        selectedContractTemplateName: processState.selectedContractTemplateName,
        
        buyerType: processState.buyerType,
        buyerInfo: processState.buyerInfo,
        companyInfo: processState.companyInfo,
        internalTeamMemberInfo: processState.internalTeamMemberInfo,
        
        extractedContractData: processState.extractedData,
        originalContractPhotoUrl: processState.contractSourceType === 'new' ? processState.contractPhotoPreview : null,
        originalContractPhotoName: processState.contractSourceType === 'new' ? processState.contractPhotoName : null,
        originalContractPhotoStoragePath: processState.contractSourceType === 'new' ? processState.contractPhotoStoragePath : null,

        rgAntigoFrente: mapDocumentFileToSave(processState.rgAntigoFrente),
        rgAntigoVerso: mapDocumentFileToSave(processState.rgAntigoVerso),
        cnhAntigaFrente: mapDocumentFileToSave(processState.cnhAntigaFrente),
        cnhAntigaVerso: mapDocumentFileToSave(processState.cnhAntigaVerso),
        cartaoCnpjFile: mapDocumentFileToSave(processState.cartaoCnpjFile),
        docSocioFrente: mapDocumentFileToSave(processState.docSocioFrente),
        docSocioVerso: mapDocumentFileToSave(processState.docSocioVerso),
        comprovanteEndereco: mapDocumentFileToSave(processState.comprovanteEndereco),
        
        signedContractPhotoUrl: processState.signedContractPhotoPreview,
        signedContractPhotoName: processState.signedContractPhotoName,
        signedContractPhotoStoragePath: processState.signedContractPhotoStoragePath,
      };

      console.log("Attempting to save to Firestore:", submissionData);
      const docRef = await addDoc(collection(db, "submittedContracts"), submissionData);
      console.log("Document written with ID: ", docRef.id);
      
      console.log("\n--- SIMULANDO ENVIO DE EMAIL FINAL ---");
      const recipients = ['financeiro@empresa.com', 'juridico@empresa.com']; 
      if (processState.buyerInfo.email) {
        recipients.push(processState.buyerInfo.email);
      }
      console.log(`Destinatários: ${recipients.join(', ')}`);
      const subject = `CONTRATO FINALIZADO: ${processState.extractedData?.objetoDoContrato || 'Detalhes do Contrato'} - Comprador: ${processState.buyerInfo.nome} ${processState.selectedPlayer ? `(Player: ${processState.selectedPlayer})` : ''}`;
      console.log(`Assunto: ${subject}`);
      let emailBody = `Um processo de contrato foi finalizado e submetido com os seguintes detalhes (Firestore ID: ${docRef.id}):\n`;
      if (processState.selectedPlayer) emailBody += `Player: ${processState.selectedPlayer}\n`;
      if (processState.selectedContractTemplateName) emailBody += `Modelo do Contrato: ${processState.selectedContractTemplateName}\n`;
      emailBody += `Comprador: ${processState.buyerInfo.nome} (CPF: ${processState.buyerInfo.cpf})\n`;
      emailBody += `Objeto do Contrato: ${processState.extractedData?.objetoDoContrato || 'N/A'}\n`;
      
      const attachedDocs: string[] = [];
      if (processState.rgAntigoFrente?.name) attachedDocs.push(processState.rgAntigoFrente.name);
      if (processState.rgAntigoVerso?.name) attachedDocs.push(processState.rgAntigoVerso.name);
      if (processState.cnhAntigaFrente?.name) attachedDocs.push(processState.cnhAntigaFrente.name);
      if (processState.cnhAntigaVerso?.name) attachedDocs.push(processState.cnhAntigaVerso.name);
      if (processState.cartaoCnpjFile?.name) attachedDocs.push(processState.cartaoCnpjFile.name);
      if (processState.docSocioFrente?.name) attachedDocs.push(processState.docSocioFrente.name);
      if (processState.docSocioVerso?.name) attachedDocs.push(processState.docSocioVerso.name);
      if (processState.comprovanteEndereco?.name) attachedDocs.push(processState.comprovanteEndereco.name);
      
      if(attachedDocs.length > 0) {
        emailBody += `Documentos Comprobatórios (nomes): ${attachedDocs.join(', ')}\n`;
      }

      if(processState.signedContractPhotoName) emailBody += `Foto do Contrato Assinado: ${processState.signedContractPhotoName}\n`;
      if (!isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo)) {
        emailBody += `Processo conduzido por (Time Interno): ${processState.internalTeamMemberInfo.nome} (${processState.internalTeamMemberInfo.email || 'Email não informado'})\n`;
      }
      console.log(`Corpo do Email (resumido):\n${emailBody}`);
      console.log("--- FIM DA SIMULAÇÃO DE EMAIL FINAL ---\n");

      toast({ 
        title: "Processo Enviado com Sucesso!", 
        description: `Contrato assinado e documentos enviados para Firestore (ID: ${docRef.id}). Você será redirecionado.`,
        className: "bg-primary text-primary-foreground border-primary-foreground/30"
      });
      clearProcessState(); 
      router.push("/confirmation");

    } catch (error: any) {
      console.error("Final Submission Error (Firestore or other):", error);
      toast({ title: "Erro no Envio Final", description: `Não foi possível enviar os dados para o Firestore. Verifique o console para detalhes. (Erro: ${error.message})`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleBack = () => {
    setIsSubmitting(true); 
    saveProcessState(processState); 
    router.push("/print-contract"); 
  };
  
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verificando etapa do processo...</p>
      </div>
    );
  }

  const globalDisableCondition = isLoading || isUploadingSignedContract || isSubmitting;

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
          {isUploadingSignedContract && (
             <div className="mt-4 space-y-2">
                <div className="flex items-center space-x-2 text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{signedContractUploadProgress === null ? 'Preparando envio...' : `Enviando ${signedContractUploadProgress}%...`}</span>
                </div>
                {signedContractUploadProgress !== null && (
                  <Progress value={signedContractUploadProgress} className="w-full h-2 bg-primary/20" />
                )}
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
          disabled={globalDisableCondition || isSubmitting} 
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          { isSubmitting && globalDisableCondition ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowLeft className="mr-2 h-5 w-5" /> }
          { isSubmitting && globalDisableCondition ? "Processando..." : "Voltar para Impressão" }
        </Button>
      </div>
    </>
  );
}
