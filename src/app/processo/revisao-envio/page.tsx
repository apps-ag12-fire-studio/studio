
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
  BuyerType
} from "@/lib/process-store";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowLeft, Printer, ListChecks, FileText, UserRound, Camera, Paperclip, UserCog, Users as PlayersIcon, Edit3, Building } from "lucide-react";


const attemptToPreFillInfo = (
  processState: StoredProcessState
): { buyerInfo: BuyerInfo, companyInfo: CompanyInfo | null } => {
  const newBuyerInfo: BuyerInfo = { ...(processState.buyerInfo || initialStoredProcessState.buyerInfo) };
  let newCompanyInfo: CompanyInfo | null = processState.buyerType === 'pj' ? { ...(processState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) } : null;

  const getAnalysisData = (docFile: DocumentFile | null): ExtractBuyerDocumentDataOutput | null => {
    if (docFile?.analysisResult && !(docFile.analysisResult as any).error) {
      return docFile.analysisResult as ExtractBuyerDocumentDataOutput;
    }
    return null;
  };
  
  // Try to prefill from document analysis first
  if (processState.buyerType === 'pf') {
    const rgFrenteData = getAnalysisData(processState.rgFrente);
    const cnhFrenteData = getAnalysisData(processState.cnhFrente);

    if (rgFrenteData?.nomeCompleto) newBuyerInfo.nome = rgFrenteData.nomeCompleto;
    else if (cnhFrenteData?.nomeCompleto) newBuyerInfo.nome = cnhFrenteData.nomeCompleto;

    if (rgFrenteData?.cpf) newBuyerInfo.cpf = rgFrenteData.cpf;
    else if (cnhFrenteData?.cpf) newBuyerInfo.cpf = cnhFrenteData.cpf;
    // Email and Telefone are not typically in RG/CNH for AI extraction by current flow
  } else if (processState.buyerType === 'pj' && newCompanyInfo) {
    const cartaoCnpjData = getAnalysisData(processState.cartaoCnpjFile);
    const docSocioData = getAnalysisData(processState.docSocioFrente);

    // For Company
    if (cartaoCnpjData?.nomeCompleto && !newCompanyInfo.razaoSocial) newCompanyInfo.razaoSocial = cartaoCnpjData.nomeCompleto; // AI might put company name here
    if (cartaoCnpjData?.rg && !newCompanyInfo.cnpj) newCompanyInfo.cnpj = cartaoCnpjData.rg; // AI might put CNPJ in RG field if numeric

    // For Representative (already filled in previous step, but can be augmented)
    if (docSocioData?.nomeCompleto && !newBuyerInfo.nome) newBuyerInfo.nome = docSocioData.nomeCompleto;
    if (docSocioData?.cpf && !newBuyerInfo.cpf) newBuyerInfo.cpf = docSocioData.cpf;
  }

  // Fallback to contract data if primary fields are still empty
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
      // For PJ, try to find company name in contract if not found from CNPJ card
      if (processState.buyerType === 'pj' && newCompanyInfo && !newCompanyInfo.razaoSocial) {
         if (parte.includes("EMPRESA") || parte.includes("LTDA") || parte.includes("S/A")) {
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


export default function RevisaoEnvioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [currentBuyerInfo, setCurrentBuyerInfo] = useState<BuyerInfo>(initialStoredProcessState.buyerInfo);
  const [currentCompanyInfo, setCurrentCompanyInfo] = useState<CompanyInfo | null>(initialStoredProcessState.companyInfo);
  
  useEffect(() => {
    const loadedState = loadProcessState();
    setProcessState(loadedState);

    // Attempt to pre-fill only if info hasn't been manually edited substantially or is still initial
    // This complex check helps preserve user edits if they navigate back and forth
    const isBuyerInfoInitial = JSON.stringify(loadedState.buyerInfo) === JSON.stringify(initialStoredProcessState.buyerInfo);
    const isCompanyInfoInitialOrNull = !loadedState.companyInfo || JSON.stringify(loadedState.companyInfo) === JSON.stringify({ razaoSocial: '', nomeFantasia: '', cnpj: '' });

    if (isBuyerInfoInitial && (loadedState.buyerType === 'pf' || (loadedState.buyerType === 'pj' && isCompanyInfoInitialOrNull))) {
      const { buyerInfo: preFilledBuyerInfo, companyInfo: preFilledCompanyInfo } = attemptToPreFillInfo(loadedState);
      setCurrentBuyerInfo(preFilledBuyerInfo);
      if (loadedState.buyerType === 'pj') {
        setCurrentCompanyInfo(preFilledCompanyInfo);
      } else {
        setCurrentCompanyInfo(null);
      }
    } else {
      setCurrentBuyerInfo(loadedState.buyerInfo);
      setCurrentCompanyInfo(loadedState.companyInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
  const handleBuyerInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    const updatedBuyerInfo = { ...currentBuyerInfo, [field]: e.target.value };
    setCurrentBuyerInfo(updatedBuyerInfo);
    setProcessState(prev => ({...prev, buyerInfo: updatedBuyerInfo})); // live update processState for review
  };

  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyInfo) => {
    const updatedCompanyInfo = { ...(currentCompanyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }), [field]: e.target.value };
    setCurrentCompanyInfo(updatedCompanyInfo);
     setProcessState(prev => ({...prev, companyInfo: updatedCompanyInfo})); // live update processState for review
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

  const isBuyerInfoComplete = (data: BuyerInfo): boolean => {
    return !!data.nome && !!data.cpf && !!data.telefone && !!data.email;
  }
  const isCompanyInfoComplete = (data: CompanyInfo | null): boolean => {
    return !!data && !!data.razaoSocial && !!data.cnpj;
  }

  const validatePage = () => {
    if (processState.buyerType === 'pf') {
      if (!isBuyerInfoComplete(currentBuyerInfo)) {
        toast({ title: "Campos Obrigatórios (Comprador PF)", description: "Preencha todas as 'Informações do Comprador'.", variant: "destructive" });
        return false;
      }
    } else { // PJ
      if (!isCompanyInfoComplete(currentCompanyInfo)) {
        toast({ title: "Campos Obrigatórios (Empresa)", description: "Preencha Razão Social e CNPJ da empresa.", variant: "destructive" });
        return false;
      }
      if (!isBuyerInfoComplete(currentBuyerInfo)) { // For representative
        toast({ title: "Campos Obrigatórios (Representante PJ)", description: "Preencha todas as 'Informações do Representante'.", variant: "destructive" });
        return false;
      }
    }
    return true;
  }

  const isPrintDisabled = useCallback((currentState: StoredProcessState, buyerData: BuyerInfo, companyData: CompanyInfo | null) => { 
    if (currentState.buyerType === 'pf') {
        if (!isBuyerInfoComplete(buyerData)) return true;
        if (!((currentState.rgFrente && currentState.rgVerso) || (currentState.cnhFrente && currentState.cnhVerso)) || !currentState.comprovanteEndereco) return true;
    } else { // PJ
        if (!isCompanyInfoComplete(companyData)) return true;
        if (!isBuyerInfoComplete(buyerData)) return true; // Representative
        if (!currentState.cartaoCnpjFile || !(currentState.docSocioFrente && currentState.docSocioVerso) || !currentState.comprovanteEndereco) return true;
    }
    if (isInternalTeamMemberInfoEmpty(currentState.internalTeamMemberInfo)) return true;

    if (currentState.contractSourceType === 'new') {
      if (!currentState.photoVerified || !currentState.extractedData || isExtractedDataEmpty(currentState.extractedData)) return true; 
    } else if (currentState.contractSourceType === 'existing') {
      if (!currentState.selectedPlayer || !currentState.extractedData || isExtractedDataEmpty(currentState.extractedData)) return true; 
    } else {
      return true; 
    }
    return false; 
  }, []);


  const handlePrepareForPrint = () => {
    if (!validatePage()) return;
    
    const finalProcessState = { ...processState, buyerInfo: currentBuyerInfo, companyInfo: currentCompanyInfo };
    if (isPrintDisabled(finalProcessState, currentBuyerInfo, currentCompanyInfo)){ 
       toast({ title: "Ação Necessária", description: "Complete todas as etapas e informações obrigatórias para preparar a impressão.", variant: "destructive" });
       return;
    }
    
    savePrintData({ 
      extractedData: finalProcessState.extractedData, 
      buyerInfo: finalProcessState.buyerInfo,
      companyInfo: finalProcessState.companyInfo,
      buyerType: finalProcessState.buyerType,
      selectedPlayer: finalProcessState.selectedPlayer,
      internalTeamMemberInfo: finalProcessState.internalTeamMemberInfo
    });
    saveProcessState({ ...finalProcessState, currentStep: "/print-contract" });
    toast({
      title: "Etapa 4 Concluída!",
      description: "Informações salvas. Contrato pronto para impressão.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push('/print-contract');
  };

  const handleBack = () => {
    saveProcessState({ ...processState, buyerInfo: currentBuyerInfo, companyInfo: currentCompanyInfo });
    router.push("/processo/documentos");
  };


  const displayDocumentStatus = (doc: DocumentFile | null, docName: string) => {
    if (!doc || !doc.name) return <p className="text-sm text-muted-foreground">{docName}: Não anexado</p>;
    let status = "";
    if (doc.analysisResult) {
      status = (doc.analysisResult as any).error ? "Falha na análise IA" : "Dados da IA disponíveis";
    }
    return <p className="text-sm text-foreground/80">{docName}: {doc.name} {status && <span className={`text-xs ml-1 ${ (doc.analysisResult as any).error ? 'text-red-400' : 'text-green-400'}`}>({status})</span>}</p>;
  };


  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
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
            Confirme ou preencha os dados. Para 'Novos Contratos', os campos podem ter sido pré-preenchidos pela análise da IA dos documentos anexados ou do contrato principal. Para 'Contratos Existentes', são baseados no modelo. Utilize os documentos anexados na etapa anterior como referência.
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
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><Building className="mr-2 h-5 w-5" />Dados da Empresa (para conferência)</h3>
                <p className="text-foreground/80"><strong>Razão Social:</strong> {currentCompanyInfo.razaoSocial || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Nome Fantasia:</strong> {currentCompanyInfo.nomeFantasia || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>CNPJ:</strong> {currentCompanyInfo.cnpj || 'Não informado'}</p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          <div className="space-y-1">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserRound className="mr-2 h-5 w-5" />{processState.buyerType === 'pf' ? "Dados do Comprador" : "Dados do Representante"} (para conferência)</h3>
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
                  {processState.photoVerified ? 'Foto Verificada com Sucesso' : 'Foto Não Verificada ou Com Falhas'}
                </p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}
           
          {processState.extractedData && !isExtractedDataEmpty(processState.extractedData) && (
            <div className="space-y-1">
              <h3 className="flex items-center text-lg font-semibold text-primary/90"><FileText className="mr-2 h-5 w-5" />Dados do Contrato {processState.contractSourceType === 'existing' ? `(Modelo de ${processState.selectedPlayer})` : '(Extraídos da Foto)'}</h3>
              <ul className="list-disc list-inside text-foreground/80 space-y-1 pl-2 text-sm">
                {processState.extractedData.objetoDoContrato && <li><strong>Objeto:</strong> {processState.extractedData.objetoDoContrato}</li>}
                {processState.extractedData.valorPrincipal && <li><strong>Valor:</strong> {processState.extractedData.valorPrincipal}</li>}
              </ul>
            </div>
          )}
           <hr className="border-border/30"/>
          
          <div className="space-y-1">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><Paperclip className="mr-2 h-5 w-5" />Documentos Anexados</h3>
            {processState.buyerType === 'pf' && (
              <>
                {displayDocumentStatus(processState.rgFrente, "RG (Frente)")}
                {displayDocumentStatus(processState.rgVerso, "RG (Verso)")}
                {displayDocumentStatus(processState.cnhFrente, "CNH (Frente)")}
                {displayDocumentStatus(processState.cnhVerso, "CNH (Verso)")}
              </>
            )}
            {processState.buyerType === 'pj' && (
              <>
                {displayDocumentStatus(processState.cartaoCnpjFile, "Cartão CNPJ")}
                {displayDocumentStatus(processState.docSocioFrente, "Doc. Sócio (Frente)")}
                {displayDocumentStatus(processState.docSocioVerso, "Doc. Sócio (Verso)")}
              </>
            )}
            {displayDocumentStatus(processState.comprovanteEndereco, "Comprovante de Endereço")}
             {!processState.rgFrente && !processState.cnhFrente && !processState.cartaoCnpjFile && !processState.comprovanteEndereco && (
                 <p className="text-sm text-muted-foreground">Nenhum documento específico anexado.</p>
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
                disabled={isPrintDisabled(processState, currentBuyerInfo, currentCompanyInfo)}
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
