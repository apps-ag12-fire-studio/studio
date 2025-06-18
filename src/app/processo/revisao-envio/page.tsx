
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
  BuyerInfo,
  CompanyInfo,
  DocumentFile,
} from "@/lib/process-store";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { ArrowLeft, Printer, ListChecks, FileText, UserRound, Camera, UserCog, Users as PlayersIcon, Building, Loader2, Info } from "lucide-react";


const attemptToPreFillInfo = (
  processState: StoredProcessState,
  currentBuyer: BuyerInfo,
  currentCompany: CompanyInfo | null
): { buyerInfo: BuyerInfo, companyInfo: CompanyInfo | null } => {

  let newBuyerInfo: BuyerInfo = { ...currentBuyer }; // Start with a copy
  let newCompanyInfo: CompanyInfo | null = currentCompany ? { ...currentCompany } : (
    processState.buyerType === 'pj' ? { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) } : null
  );

  const getAnalysisDataFromDocKey = (docKey: keyof StoredProcessState): ExtractBuyerDocumentDataOutput | null => {
    const docFile = processState[docKey] as DocumentFile | null;
    if (docFile?.analysisResult && !(docFile.analysisResult as any).error) {
      return docFile.analysisResult as ExtractBuyerDocumentDataOutput;
    }
    return null;
  };

  // Prepare a structure for preFilled values to avoid direct mutation issues later
  const preFilledValues = {
    buyer: {
      nome: currentBuyer.nome,
      cpf: currentBuyer.cpf,
      email: currentBuyer.email,
      telefone: currentBuyer.telefone,
    },
    company: newCompanyInfo ? {
      razaoSocial: newCompanyInfo.razaoSocial,
      nomeFantasia: newCompanyInfo.nomeFantasia,
      cnpj: newCompanyInfo.cnpj,
    } : null,
  };


  if (processState.buyerType === 'pf') {
    const rgAntigoFrenteData = getAnalysisDataFromDocKey('rgAntigoFrente');
    const cnhAntigaFrenteData = getAnalysisDataFromDocKey('cnhAntigaFrente');
    const docData = rgAntigoFrenteData || cnhAntigaFrenteData;

    if (docData) {
      if (docData.nomeCompleto) preFilledValues.buyer.nome = docData.nomeCompleto;
      if (docData.cpf) preFilledValues.buyer.cpf = docData.cpf;
    }
  }
  else if (processState.buyerType === 'pj' && preFilledValues.company) {
    const cartaoCnpjData = getAnalysisDataFromDocKey('cartaoCnpjFile');
    const docSocioData = getAnalysisDataFromDocKey('docSocioFrente');

    if (cartaoCnpjData) {
      if (cartaoCnpjData.nomeCompleto) {
        preFilledValues.company.razaoSocial = cartaoCnpjData.nomeCompleto;
      }
      const potentialCnpjFromCpf = cartaoCnpjData.cpf?.replace(/\D/g,'');
      if (potentialCnpjFromCpf && potentialCnpjFromCpf.length === 14 ) {
        preFilledValues.company.cnpj = cartaoCnpjData.cpf!;
      } else {
        const potentialCnpjFromRg = cartaoCnpjData.rg?.replace(/\D/g,'');
        if (potentialCnpjFromRg && potentialCnpjFromRg.length === 14) {
            preFilledValues.company.cnpj = cartaoCnpjData.rg!;
        }
      }
    }

    if (docSocioData) {
      if (docSocioData.nomeCompleto) preFilledValues.buyer.nome = docSocioData.nomeCompleto;
      if (docSocioData.cpf) preFilledValues.buyer.cpf = docSocioData.cpf;
    }
  }

  const contractData = processState.extractedData;
  if (contractData?.nomesDasPartes) {
    for (let i = 0; i < contractData.nomesDasPartes.length; i++) {
      const parteNomeCompleto = contractData.nomesDasPartes[i];
      const parteNomeUpper = parteNomeCompleto.toUpperCase();

      if (parteNomeUpper.includes("COMPRADOR") || parteNomeUpper.includes("CLIENTE") || parteNomeUpper.includes("CONTRATANTE")) {
        // Only update if preFilledValues.buyer.nome is currently empty or default from initial state
        if (preFilledValues.buyer.nome === currentBuyer.nome && (currentBuyer.nome === '' || currentBuyer.nome === initialStoredProcessState.buyerInfo.nome)) {
          let nomeExtraido = parteNomeCompleto.split(/,|\bCOMPRADOR\b|\bCLIENTE\b|\bCONTRATANTE\b/i)[0].trim();
          nomeExtraido = nomeExtraido.replace(/\b(SR\.?|SRA\.?|DR\.?|DRA\.?)\b/gi, '').trim();
          if (nomeExtraido) preFilledValues.buyer.nome = nomeExtraido;
        }
        if (preFilledValues.buyer.cpf === currentBuyer.cpf && (currentBuyer.cpf === '' || currentBuyer.cpf === initialStoredProcessState.buyerInfo.cpf) && contractData.documentosDasPartes && contractData.documentosDasPartes[i]) {
          const docFormatado = contractData.documentosDasPartes[i];
          const docNumeros = docFormatado.replace(/\D/g, '');
          if (docNumeros.length === 11) preFilledValues.buyer.cpf = docFormatado;
        }
      }

      if (processState.buyerType === 'pj' && preFilledValues.company && newCompanyInfo) {
         if (preFilledValues.company.razaoSocial === newCompanyInfo.razaoSocial && (newCompanyInfo.razaoSocial === '' || newCompanyInfo.razaoSocial === (initialStoredProcessState.companyInfo?.razaoSocial || '')) && (parteNomeUpper.includes("EMPRESA") || parteNomeUpper.includes("LTDA") || parteNomeUpper.includes("S.A") || parteNomeUpper.includes("S/A"))) {
             let nomeEmpresaExtraido = parteNomeCompleto.split(/,|\bCNPJ\b/i)[0].trim();
             if (nomeEmpresaExtraido) preFilledValues.company.razaoSocial = nomeEmpresaExtraido;
         }
         if (preFilledValues.company.cnpj === newCompanyInfo.cnpj && (newCompanyInfo.cnpj === '' || newCompanyInfo.cnpj === (initialStoredProcessState.companyInfo?.cnpj || '')) && contractData.documentosDasPartes && contractData.documentosDasPartes[i]) {
            const docFormatado = contractData.documentosDasPartes[i];
            const docNumeros = docFormatado.replace(/\D/g, '');
            if (docNumeros.length === 14) preFilledValues.company.cnpj = docFormatado;
         }
      }
    }
  }
  return { buyerInfo: preFilledValues.buyer, companyInfo: preFilledValues.company };
};

const isExtractedDataEmpty = (data: StoredProcessState['extractedData']): boolean => {
  if (!data) return true;
  return !Object.values(data).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  });
};

const isInternalTeamMemberInfoEmpty = (data: StoredProcessState['internalTeamMemberInfo'] | undefined): boolean => {
  if (!data) return true;
  return !data.nome || !data.cpf || !data.telefone || !data.email;
};

const getMissingFieldsList = (state: StoredProcessState): string[] => {
  const missingFields: string[] = [];

  if (isInternalTeamMemberInfoEmpty(state.internalTeamMemberInfo)) {
    missingFields.push("Informações do Responsável Interno (Nome, CPF, Telefone, E-mail) - Etapa 1: Dados Iniciais.");
  }

  if (state.contractSourceType === 'existing') {
    if (!state.selectedPlayer) {
      missingFields.push("Player (Expert) não selecionado - Etapa 1: Dados Iniciais.");
    }
    if (!state.extractedData || isExtractedDataEmpty(state.extractedData)) {
      missingFields.push("Modelo de contrato não carregado para o Player - Etapa 1: Dados Iniciais.");
    }
  }

  if (state.contractSourceType === 'new') {
    if (!state.contractPhotoPreview) {
      missingFields.push("Foto do contrato original não carregada - Etapa 2: Foto do Contrato.");
    } else if (!state.photoVerified) {
      missingFields.push("Foto do contrato original não verificada pela IA - Etapa 2: Foto do Contrato.");
    }

    if (state.photoVerified && (!state.extractedData || isExtractedDataEmpty(state.extractedData))) {
      missingFields.push("Dados do contrato original não extraídos/preenchidos após verificação - Etapa 2: Foto do Contrato.");
    }
  }

  if (state.buyerType === 'pf') {
    const hasRgAntigo = state.rgAntigoFrente?.previewUrl && state.rgAntigoVerso?.previewUrl;
    const hasCnhAntiga = state.cnhAntigaFrente?.previewUrl && state.cnhAntigaVerso?.previewUrl;
    if (!(hasRgAntigo || hasCnhAntiga)) {
      missingFields.push("Documento pessoal (RG Antigo ou CNH Antiga - frente e verso) não anexado - Etapa 3: Documentos.");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Comprovante de endereço pessoal não anexado - Etapa 3: Documentos.");
    }
  } else { // PJ
    if (!state.companyInfo?.razaoSocial) {
      missingFields.push("Razão Social da empresa não informada - Etapa 3 (Documentos) ou preencha aqui (Etapa 4).");
    }
    if (!state.companyInfo?.cnpj) {
      missingFields.push("CNPJ da empresa não informado - Etapa 3 (Documentos) ou preencha aqui (Etapa 4).");
    }

    if (!state.cartaoCnpjFile?.previewUrl) {
      missingFields.push("Cartão CNPJ não anexado - Etapa 3: Documentos.");
    }
    if (!(state.docSocioFrente?.previewUrl && state.docSocioVerso?.previewUrl)) {
      missingFields.push("Documento do Sócio/Representante (frente e verso) não anexado - Etapa 3: Documentos.");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Comprovante de endereço da empresa não anexado - Etapa 3: Documentos.");
    }
  }

  if (!state.buyerInfo?.nome) {
    missingFields.push("Nome do comprador/representante não informado - Etapa 3 (Documentos) ou preencha aqui (Etapa 4).");
  }
  if (!state.buyerInfo?.cpf) {
    missingFields.push("CPF do comprador/representante não informado - Etapa 3 (Documentos) ou preencha aqui (Etapa 4).");
  }
  if (!state.buyerInfo?.telefone) {
    missingFields.push("Telefone do comprador/representante não informado - Preencha aqui (Etapa 4).");
  }
  if (!state.buyerInfo?.email) {
    missingFields.push("E-mail do comprador/representante não informado - Preencha aqui (Etapa 4).");
  }
  return missingFields;
};


export default function RevisaoEnvioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [isStateLoading, setIsStateLoading] = useState(true);
  const [currentBuyerInfo, setCurrentBuyerInfo] = useState<BuyerInfo>(initialStoredProcessState.buyerInfo);
  const [currentCompanyInfo, setCurrentCompanyInfo] = useState<CompanyInfo | null>(initialStoredProcessState.companyInfo);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const loadInitialState = async () => {
      setIsStateLoading(true);
      const loadedState = await loadProcessState();
      setProcessState(loadedState);

      const initialBuyer = loadedState.buyerInfo ? { ...loadedState.buyerInfo } : { ...initialStoredProcessState.buyerInfo };
      const initialCompany = loadedState.buyerType === 'pj'
        ? (loadedState.companyInfo ? { ...loadedState.companyInfo } : { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) })
        : null;
      
      // Initialize currentBuyerInfo and currentCompanyInfo directly from loadedState or defaults
      setCurrentBuyerInfo(initialBuyer);
      setCurrentCompanyInfo(initialCompany);
      
      // The pre-fill logic will run in the subsequent effect
      setIsStateLoading(false);
    };
    loadInitialState();
  }, []);

 useEffect(() => {
    if (isStateLoading) return; // Don't run pre-fill if initial state is still loading

    const { buyerInfo: preFilledBuyerValues, companyInfo: preFilledCompanyValues } = attemptToPreFillInfo(
      processState,
      currentBuyerInfo,
      currentCompanyInfo
    );

    let buyerInfoUpdates: Partial<BuyerInfo> = {};
    let companyInfoUpdates: Partial<CompanyInfo> = {};
    let buyerActuallyChanged = false;
    let companyActuallyChanged = false;

    // Check and update buyerInfo
    if (preFilledBuyerValues.nome && (currentBuyerInfo.nome === '' || currentBuyerInfo.nome === initialStoredProcessState.buyerInfo.nome) && currentBuyerInfo.nome !== preFilledBuyerValues.nome) {
      buyerInfoUpdates.nome = preFilledBuyerValues.nome;
      buyerActuallyChanged = true;
    }
    if (preFilledBuyerValues.cpf && (currentBuyerInfo.cpf === '' || currentBuyerInfo.cpf === initialStoredProcessState.buyerInfo.cpf) && currentBuyerInfo.cpf !== preFilledBuyerValues.cpf) {
      buyerInfoUpdates.cpf = preFilledBuyerValues.cpf;
      buyerActuallyChanged = true;
    }
    // Add similar checks for email and telefone if pre-filled
    if (preFilledBuyerValues.email && (currentBuyerInfo.email === '' || currentBuyerInfo.email === initialStoredProcessState.buyerInfo.email) && currentBuyerInfo.email !== preFilledBuyerValues.email) {
      buyerInfoUpdates.email = preFilledBuyerValues.email;
      buyerActuallyChanged = true;
    }
    if (preFilledBuyerValues.telefone && (currentBuyerInfo.telefone === '' || currentBuyerInfo.telefone === initialStoredProcessState.buyerInfo.telefone) && currentBuyerInfo.telefone !== preFilledBuyerValues.telefone) {
      buyerInfoUpdates.telefone = preFilledBuyerValues.telefone;
      buyerActuallyChanged = true;
    }


    if (buyerActuallyChanged) {
      setCurrentBuyerInfo(prev => ({ ...prev, ...buyerInfoUpdates }));
    }

    // Check and update companyInfo (only if buyerType is 'pj')
    if (processState.buyerType === 'pj' && preFilledCompanyValues && currentCompanyInfo) {
      if (preFilledCompanyValues.razaoSocial && (currentCompanyInfo.razaoSocial === '' || currentCompanyInfo.razaoSocial === (initialStoredProcessState.companyInfo?.razaoSocial || '')) && currentCompanyInfo.razaoSocial !== preFilledCompanyValues.razaoSocial) {
        companyInfoUpdates.razaoSocial = preFilledCompanyValues.razaoSocial;
        companyActuallyChanged = true;
      }
      if (preFilledCompanyValues.cnpj && (currentCompanyInfo.cnpj === '' || currentCompanyInfo.cnpj === (initialStoredProcessState.companyInfo?.cnpj || '')) && currentCompanyInfo.cnpj !== preFilledCompanyValues.cnpj) {
        companyInfoUpdates.cnpj = preFilledCompanyValues.cnpj;
        companyActuallyChanged = true;
      }
      // Add similar checks for nomeFantasia if pre-filled
       if (preFilledCompanyValues.nomeFantasia && (currentCompanyInfo.nomeFantasia === '' || currentCompanyInfo.nomeFantasia === (initialStoredProcessState.companyInfo?.nomeFantasia || '')) && currentCompanyInfo.nomeFantasia !== preFilledCompanyValues.nomeFantasia) {
        companyInfoUpdates.nomeFantasia = preFilledCompanyValues.nomeFantasia;
        companyActuallyChanged = true;
      }

      if (companyActuallyChanged) {
        setCurrentCompanyInfo(prev => prev ? ({ ...prev, ...companyInfoUpdates }) : null);
      }
    }
  }, [
    isStateLoading,
    processState, // Main trigger for re-evaluating pre-fill
    currentBuyerInfo, // To compare against pre-filled values
    currentCompanyInfo // To compare against pre-filled values
  ]);


  const handleBuyerInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    const { value } = e.target;
    setCurrentBuyerInfo(prev => {
      const updated = { ...prev, [field]: value };
      setProcessState(currentMainState => ({
        ...currentMainState,
        buyerInfo: updated
      }));
      return updated;
    });
  };

  const handleCompanyInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyInfo) => {
    if (processState.buyerType === 'pj') {
      const { value } = e.target;
      setCurrentCompanyInfo(prev => {
        const updated = prev ? { ...prev, [field]: value } : { razaoSocial: '', nomeFantasia: '', cnpj: '', [field]: value };
         setProcessState(currentMainState => ({
          ...currentMainState,
          companyInfo: updated
        }));
        return updated;
      });
    }
  };

  const updateGlobalStateBeforeAction = useCallback(() => {
    const updatedProcessState = {
      ...processState,
      buyerInfo: currentBuyerInfo,
      companyInfo: currentCompanyInfo,
    };
    // No longer calling setProcessState here to avoid potential loops with the unmount effect
    saveProcessState(updatedProcessState);
    return updatedProcessState;
  }, [processState, currentBuyerInfo, currentCompanyInfo]);


  const isPrintDisabled = useCallback(() => {
    // Use current state values directly for validation
    const stateForValidation: StoredProcessState = {
      ...processState, // Most up-to-date processState
      buyerInfo: currentBuyerInfo,
      companyInfo: currentCompanyInfo,
    };
    return getMissingFieldsList(stateForValidation).length > 0;
  }, [processState, currentBuyerInfo, currentCompanyInfo]);

  const showPendingChecks = () => {
    const stateForValidation: StoredProcessState = {
      ...processState, buyerInfo: currentBuyerInfo, companyInfo: currentCompanyInfo,
    };
    const missingFields = getMissingFieldsList(stateForValidation);

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
    } else {
      toast({
        title: "Tudo Certo!",
        description: "Todos os dados necessários estão preenchidos. Você pode prosseguir para a impressão.",
        className: "bg-green-600 text-primary-foreground border-green-700",
        duration: 5000,
      });
    }
  };


  const handlePrepareForPrint = () => {
    setIsPreparingPrint(true);
    const finalProcessStateForPrint = updateGlobalStateBeforeAction(); // Saves currentBuyerInfo and currentCompanyInfo into processState structure and persists it

    const missingFields = getMissingFieldsList(finalProcessStateForPrint);
    if (missingFields.length > 0) {
      showPendingChecks();
      setIsPreparingPrint(false);
      return;
    }
    // State already saved by updateGlobalStateBeforeAction
    saveProcessState({ ...finalProcessStateForPrint, currentStep: "/print-contract" });
    toast({ title: "Etapa 4 Concluída!", description: "Informações salvas. Carregando contrato para impressão...", className: "bg-green-600 text-primary-foreground border-green-700"});
    router.push('/print-contract');
  };

  const handleBack = () => {
    setIsNavigating(true);
    updateGlobalStateBeforeAction(); // Save current form values to processState before navigating
    router.push("/processo/documentos");
  };

  // Save state on unmount or when essential data changes, if not navigating via main buttons
  useEffect(() => {
    return () => {
      if (!isNavigating && !isPreparingPrint) {
        // Construct the state to save using the most current local states
        const stateToSaveOnUnmount: StoredProcessState = {
          ...processState, // Base processState
          buyerInfo: currentBuyerInfo, // Latest from its own state
          companyInfo: currentCompanyInfo, // Latest from its own state
        };
        saveProcessState(stateToSaveOnUnmount);
      }
    };
  }, [processState, currentBuyerInfo, currentCompanyInfo, isNavigating, isPreparingPrint]);


  if (isStateLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando dados do processo...</p>
      </div>
    );
  }

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
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><ListChecks className="mr-2 h-5 w-5" />O Contrato que será assinado é:</h3>
            <p className="text-foreground/80">{processState.contractSourceType === 'new' ? 'Um Novo Modelo de Contrato (Foto)' : 'Contrato Validado pela ADM (Modelo)'}</p>
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
        <CardFooter className="p-6 flex flex-col sm:flex-row gap-4">
            <Button
                type="button"
                variant="outline"
                onClick={showPendingChecks}
                className="w-full sm:w-auto border-blue-500/70 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                disabled={isStateLoading || isPreparingPrint || isNavigating}
            >
                <Info className="mr-2 h-5 w-5" /> Verificar Pendências
            </Button>
            <Button
                type="button"
                onClick={handlePrepareForPrint}
                className="w-full sm:flex-1 bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted"
                disabled={isStateLoading || isPreparingPrint || isNavigating || isPrintDisabled()}
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
        </CardFooter>
      </Card>

      <div className="flex justify-start mt-8">
        <Button
          onClick={handleBack}
          variant="outline"
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
          disabled={isStateLoading || isPreparingPrint || isNavigating}
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Documentos
        </Button>
      </div>
    </>
  );
}
