
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, savePrintData, BuyerInfo } from "@/lib/process-store";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import { ArrowLeft, Printer, ListChecks, FileText, UserRound, Camera, Paperclip, UserCog, Users as PlayersIcon } from "lucide-react";

const MIN_DOCUMENTS = 2; 

// Helper function to attempt pre-filling buyer info from extracted contract data
const attemptToPreFillBuyerInfo = (extractedData: ExtractContractDataOutput | null): BuyerInfo => {
  const newBuyerInfo = { ...initialStoredProcessState.buyerInfo }; 
  if (extractedData?.nomesDasPartes) {
    for (let i = 0; i < extractedData.nomesDasPartes.length; i++) {
      const parte = extractedData.nomesDasPartes[i].toUpperCase();
      if (parte.includes("COMPRADOR") || parte.includes("CLIENTE")) {
        let nome = extractedData.nomesDasPartes[i].split(/,|\bCOMPRADOR\b|\bCLIENTE\b/i)[0].trim();
        nome = nome.replace(/\b(SR\.?|SRA\.?|DR\.?|DRA\.?)\b/gi, '').trim();
        newBuyerInfo.nome = nome;

        if (extractedData.documentosDasPartes && extractedData.documentosDasPartes[i]) {
          const doc = extractedData.documentosDasPartes[i].replace(/\D/g, '');
          if (doc.length === 11 || doc.length === 14) { 
               newBuyerInfo.cpf = extractedData.documentosDasPartes[i];
          }
        }
        break; 
      }
    }
  }
  return newBuyerInfo;
};


export default function RevisaoEnvioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [currentBuyerInfo, setCurrentBuyerInfo] = useState<BuyerInfo>(initialStoredProcessState.buyerInfo);
  
  useEffect(() => {
    const loadedState = loadProcessState();
    setProcessState(loadedState);

    // Attempt to pre-fill buyer info form based on data extracted from contract/model
    if (loadedState.extractedData) {
      const preFilledInfo = attemptToPreFillBuyerInfo(loadedState.extractedData);
      // Only update if the current buyer info in state is still initial (empty)
      // This prevents overwriting user's manual edits if they navigate back and forth
      if (JSON.stringify(currentBuyerInfo) === JSON.stringify(initialStoredProcessState.buyerInfo) || 
          JSON.stringify(loadedState.buyerInfo) === JSON.stringify(initialStoredProcessState.buyerInfo)) {
        setCurrentBuyerInfo(preFilledInfo);
        // Optionally save this pre-fill to global state immediately or wait for "Prepare for Print"
        // setProcessState(prevState => ({ ...prevState, buyerInfo: preFilledInfo }));
      } else {
        setCurrentBuyerInfo(loadedState.buyerInfo); // Load existing edits
      }
    } else {
        setCurrentBuyerInfo(loadedState.buyerInfo); // Load existing if no extractedData
    }
  }, []); // Removed currentBuyerInfo from dependency array to avoid loop on its own update
  
  const handleBuyerInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    setCurrentBuyerInfo(prevInfo => ({
      ...prevInfo,
      [field]: e.target.value,
    }));
  };

  const isExtractedDataEmpty = (data: StoredProcessState['extractedData']): boolean => {
    if (!data) return true;
    return !Object.values(data).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
  };
  
  const isInternalTeamMemberInfoEmpty = (data: StoredProcessState['internalTeamMemberInfo']): boolean => {
    if (!data) return true;
    return !data.nome && !data.cpf && !data.email && !data.telefone;
  }

  const validateBuyerInfo = () => {
    if (!currentBuyerInfo.nome || !currentBuyerInfo.cpf || !currentBuyerInfo.telefone || !currentBuyerInfo.email) {
      toast({ title: "Campos Obrigatórios", description: "Preencha todas as 'Informações do Comprador'.", variant: "destructive" });
      return false;
    }
    return true;
  }

  const handlePrepareForPrint = () => {
    if (!validateBuyerInfo()) return;

    const updatedProcessState = { ...processState, buyerInfo: currentBuyerInfo };

    if (isPrintDisabled(updatedProcessState)){ // Pass updated state for accurate check
       toast({ title: "Ação Necessária", description: "Complete todas as etapas e informações obrigatórias para preparar a impressão.", variant: "destructive" });
       return;
    }
    savePrintData({ 
      extractedData: updatedProcessState.extractedData, 
      responsavel: updatedProcessState.buyerInfo,
      selectedPlayer: updatedProcessState.selectedPlayer,
      internalTeamMemberInfo: updatedProcessState.internalTeamMemberInfo
    });
    saveProcessState({ ...updatedProcessState, currentStep: "/print-contract" });
    toast({
      title: "Etapa 4 Concluída!",
      description: "Informações do comprador salvas. Contrato pronto para impressão.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push('/print-contract');
  };

  const handleBack = () => {
    // Save current buyer info edits before going back
    saveProcessState({ ...processState, buyerInfo: currentBuyerInfo });
    router.push("/processo/documentos");
  };

  const isPrintDisabled = (currentState: StoredProcessState) => { // Takes state as argument
    if (!currentState.buyerInfo.nome || !currentState.buyerInfo.cpf || !currentState.buyerInfo.telefone || !currentState.buyerInfo.email) return true; 
    if (currentState.attachedDocumentNames.length < MIN_DOCUMENTS) return true; 
    if (isInternalTeamMemberInfoEmpty(currentState.internalTeamMemberInfo)) return true;

    if (currentState.contractSourceType === 'new') {
      if (!currentState.photoVerified) return true; 
      if (!currentState.extractedData || isExtractedDataEmpty(currentState.extractedData)) return true; 
    } else if (currentState.contractSourceType === 'existing') {
      if (!currentState.selectedPlayer) return true;
      if (!currentState.extractedData || isExtractedDataEmpty(currentState.extractedData)) return true; 
    } else {
      return true; 
    }
    return false; 
  };

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
          Passo 4: Informações do Comprador e Revisão Final
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <UserRound className="mr-3 h-7 w-7" /> Informações do Comprador
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1">
            Confirme ou preencha os dados do comprador. Para 'Novos Contratos', os campos podem ter sido pré-preenchidos pela análise da IA do contrato principal. Para 'Contratos Existentes', são baseados no modelo. Utilize os documentos anexados na etapa anterior como referência.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="comprador-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
            <Input id="comprador-nome" value={currentBuyerInfo.nome} onChange={(e) => handleBuyerInputChange(e, 'nome')} placeholder="Nome completo do comprador" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="comprador-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">CPF</Label>
              <Input id="comprador-cpf" value={currentBuyerInfo.cpf} onChange={(e) => handleBuyerInputChange(e, 'cpf')} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
            <div>
              <Label htmlFor="comprador-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Telefone (WhatsApp)</Label>
              <Input id="comprador-telefone" type="tel" value={currentBuyerInfo.telefone} onChange={(e) => handleBuyerInputChange(e, 'telefone')} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
          </div>
          <div>
            <Label htmlFor="comprador-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
            <Input id="comprador-email" type="email" value={currentBuyerInfo.email} onChange={(e) => handleBuyerInputChange(e, 'email')} placeholder="seu.email@dominio.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
        </CardContent>
      </Card>


      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><ListChecks className="mr-3 h-7 w-7" />Revisar Demais Informações</CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Confira os outros dados antes de prosseguir para impressão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div className="space-y-2">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><ListChecks className="mr-2 h-5 w-5" />Origem do Contrato</h3>
            <p className="text-foreground/80">{processState.contractSourceType === 'new' ? 'Novo Contrato (Foto)' : 'Contrato Existente (Modelo)'}</p>
          </div>
          <hr className="border-border/30"/>

          {processState.contractSourceType === 'existing' && processState.selectedPlayer && (
            <>
              <div className="space-y-2">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><PlayersIcon className="mr-2 h-5 w-5" />Player Selecionado</h3>
                <p className="text-foreground/80">{processState.selectedPlayer}</p>
                {processState.selectedContractTemplateName && <p className="text-sm text-muted-foreground">Modelo: {processState.selectedContractTemplateName}</p>}
              </div>
              <hr className="border-border/30"/>
            </>
          )}
          
          {!isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo) && (
            <>
              <div className="space-y-2">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserCog className="mr-2 h-5 w-5" />Responsável Interno</h3>
                <p className="text-foreground/80"><strong>Nome:</strong> {processState.internalTeamMemberInfo.nome}</p>
                <p className="text-foreground/80"><strong>CPF:</strong> {processState.internalTeamMemberInfo.cpf || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Telefone:</strong> {processState.internalTeamMemberInfo.telefone || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>E-mail:</strong> {processState.internalTeamMemberInfo.email || 'Não informado'}</p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          {processState.contractSourceType === 'new' && processState.contractPhotoName && (
            <>
              <div className="space-y-2">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><Camera className="mr-2 h-5 w-5" />Foto do Contrato Original</h3>
                <p className="text-foreground/80"><strong>Arquivo:</strong> {processState.contractPhotoName}</p>
                <p className={`text-sm ${processState.photoVerified ? 'text-green-400' : 'text-red-400'}`}>
                  {processState.photoVerified ? 'Foto Verificada com Sucesso' : 'Foto Não Verificada ou Com Falhas'}
                </p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}
           
          {processState.extractedData && !isExtractedDataEmpty(processState.extractedData) && (
            <div className="space-y-2">
              <h3 className="flex items-center text-lg font-semibold text-primary/90"><FileText className="mr-2 h-5 w-5" />Dados do Contrato {processState.contractSourceType === 'existing' ? `(Modelo de ${processState.selectedPlayer})` : '(Extraídos da Foto)'}</h3>
              <ul className="list-disc list-inside text-foreground/80 space-y-1 pl-2">
                {processState.extractedData.objetoDoContrato && <li><strong>Objeto:</strong> {processState.extractedData.objetoDoContrato}</li>}
                {processState.extractedData.valorPrincipal && <li><strong>Valor:</strong> {processState.extractedData.valorPrincipal}</li>}
                {processState.extractedData.condicoesDePagamento && <li><strong>Cond. Pagamento:</strong> {processState.extractedData.condicoesDePagamento}</li>}
                {processState.extractedData.prazoContrato && <li><strong>Prazo:</strong> {processState.extractedData.prazoContrato}</li>}
                {processState.extractedData.localEDataAssinatura && <li><strong>Local/Data Ass.:</strong> {processState.extractedData.localEDataAssinatura}</li>}
                {processState.extractedData.foroEleito && <li><strong>Foro:</strong> {processState.extractedData.foroEleito}</li>}
                {processState.extractedData.outrasObservacoesRelevantes && <li><strong>Obs.:</strong> {processState.extractedData.outrasObservacoesRelevantes}</li>}
              </ul>
            </div>
          )}
           <hr className="border-border/30"/>
          
          <div className="space-y-2">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><Paperclip className="mr-2 h-5 w-5" />Documentos Anexados</h3>
            {processState.attachedDocumentNames.length > 0 ? (
              <ul className="list-disc list-inside text-foreground/80 space-y-1 pl-2">
                {processState.attachedDocumentNames.map((name, index) => <li key={index}>{name}</li>)}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhum documento anexado.</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
         <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><Printer className="mr-3 h-7 w-7" />Preparar para Impressão</CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Gere o contrato para impressão física, assinatura e posterior anexo da foto do documento assinado.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
             <Button type="button" onClick={handlePrepareForPrint} className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted" 
                disabled={isPrintDisabled(processState)} // Pass current global state for initial check
             >
                <Printer className="mr-2 h-6 w-6" /> Preparar Contrato para Impressão
            </Button>
        </CardContent>
      </Card>

      <div className="flex justify-start mt-8">
        <Button 
          onClick={handleBack} 
          variant="outline"
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Documentos
        </Button>
      </div>
    </>
  );
}

    
