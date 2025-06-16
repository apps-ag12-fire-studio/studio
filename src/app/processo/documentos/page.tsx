
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState } from "@/lib/process-store";
import { ArrowRight, ArrowLeft, Paperclip, FileText, Trash2 } from "lucide-react";

const MAX_DOCUMENTS = 4;
const MIN_DOCUMENTS = 2;

export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  
  // Local state for File objects
  const [attachedDocumentFiles, setAttachedDocumentFiles] = useState<File[]>([]);

  useEffect(() => {
    const loadedState = loadProcessState();
    setProcessState(loadedState);
    // Note: We don't try to rehydrate File objects from localStorage for simplicity.
    // User would re-attach if they navigate back and forth after a full page reload.
    // UI will show names from `loadedState.attachedDocumentNames`.
  }, []);

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const combinedFiles = [...attachedDocumentFiles, ...newFiles];
      
      if (combinedFiles.length > MAX_DOCUMENTS) {
        toast({ title: "Limite Excedido", description: `Máximo de ${MAX_DOCUMENTS} documentos permitidos.`, variant: "destructive"});
        return;
      }
      setAttachedDocumentFiles(combinedFiles);
      setProcessState(prevState => ({
        ...prevState,
        attachedDocumentNames: combinedFiles.map(f => f.name),
      }));
    }
  };

  const removeDocument = (indexToRemove: number) => {
    const updatedFiles = attachedDocumentFiles.filter((_, index) => index !== indexToRemove);
    setAttachedDocumentFiles(updatedFiles);
    setProcessState(prevState => ({
      ...prevState,
      attachedDocumentNames: updatedFiles.map(f => f.name),
    }));
  };
  
  const validateStep = () => {
    if (processState.attachedDocumentNames.length < MIN_DOCUMENTS) {
      toast({ title: "Documentos Insuficientes", description: `Anexe ao menos ${MIN_DOCUMENTS} documentos comprobatórios.`, variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    // Here, if we needed to upload files, we would use `attachedDocumentFiles`.
    // For now, we just save their names in the process state.
    saveProcessState({ ...processState, currentStep: "/processo/revisao-envio" });
    router.push("/processo/revisao-envio");
  };

  const handleBack = () => {
    saveProcessState(processState);
    const prevStep = processState.contractSourceType === 'new' ? "/processo/foto-contrato" : "/processo/dados-iniciais";
    router.push(prevStep);
  };

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
          Passo 3: Documentos Comprobatórios
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><Paperclip className="mr-3 h-7 w-7" />Documentos Comprobatórios</CardTitle>
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
              disabled={processState.attachedDocumentNames.length >= MAX_DOCUMENTS}
            />
            <p id="document-hint" className="mt-2 text-xs text-muted-foreground">
              {processState.attachedDocumentNames.length >= MAX_DOCUMENTS 
                ? `Limite de ${MAX_DOCUMENTS} documentos atingido.`
                : `Você pode anexar até ${MAX_DOCUMENTS}. (${processState.attachedDocumentNames.length}/${MAX_DOCUMENTS} anexados)`}
            </p>
          </div>
          {processState.attachedDocumentNames.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wider text-foreground/90">Documentos Anexados:</h4>
              <ul className="list-none space-y-2">
                {processState.attachedDocumentNames.map((docName, index) => (
                  <li key={index} className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background/50 hover:border-primary/50 transition-colors">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <FileText className="h-6 w-6 text-primary shrink-0" />
                      <span className="truncate text-sm font-medium text-foreground/90">{docName}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(index)} aria-label={`Remover ${docName}`} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          disabled={processState.attachedDocumentNames.length < MIN_DOCUMENTS}
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Próximo <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
