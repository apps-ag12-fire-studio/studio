
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, clearProcessState, initialStoredProcessState, savePrintData } from "@/lib/process-store";
import { ArrowLeft, Printer, UploadCloud, Sparkles, Loader2, FileText, UserRound, Camera, ListChecks, Paperclip, UserCog, Users as PlayersIcon } from "lucide-react";

const MIN_DOCUMENTS = 2; 

export default function RevisaoEnvioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadedState = loadProcessState();
    // Basic validation on load - can be expanded
    if (!loadedState.buyerInfo.nome) {
        // Optionally redirect if core data is missing, e.g., router.replace('/processo/dados-iniciais');
        // For now, allow loading and let user see what's missing.
    }
    setProcessState(loadedState);
  }, [router, toast]);
  
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

  const handlePrepareForPrint = () => {
    if (isPrintDisabled()){
       toast({ title: "Ação Necessária", description: "Complete todas as etapas obrigatórias para preparar a impressão.", variant: "destructive" });
       return;
    }
    savePrintData({ 
      extractedData: processState.extractedData, 
      responsavel: processState.buyerInfo,
      selectedPlayer: processState.selectedPlayer // Pass selectedPlayer
    });
    saveProcessState({ ...processState, currentStep: "/print-contract" });
    router.push('/print-contract');
  };

  const handleSubmit = async () => {
    if (isSubmitDisabled()) {
      toast({ title: "Envio Interrompido", description: "Verifique se todas as informações e documentos necessários foram fornecidos.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Submitting data (simulated):", { 
        contractSourceType: processState.contractSourceType,
        selectedPlayer: processState.selectedPlayer,
        selectedContractTemplateName: processState.selectedContractTemplateName,
        contractPhotoName: processState.contractPhotoName, 
        attachedDocumentNames: processState.attachedDocumentNames, 
        extractedData: processState.extractedData,
        comprador: processState.buyerInfo,
        responsavelInterno: processState.internalTeamMemberInfo,
      });
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      
      console.log("\n--- SIMULANDO ENVIO DE EMAIL ---");
      const recipients = ['financeiro@empresa.com', 'juridico@empresa.com'];
      if (processState.buyerInfo.email) {
        recipients.push(processState.buyerInfo.email);
      }
      console.log(`Destinatários: ${recipients.join(', ')}`);
      const subject = `Novo Contrato Submetido: ${processState.extractedData?.objetoDoContrato || 'Detalhes do Contrato'} - Comprador: ${processState.buyerInfo.nome} ${processState.selectedPlayer ? `(Player: ${processState.selectedPlayer})` : ''}`;
      console.log(`Assunto: ${subject}`);
      let emailBody = `Um novo contrato foi submetido com os seguintes detalhes:\n`;
      if (processState.selectedPlayer) {
        emailBody += `Player: ${processState.selectedPlayer}\n`;
      }
      if (processState.selectedContractTemplateName) {
        emailBody += `Modelo do Contrato: ${processState.selectedContractTemplateName}\n`;
      }
      emailBody += `Comprador: ${processState.buyerInfo.nome} (CPF: ${processState.buyerInfo.cpf})\n`;
      emailBody += `Objeto do Contrato: ${processState.extractedData?.objetoDoContrato || 'N/A'}\n`;
      emailBody += `Valor Principal: ${processState.extractedData?.valorPrincipal || 'N/A'}\n`;
      emailBody += `Condições de Pagamento: ${processState.extractedData?.condicoesDePagamento || 'N/A'}\n`;
      emailBody += `Documentos Anexados: ${processState.attachedDocumentNames.join(', ')}\n`;
      if (!isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo)) {
        emailBody += `Processo conduzido por (Time Interno): ${processState.internalTeamMemberInfo.nome} (${processState.internalTeamMemberInfo.email || 'Email não informado'})\n`;
      }
      console.log(`Corpo do Email (resumido):\n${emailBody}`);
      console.log("--- FIM DA SIMULAÇÃO DE EMAIL ---\n");

      toast({ title: "Operação Concluída!", description: "Contrato e documentos enviados com sucesso (simulado).", className: "bg-primary text-primary-foreground border-primary-foreground/30"});
      clearProcessState();
      router.push("/confirmation");

    } catch (error) {
      console.error("Submission Error:", error);
      toast({ title: "Erro no Envio", description: "Não foi possível enviar os dados. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    saveProcessState(processState);
    router.push("/processo/documentos");
  };

  const isPrintDisabled = () => {
    if (!processState.buyerInfo.nome || !processState.buyerInfo.cpf || !processState.buyerInfo.telefone || !processState.buyerInfo.email) return true; 
    if (processState.attachedDocumentNames.length < MIN_DOCUMENTS) return true; 

    if (processState.contractSourceType === 'new') {
      if (!processState.photoVerified) return true; 
      if (!processState.extractedData || isExtractedDataEmpty(processState.extractedData)) return true; 
    } else if (processState.contractSourceType === 'existing') {
      if (!processState.selectedPlayer) return true;
      if (!processState.extractedData || isExtractedDataEmpty(processState.extractedData)) return true; 
    } else {
      return true; 
    }
    return false; 
  };

  const isSubmitDisabled = () => {
    if (isSubmitting) return true;
    return isPrintDisabled(); 
  };


  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
          Passo 4: Revisão e Envio
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">Revisar Informações</CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Confira todos os dados antes de prosseguir.</CardDescription>
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
          
          <div className="space-y-2">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserRound className="mr-2 h-5 w-5" />Informações do Comprador</h3>
            <p className="text-foreground/80"><strong>Nome:</strong> {processState.buyerInfo.nome || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>CPF:</strong> {processState.buyerInfo.cpf || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>Telefone:</strong> {processState.buyerInfo.telefone || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>E-mail:</strong> {processState.buyerInfo.email || 'Não informado'}</p>
          </div>
          <hr className="border-border/30"/>

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
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><Camera className="mr-2 h-5 w-5" />Foto do Contrato</h3>
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
            <CardDescription className="text-foreground/70 pt-1">Gere o contrato para impressão física.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
             <Button type="button" onClick={handlePrepareForPrint} className="w-full bg-gradient-to-br from-green-600 to-green-800 hover:from-green-600/90 hover:to-green-800/90 text-lg py-6 rounded-lg text-white shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted" disabled={isPrintDisabled()}>
                <Printer className="mr-2 h-6 w-6" /> Preparar Contrato para Impressão
            </Button>
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><UploadCloud className="mr-3 h-7 w-7" />Enviar Processo</CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Finalize e envie o contrato e os documentos.</CardDescription>
        </CardHeader>
        <CardFooter className="p-6">
          <Button type="button" onClick={handleSubmit} disabled={isSubmitDisabled()} className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted">
            {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Sparkles className="mr-2 h-6 w-6" />}
            {isSubmitting ? "Enviando..." : "Enviar Contrato e Documentos"}
          </Button>
        </CardFooter>
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
