
"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState } from "@/lib/process-store";
import { extractBuyerDocumentData, type ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowRight, ArrowLeft, Paperclip, FileText, Trash2, ScanSearch, Loader2 } from "lucide-react";

const MAX_DOCUMENTS = 4;
const MIN_DOCUMENTS = 1; // Adjusted minimum for testing, can be 2

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function DocumentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>({}); // Store File objects by name
  const [analyzingDocName, setAnalyzingDocName] = useState<string | null>(null);

  useEffect(() => {
    const loadedState = loadProcessState();
    if (!loadedState.buyerDocumentAnalysisResults) { // Ensure this field exists
      loadedState.buyerDocumentAnalysisResults = {};
    }
    setProcessState(loadedState);
    // Initialize documentFiles based on loadedState.attachedDocumentNames if needed,
    // but File objects can't be perfectly restored from localStorage.
    // This example will rely on re-selecting if full File object is needed for re-analysis on page load.
  }, []);

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFilesArray = Array.from(files);
      
      if (processState.attachedDocumentNames.length + newFilesArray.length > MAX_DOCUMENTS) {
        toast({ title: "Limite Excedido", description: `Máximo de ${MAX_DOCUMENTS} documentos permitidos.`, variant: "destructive"});
        return;
      }

      const newFileNames = newFilesArray.map(f => f.name);
      const updatedDocumentFiles = { ...documentFiles };
      newFilesArray.forEach(file => {
        updatedDocumentFiles[file.name] = file;
      });
      setDocumentFiles(updatedDocumentFiles);

      setProcessState(prevState => ({
        ...prevState,
        attachedDocumentNames: [...prevState.attachedDocumentNames, ...newFileNames],
      }));
    }
  };

  const removeDocument = (docNameToRemove: string) => {
    const updatedNames = processState.attachedDocumentNames.filter(name => name !== docNameToRemove);
    const updatedAnalysisResults = { ...processState.buyerDocumentAnalysisResults };
    delete updatedAnalysisResults[docNameToRemove];
    
    const updatedDocumentFiles = { ...documentFiles };
    delete updatedDocumentFiles[docNameToRemove];
    setDocumentFiles(updatedDocumentFiles);

    setProcessState(prevState => ({
      ...prevState,
      attachedDocumentNames: updatedNames,
      buyerDocumentAnalysisResults: updatedAnalysisResults,
    }));
  };

  const handleAnalyzeDocument = async (docName: string) => {
    const fileToAnalyze = documentFiles[docName];
    if (!fileToAnalyze) {
      toast({ title: "Arquivo não encontrado", description: "Não foi possível encontrar o arquivo para análise.", variant: "destructive"});
      return;
    }
    setAnalyzingDocName(docName);
    try {
      const photoDataUri = await fileToDataUri(fileToAnalyze);
      const result = await extractBuyerDocumentData({ photoDataUri });
      
      setProcessState(prevState => ({
        ...prevState,
        buyerDocumentAnalysisResults: {
          ...prevState.buyerDocumentAnalysisResults,
          [docName]: result,
        }
      }));
      toast({ 
        title: `Análise de ${docName} Concluída!`, 
        description: "Dados extraídos do documento. Verifique abaixo.",
        className: "bg-secondary text-secondary-foreground border-secondary"
      });

    } catch (error) {
      console.error(`AI Document Analysis Error for ${docName}:`, error);
      setProcessState(prevState => ({
        ...prevState,
        buyerDocumentAnalysisResults: {
          ...prevState.buyerDocumentAnalysisResults,
          [docName]: { error: `Falha ao analisar: ${(error as Error).message || "Erro desconhecido"}` } as any, // Store error for display
        }
      }));
      toast({ title: `Erro na Análise de ${docName}`, description: "Não foi possível extrair os dados. Tente novamente ou verifique a imagem.", variant: "destructive" });
    } finally {
      setAnalyzingDocName(null);
    }
  };
  
  const validateStep = () => {
    if (processState.attachedDocumentNames.length < MIN_DOCUMENTS) {
      toast({ title: "Documentos Insuficientes", description: `Anexe ao menos ${MIN_DOCUMENTS} documento(s) comprobatório(s).`, variant: "destructive" });
      return false;
    }
    // Optional: Check if at least one document has been analyzed
    // const hasAnalysis = Object.values(processState.buyerDocumentAnalysisResults).some(res => res !== null && !res.error);
    // if (!hasAnalysis) {
    //   toast({ title: "Análise Pendente", description: "Analise ao menos um documento com IA antes de prosseguir.", variant: "destructive" });
    //   return false;
    // }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    saveProcessState({ ...processState, currentStep: "/processo/revisao-envio" });
    toast({
      title: "Etapa 3 Concluída!",
      description: "Documentos anexados e/ou analisados. Prossiga para informações do comprador e revisão.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
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
          Passo 3: Documentos Comprobatórios do Comprador
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><Paperclip className="mr-3 h-7 w-7" />Documentos Comprobatórios</CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Anexe os documentos do comprador (RG, CNH, CPF, etc.). Mínimo de {MIN_DOCUMENTS}, máximo de {MAX_DOCUMENTS}. Após anexar, você pode usar a IA para tentar extrair os dados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="document-input" className="mb-2 block text-sm font-medium uppercase tracking-wider text-foreground/90">Adicionar documentos</Label>
            <Input
              id="document-input"
              type="file"
              multiple
              accept="image/*"
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
              <ul className="list-none space-y-4">
                {processState.attachedDocumentNames.map((docName, index) => {
                  const analysisResult = processState.buyerDocumentAnalysisResults[docName];
                  const isCurrentlyAnalyzing = analyzingDocName === docName;
                  return (
                    <li key={docName + index} className="p-3 border border-border/50 rounded-lg bg-background/50 hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileText className="h-6 w-6 text-primary shrink-0" />
                          <span className="truncate text-sm font-medium text-foreground/90">{docName}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleAnalyzeDocument(docName)}
                            disabled={isCurrentlyAnalyzing || !!analysisResult} // Disable if analyzing or already analyzed
                            className="border-accent/80 text-accent hover:bg-accent/10 text-xs py-1 px-2 rounded-md"
                          >
                            {isCurrentlyAnalyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-1 h-4 w-4" />}
                            {isCurrentlyAnalyzing ? "Analisando..." : (analysisResult ? "Analisado" : "Analisar com IA")}
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(docName)} aria-label={`Remover ${docName}`} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      {analysisResult && !isCurrentlyAnalyzing && (
                        <div className="mt-2 p-2 border-t border-border/30 text-xs space-y-1 bg-muted/30 rounded-b-md">
                          <p className="font-semibold text-primary/80">Dados Extraídos:</p>
                          {(analysisResult as any).error ? <p className="text-destructive">{(analysisResult as any).error}</p> : <>
                            {analysisResult.nomeCompleto && <p><strong>Nome:</strong> {analysisResult.nomeCompleto}</p>}
                            {analysisResult.cpf && <p><strong>CPF:</strong> {analysisResult.cpf}</p>}
                            {analysisResult.dataNascimento && <p><strong>Nascimento:</strong> {analysisResult.dataNascimento}</p>}
                            {analysisResult.nomeMae && <p><strong>Mãe:</strong> {analysisResult.nomeMae}</p>}
                            {analysisResult.rg && <p><strong>RG:</strong> {analysisResult.rg}</p>}
                            {!analysisResult.nomeCompleto && !analysisResult.cpf && !analysisResult.dataNascimento && !analysisResult.nomeMae && !analysisResult.rg && <p className="text-muted-foreground">Nenhum dado relevante extraído.</p>}
                          </>}
                        </div>
                      )}
                    </li>
                  );
                })}
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
          disabled={processState.attachedDocumentNames.length < MIN_DOCUMENTS || analyzingDocName !== null}
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Próximo <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
