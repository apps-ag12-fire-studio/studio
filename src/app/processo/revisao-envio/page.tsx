
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  StoredProcessState, 
  loadProcessState, 
  saveProcessState, 
  initialStoredProcessState, 
  savePrintData, 
  BuyerInfo,
  CompanyInfo,
  DocumentFile,
  BuyerType,
  PrintData 
} from "@/lib/process-store";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowLeft, Printer, ListChecks, FileText, UserRound, Camera, Paperclip, UserCog, Users as PlayersIcon, Building, Loader2 } from "lucide-react";


const attemptToPreFillInfo = (
  processState: StoredProcessState
): { buyerInfo: BuyerInfo, companyInfo: CompanyInfo | null } => {
  let newBuyerInfo: BuyerInfo = { ...(processState.buyerInfo || initialStoredProcessState.buyerInfo) };
  let newCompanyInfo: CompanyInfo | null = processState.buyerType === 'pj' ? { ...(processState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) } : null;

  const getAnalysisDataFromDocKey = (docKey: keyof StoredProcessState): ExtractBuyerDocumentDataOutput | null => {
    const docFile = processState[docKey] as DocumentFile | null;
    if (docFile?.analysisResult && !(docFile.analysisResult as any).error) {
      return docFile.analysisResult as ExtractBuyerDocumentDataOutput;
    }
    return null;
  };
  
  if (processState.buyerType === 'pf') {
    const rgAntigoFrenteData = getAnalysisDataFromDocKey('rgAntigoFrente');
    const cnhAntigaFrenteData = getAnalysisDataFromDocKey('cnhAntigaFrente');
    
    const docData = rgAntigoFrenteData || cnhAntigaFrenteData;

    if (docData?.nomeCompleto && !newBuyerInfo.nome) newBuyerInfo.nome = docData.nomeCompleto;
    if (docData?.cpf && !newBuyerInfo.cpf) newBuyerInfo.cpf = docData.cpf;
  } else if (processState.buyerType === 'pj' && newCompanyInfo) {
    const cartaoCnpjData = getAnalysisDataFromDocKey('cartaoCnpjFile'); 
    const docSocioData = getAnalysisDataFromDocKey('docSocioFrente');

    if (cartaoCnpjData?.nomeCompleto && !newCompanyInfo.razaoSocial) newCompanyInfo.razaoSocial = cartaoCnpjData.nomeCompleto; 
    if (cartaoCnpjData?.rg && !newCompanyInfo.cnpj && cartaoCnpjData.rg.replace(/\D/g,'').length === 14) newCompanyInfo.cnpj = cartaoCnpjData.rg;
    else if (cartaoCnpjData?.cpf && !newCompanyInfo.cnpj && cartaoCnpjData.cpf.replace(/\D/g,'').length === 14) newCompanyInfo.cnpj = cartaoCnpjData.cpf;


    if (docSocioData?.nomeCompleto && !newBuyerInfo.nome) newBuyerInfo.nome = docSocioData.nomeCompleto;
    if (docSocioData?.cpf && !newBuyerInfo.cpf) newBuyerInfo.cpf = docSocioData.cpf;
  }

  const contractData = processState.extractedData;
  if (contractData?.nomesDasPartes) {
    for (let i = 0; i < contractData.nomesDasPartes.length; i++) {
      const parte = contractData.nomesDasPartes[i].toUpperCase();
      if (parte.includes("COMPRADOR") || parte.includes("CLIENTE") || parte.includes("CONTRATANTE")) {
        if (!newBuyerInfo.nome) {
          let nome = contractData.nomesDasPartes[i].split(/,|\bCOMPRADOR\b|\bCLIENTE\b|\bCONTRATANTE\b/i)[0].trim();
          nome = nome.replace(/\b(SR\.?|SRA\.?|DR\.?|DRA\.?)\b/gi, '').trim();
          if (nome) newBuyerInfo.nome = nome;
        }
        if (!newBuyerInfo.cpf && contractData.documentosDasPartes && contractData.documentosDasPartes[i]) {
          const doc = contractData.documentosDasPartes[i].replace(/\D/g, '');
          if (doc.length === 11) newBuyerInfo.cpf = contractData.documentosDasPartes[i];
        }
      }
      if (processState.buyerType === 'pj' && newCompanyInfo && !newCompanyInfo.razaoSocial) {
         if (parte.includes("EMPRESA") || parte.includes("LTDA") || parte.includes("S.A") || parte.includes("S/A")) {
             let nomeEmpresa = contractData.nomesDasPartes[i].split(/,|\bCNPJ\b/i)[0].trim();
             if (nomeEmpresa) newCompanyInfo.razaoSocial = nomeEmpresa;
             if (contractData.documentosDasPartes && contractData.documentosDasPartes[i]) {
                const doc = contractData.documentosDasPartes[i].replace(/\D/g, '');
                if (doc.length === 14 && !newCompanyInfo.cnpj) newCompanyInfo.cnpj = contractData.documentosDasPartes[i];
             }
         }
      }
    }
  }
  return { buyerInfo: newBuyerInfo, companyInfo: newCompanyInfo };
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
  return !data.nome || !data.cpf || !data.telefone || !data.email;
};

const getMissingFieldsList = (state: StoredProcessState): string[] => {
  const missingFields: string[] = [];

  if (isInternalTeamMemberInfoEmpty(state.internalTeamMemberInfo)) {
    missingFields.push("Informações do Responsável Interno (Nome, CPF, Telefone, E-mail) - Etapa 1.");
  }
  if (state.contractSourceType === 'existing') {
    if (!state.selectedPlayer) missingFields.push("Player (Expert) não selecionado - Etapa 1.");
    if (!state.extractedData || isExtractedDataEmpty(state.extractedData)) {
      missingFields.push("Modelo de contrato não carregado para o Player - Etapa 1.");
    }
  }

  if (state.contractSourceType === 'new') {
    if (!state.contractPhotoPreview) missingFields.push("Foto do contrato original não carregada - Etapa 2.");
    else if (!state.photoVerified) missingFields.push("Foto do contrato original não verificada pela IA - Etapa 2.");
    
    if (state.photoVerified && (!state.extractedData || isExtractedDataEmpty(state.extractedData))) {
      missingFields.push("Dados do contrato original não extraídos/preenchidos após verificação - Etapa 2.");
    }
  }
  
  if (state.buyerType === 'pf') {
    const hasRgAntigo = state.rgAntigoFrente?.previewUrl && state.rgAntigoVerso?.previewUrl;
    const hasCnhAntiga = state.cnhAntigaFrente?.previewUrl && state.cnhAntigaVerso?.previewUrl;
    if (!(hasRgAntigo || hasCnhAntiga)) {
      missingFields.push("Documento pessoal (RG Antigo ou CNH Antiga - frente e verso) não anexado - Etapa 3.");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Comprovante de endereço pessoal não anexado - Etapa 3.");
    }
  } else { 
    if (!state.companyInfo?.razaoSocial) missingFields.push("Razão Social da empresa não informada - Etapa 3 ou preencha na Etapa 4.");
    if (!state.companyInfo?.cnpj) missingFields.push("CNPJ da empresa não informado - Etapa 3 ou preencha na Etapa 4.");
    
    if (!state.cartaoCnpjFile?.previewUrl) missingFields.push("Cartão CNPJ não anexado - Etapa 3.");
    if (!(state.docSocioFrente?.previewUrl && state.docSocioVerso?.previewUrl)) {
      missingFields.push("Documento do Sócio/Representante (frente e verso) não anexado - Etapa 3.");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Comprovante de endereço da empresa não anexado - Etapa 3.");
    }
  }

  if (!state.buyerInfo.nome) missingFields.push("Nome do comprador/representante não informado - Etapa 3 ou preencha na Etapa 4.");
  if (!state.buyerInfo.cpf) missingFields.push("CPF do comprador/representante não informado - Etapa 3 ou preencha na Etapa 4.");
  if (!state.buyerInfo.telefone) missingFields.push("Telefone do comprador/representante não informado - Preencha na Etapa 4.");
  if (!state.buyerInfo.email) missingFields.push("E-mail do comprador/representante não informado - Preencha na Etapa 4.");

  return missingFields;
};


export default function RevisaoEnvioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [currentBuyerInfo, setCurrentBuyerInfo] = useState<BuyerInfo>(initialStoredProcessState.buyerInfo);
  const [currentCompanyInfo, setCurrentCompanyInfo] = useState<CompanyInfo | null>(initialStoredProcessState.companyInfo);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  
  useEffect(() => {
    const loadedState = loadProcessState();
    setProcessState(loadedState);
    const { buyerInfo: preFilledBuyerInfo, companyInfo: preFilledCompanyInfo } = attemptToPreFillInfo(loadedState);
    setCurrentBuyerInfo(preFilledBuyerInfo);

    if (loadedState.buyerType === 'pj') {
      setCurrentCompanyInfo(preFilledCompanyInfo);
    } else {
      setCurrentCompanyInfo(null);
    }
  }, []); 
  
  const handleBuyerInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    const updatedBuyerInfo = { ...currentBuyerInfo, [field]: e.target.value };
    setCurrentBuyerInfo(updatedBuyerInfo);
    saveProcessState({ ...processState, buyerInfo: updatedBuyerInfo, companyInfo: currentCompanyInfo });
  };

  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyInfo) => {
    const updatedCompanyInfo = { ...(currentCompanyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }), [field]: e.target.value };
    setCurrentCompanyInfo(updatedCompanyInfo);
    saveProcessState({ ...processState, buyerInfo: currentBuyerInfo, companyInfo: updatedCompanyInfo });
  };

  const isPrintDisabled = useCallback(() => { 
    const currentState: StoredProcessState = { 
      ...processState, 
      buyerInfo: currentBuyerInfo, 
      companyInfo: currentCompanyInfo 
    };
    return getMissingFieldsList(currentState).length > 0;
  }, [processState, currentBuyerInfo, currentCompanyInfo]);


  const handlePrepareForPrint = () => {
    setIsPreparingPrint(true);
    const finalProcessState: StoredProcessState = { 
      ...processState, 
      buyerInfo: currentBuyerInfo, 
      companyInfo: currentCompanyInfo 
    };

    const missingFields = getMissingFieldsList(finalProcessState);

    if (missingFields.length > 0) {
      toast({
        title: "Dados Incompletos para Impressão",
        description: (
          <div className="max-h-60 overflow-y-auto">
            <p className="mb-2 font-semibold">Por favor, verifique e complete os seguintes itens. Use o botão "Voltar" para navegar para as etapas anteriores, se necessário:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {missingFields.map((field, index) => (
                <li key={index}>{field}</li>
              ))}
            </ul>
          </div>
        ),
        variant: "destructive",
        duration: 20000,
      });
      setIsPreparingPrint(false);
      return;
    }
    
    const printPayload: PrintData = { 
      extractedData: finalProcessState.extractedData, 
      buyerInfo: finalProcessState.buyerInfo,
      companyInfo: finalProcessState.companyInfo,
      buyerType: finalProcessState.buyerType,
      selectedPlayer: finalProcessState.selectedPlayer,
      internalTeamMemberInfo: finalProcessState.internalTeamMemberInfo,
      rgAntigoFrenteUrl: finalProcessState.rgAntigoFrente?.previewUrl,
      rgAntigoVersoUrl: finalProcessState.rgAntigoVerso?.previewUrl,
      cnhAntigaFrenteUrl: finalProcessState.cnhAntigaFrente?.previewUrl,
      cnhAntigaVersoUrl: finalProcessState.cnhAntigaVerso?.previewUrl,
      cartaoCnpjFileUrl: finalProcessState.cartaoCnpjFile?.previewUrl,
      docSocioFrenteUrl: finalProcessState.docSocioFrente?.previewUrl,
      docSocioVersoUrl: finalProcessState.docSocioVerso?.previewUrl,
      comprovanteEnderecoUrl: finalProcessState.comprovanteEndereco?.previewUrl,
    };
    savePrintData(printPayload);
    saveProcessState({ ...finalProcessState, currentStep: "/print-contract" }); 
    toast({
      title: "Etapa 4 Concluída!",
      description: "Informações salvas. Preparando contrato para impressão...",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push('/print-contract');
    //setIsPreparingPrint(false); // Not strictly necessary as component will unmount
  };

  const handleBack = () => {
    saveProcessState({ ...processState, buyerInfo: currentBuyerInfo, companyInfo: currentCompanyInfo });
    router.push("/processo/documentos");
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
          Passo 4: {processState.buyerType === 'pj' ? 'Dados da Empresa, Representante' : 'Dados do Comprador'} e Revisão Final
        </p>
      </header>

      {processState.buyerType === 'pj' && (
         <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6">
                <CardTitle className="flex items-center text-xl font-headline text-primary"><Building className="mr-3 h-6 w-6" />Informações da Empresa</CardTitle>
                <CardDescription className="text-foreground/70 pt-1">Confirme ou preencha os dados da empresa. Alguns campos podem ter sido pré-preenchidos pela IA (análise do Cartão CNPJ ou Contrato Principal).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6 pt-0">
                <div>
                    <Label htmlFor="razaoSocial">Razão Social</Label>
                    <Input id="razaoSocial" value={currentCompanyInfo?.razaoSocial || ''} onChange={(e) => handleCompanyInputChange(e, 'razaoSocial')} placeholder="Razão Social da Empresa" className="mt-1 bg-input"/>
                </div>
                <div>
                    <Label htmlFor="nomeFantasia">Nome Fantasia (Opcional)</Label>
                    <Input id="nomeFantasia" value={currentCompanyInfo?.nomeFantasia || ''} onChange={(e) => handleCompanyInputChange(e, 'nomeFantasia')} placeholder="Nome Fantasia" className="mt-1 bg-input"/>
                </div>
                <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" value={currentCompanyInfo?.cnpj || ''} onChange={(e) => handleCompanyInputChange(e, 'cnpj')} placeholder="00.000.000/0000-00" className="mt-1 bg-input"/>
                </div>
            </CardContent>
        </Card>
      )}

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm mt-8">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <UserRound className="mr-3 h-7 w-7" /> 
            {processState.buyerType === 'pf' ? "Informações do Comprador" : "Informações do Representante Legal"}
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1">
            Confirme ou preencha os dados. Alguns campos podem ter sido pré-preenchidos pela análise da IA dos documentos anexados ou do contrato principal. Utilize os documentos anexados na etapa anterior como referência.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="comprador-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
            <Input id="comprador-nome" value={currentBuyerInfo.nome} onChange={(e) => handleBuyerInputChange(e, 'nome')} placeholder="Nome completo" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
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
          <CardDescription className="text-foreground/70 pt-1">Confira os outros dados antes de prosseguir para impressão. As informações são atualizadas em tempo real conforme você edita os formulários acima.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-6 pt-0">
          <div className="space-y-1">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><ListChecks className="mr-2 h-5 w-5" />Origem do Contrato</h3>
            <p className="text-foreground/80">{processState.contractSourceType === 'new' ? 'Novo Contrato (Foto)' : 'Contrato Existente (Modelo)'}</p>
          </div>
          <hr className="border-border/30"/>

          {processState.contractSourceType === 'existing' && processState.selectedPlayer && (
            <>
              <div className="space-y-1">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><PlayersIcon className="mr-2 h-5 w-5" />Player Selecionado</h3>
                <p className="text-foreground/80">{processState.selectedPlayer}</p>
                {processState.selectedContractTemplateName && <p className="text-sm text-muted-foreground">Modelo: {processState.selectedContractTemplateName}</p>}
              </div>
              <hr className="border-border/30"/>
            </>
          )}
          
          {processState.buyerType === 'pj' && currentCompanyInfo && (
            <>
              <div className="space-y-1">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><Building className="mr-2 h-5 w-5" />Dados da Empresa</h3>
                <p className="text-foreground/80"><strong>Razão Social:</strong> {currentCompanyInfo.razaoSocial || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Nome Fantasia:</strong> {currentCompanyInfo.nomeFantasia || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>CNPJ:</strong> {currentCompanyInfo.cnpj || 'Não informado'}</p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          <div className="space-y-1">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserRound className="mr-2 h-5 w-5" />{processState.buyerType === 'pf' ? "Dados do Comprador" : "Dados do Representante"}</h3>
            <p className="text-foreground/80"><strong>Nome:</strong> {currentBuyerInfo.nome || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>CPF:</strong> {currentBuyerInfo.cpf || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>Telefone:</strong> {currentBuyerInfo.telefone || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>E-mail:</strong> {currentBuyerInfo.email || 'Não informado'}</p>
          </div>
          <hr className="border-border/30"/>
            
          {!isInternalTeamMemberInfoEmpty(processState.internalTeamMemberInfo) && (
            <>
              <div className="space-y-1">
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
              <div className="space-y-1">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><Camera className="mr-2 h-5 w-5" />Foto do Contrato Original</h3>
                <p className="text-foreground/80"><strong>Arquivo:</strong> {processState.contractPhotoName}</p>
                <p className={`text-sm ${processState.photoVerified ? 'text-green-400' : 'text-red-400'}`}>
                  {processState.photoVerified ? 'Foto Verificada com Sucesso' : 
                    (processState.photoVerificationResult?.reason ? `Falha na Verificação: ${processState.photoVerificationResult.reason}` : 'Foto Não Verificada ou Com Falhas')}
                </p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}
           
          {processState.extractedData && !isExtractedDataEmpty(processState.extractedData) && (
            <div className="space-y-1">
              <h3 className="flex items-center text-lg font-semibold text-primary/90"><FileText className="mr-2 h-5 w-5" />Dados do Contrato {processState.contractSourceType === 'existing' ? `(Modelo de ${processState.selectedPlayer || 'Player não definido'})` : '(Extraídos da Foto)'}</h3>
              <ul className="list-disc list-inside text-foreground/80 space-y-1 pl-2 text-sm">
                {processState.extractedData.objetoDoContrato && <li><strong>Objeto:</strong> {processState.extractedData.objetoDoContrato}</li>}
                {processState.extractedData.valorPrincipal && <li><strong>Valor:</strong> {processState.extractedData.valorPrincipal}</li>}
              </ul>
            </div>
          )}
           <hr className="border-border/30"/>
          
        </CardContent>
      </Card>
      
      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
         <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><Printer className="mr-3 h-7 w-7" />Preparar para Impressão</CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Gere o contrato para impressão física, assinatura e posterior anexo da foto do documento assinado.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
             <Button 
                type="button" 
                onClick={handlePrepareForPrint} 
                className="w-full bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted" 
                disabled={isPreparingPrint || isPrintDisabled()}
             >
                {isPreparingPrint ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-6 w-6" /> Preparar Contrato para Impressão
                  </>
                )}
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

    