
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
import { ArrowLeft, Printer, ListChecks, FileText, UserRound, Camera, UserCog, Users as PlayersIcon, Building, Loader2, Info, Edit3, CheckCircle2, Home, MapPin } from "lucide-react"; 
import { EditInfoDialog, FieldConfig } from "@/components/processo/edit-info-dialog";


const attemptToPreFillInfo = (
  fullProcessState: StoredProcessState,
  currentBuyer: BuyerInfo,
  currentCompany: CompanyInfo | null
): { buyerInfo: BuyerInfo, companyInfo: CompanyInfo | null } => {

  let newBuyerInfo: BuyerInfo = { ...currentBuyer };
  let newCompanyInfo: CompanyInfo | null = currentCompany ? { ...currentCompany } : (
    fullProcessState.buyerType === 'pj' ? { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) } : null
  );

  const getAnalysisDataFromDocKey = (docKey: keyof StoredProcessState): ExtractBuyerDocumentDataOutput | null => {
    const docFile = fullProcessState[docKey] as DocumentFile | null;
    if (docFile?.analysisResult && !(docFile.analysisResult as any).error) {
      return docFile.analysisResult as ExtractBuyerDocumentDataOutput;
    }
    return null;
  };

  const comprovanteEnderecoData = getAnalysisDataFromDocKey('comprovanteEndereco');

  if (!newBuyerInfo.nome) {
    const rgData = getAnalysisDataFromDocKey('rgAntigoFrente');
    const cnhData = getAnalysisDataFromDocKey('cnhAntigaFrente');
    const socioData = getAnalysisDataFromDocKey('docSocioFrente');
    newBuyerInfo.nome = rgData?.nomeCompleto || cnhData?.nomeCompleto || socioData?.nomeCompleto || newBuyerInfo.nome;
  }
  if (!newBuyerInfo.cpf) {
    const rgData = getAnalysisDataFromDocKey('rgAntigoFrente');
    const cnhData = getAnalysisDataFromDocKey('cnhAntigaFrente');
    const socioData = getAnalysisDataFromDocKey('docSocioFrente');
    newBuyerInfo.cpf = rgData?.cpf || cnhData?.cpf || socioData?.cpf || newBuyerInfo.cpf;
  }

  // Preencher endereço do comprador
  if (!newBuyerInfo.logradouro && comprovanteEnderecoData?.logradouro) newBuyerInfo.logradouro = comprovanteEnderecoData.logradouro;
  if (!newBuyerInfo.bairro && comprovanteEnderecoData?.bairro) newBuyerInfo.bairro = comprovanteEnderecoData.bairro;
  if (!newBuyerInfo.cidade && comprovanteEnderecoData?.cidade) newBuyerInfo.cidade = comprovanteEnderecoData.cidade;
  if (!newBuyerInfo.estado && comprovanteEnderecoData?.estado) newBuyerInfo.estado = comprovanteEnderecoData.estado;
  if (!newBuyerInfo.cep && comprovanteEnderecoData?.cep) newBuyerInfo.cep = comprovanteEnderecoData.cep;


  if (fullProcessState.buyerType === 'pj' && newCompanyInfo) {
    const cartaoCnpjData = getAnalysisDataFromDocKey('cartaoCnpjFile');
    if (cartaoCnpjData) {
      if (!newCompanyInfo.razaoSocial && cartaoCnpjData.nomeCompleto) {
        newCompanyInfo.razaoSocial = cartaoCnpjData.nomeCompleto;
      }
      if (!newCompanyInfo.cnpj) {
        const potentialCnpjFromCpf = cartaoCnpjData.cpf?.replace(/\D/g,'');
        if (potentialCnpjFromCpf && potentialCnpjFromCpf.length === 14) {
          newCompanyInfo.cnpj = cartaoCnpjData.cpf!;
        } else {
          const potentialCnpjFromRg = cartaoCnpjData.rg?.replace(/\D/g,'');
          if (potentialCnpjFromRg && potentialCnpjFromRg.length === 14) {
            newCompanyInfo.cnpj = cartaoCnpjData.rg!;
          }
        }
      }
    }
  }

  const contractData = fullProcessState.extractedData;
  if (contractData?.nomesDasPartes) {
    for (let i = 0; i < contractData.nomesDasPartes.length; i++) {
      const parteNomeCompleto = contractData.nomesDasPartes[i];
      const parteNomeUpper = parteNomeCompleto.toUpperCase();

      if (parteNomeUpper.includes("COMPRADOR") || parteNomeUpper.includes("CLIENTE") || parteNomeUpper.includes("CONTRATANTE")) {
        if (!newBuyerInfo.nome) {
          let nomeExtraido = parteNomeCompleto.split(/,|\bCOMPRADOR\b|\bCLIENTE\b|\bCONTRATANTE\b|\bCPF\b|\bCNPJ\b/i)[0].trim();
          nomeExtraido = nomeExtraido.replace(/\b(SR\.?|SRA\.?|DR\.?|DRA\.?)\b/gi, '').trim();
          if (nomeExtraido && nomeExtraido.split(' ').length >= 1) newBuyerInfo.nome = nomeExtraido;
        }
        if (!newBuyerInfo.cpf && contractData.documentosDasPartes && contractData.documentosDasPartes[i]) {
          const docFormatado = contractData.documentosDasPartes[i];
          const docNumeros = docFormatado.replace(/\D/g, '');
          if (docNumeros.length === 11) newBuyerInfo.cpf = docFormatado;
        }
      }

      if (fullProcessState.buyerType === 'pj' && newCompanyInfo) {
         if (!newCompanyInfo.razaoSocial && (parteNomeUpper.includes("EMPRESA") || parteNomeUpper.includes("LTDA") || parteNomeUpper.includes("S.A") || parteNomeUpper.includes("S/A") || parteNomeUpper.includes("MEI") || parteNomeUpper.includes("VENDEDOR"))) {
             let nomeEmpresaExtraido = parteNomeCompleto.split(/,|\bCNPJ\b|\bLTDA\b|\bS\.A\b|\bS\/A\b|\bMEI\b|\bVENDEDOR\b/i)[0].trim();
             if (nomeEmpresaExtraido && nomeEmpresaExtraido.split(' ').length >= 1) newCompanyInfo.razaoSocial = nomeEmpresaExtraido;
         }
         if (!newCompanyInfo.cnpj && contractData.documentosDasPartes && contractData.documentosDasPartes[i]) {
            const docFormatado = contractData.documentosDasPartes[i];
            const docNumeros = docFormatado.replace(/\D/g, '');
            if (docNumeros.length === 14) newCompanyInfo.cnpj = docFormatado;
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


const getMissingFieldsList = (state: StoredProcessState): string[] => {
  const missingFields: string[] = [];

  if (!state.internalTeamMemberInfo?.nome) missingFields.push("Nome do Responsável Interno (Etapa 1 ou edite ✏️ na Revisão).");
  if (!state.internalTeamMemberInfo?.cpf) missingFields.push("CPF do Responsável Interno (Etapa 1 ou edite ✏️ na Revisão).");
  if (!state.internalTeamMemberInfo?.telefone) missingFields.push("Telefone do Responsável Interno (Etapa 1 ou edite ✏️ na Revisão).");
  if (!state.internalTeamMemberInfo?.email) missingFields.push("E-mail do Responsável Interno (Etapa 1 ou edite ✏️ na Revisão).");
  if (!state.internalTeamMemberInfo?.cargo) missingFields.push("Cargo do Responsável Interno (Etapa 1 ou edite ✏️ na Revisão).");


  if (state.contractSourceType === 'existing') {
    if (!state.selectedPlayer) {
      missingFields.push("Player (Expert) não selecionado (Etapa 1: Dados Iniciais).");
    }
    if (!state.extractedData || isExtractedDataEmpty(state.extractedData)) {
      missingFields.push("Modelo de contrato não carregado para o Player (Etapa 1: Dados Iniciais).");
    }
  }

  if (state.contractSourceType === 'new') {
    if (!state.contractPhotoPreview) {
      missingFields.push("Foto do contrato original não carregada (Etapa 2: Foto do Contrato).");
    } else if (!state.photoVerified) {
      missingFields.push("Foto do contrato original não verificada pela IA (Etapa 2: Foto do Contrato).");
    }

    if (state.photoVerified && (!state.extractedData || isExtractedDataEmpty(state.extractedData))) {
      missingFields.push("Dados do contrato original não extraídos/preenchidos após verificação (Etapa 2: Foto do Contrato).");
    }
  }

  if (state.buyerType === 'pf') {
    const hasRgAntigo = state.rgAntigoFrente?.previewUrl && state.rgAntigoVerso?.previewUrl;
    const hasCnhAntiga = state.cnhAntigaFrente?.previewUrl && state.cnhAntigaVerso?.previewUrl;
    if (!(hasRgAntigo || hasCnhAntiga)) {
      missingFields.push("Documento pessoal (RG Antigo ou CNH Antiga - frente e verso) não anexado (Etapa 3: Documentos).");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Comprovante de endereço pessoal não anexado (Etapa 3: Documentos).");
    }
  } else { // PJ
    if (!state.companyInfo?.razaoSocial) {
      missingFields.push("Razão Social da empresa (Etapa 3 ou edite ✏️ na Revisão).");
    }
    if (!state.companyInfo?.cnpj) {
      missingFields.push("CNPJ da empresa (Etapa 3 ou edite ✏️ na Revisão).");
    }

    if (!state.cartaoCnpjFile?.previewUrl) {
      missingFields.push("Cartão CNPJ não anexado (Etapa 3: Documentos).");
    }
    if (!(state.docSocioFrente?.previewUrl && state.docSocioVerso?.previewUrl)) {
      missingFields.push("Documento do Sócio/Representante (frente e verso) não anexado (Etapa 3: Documentos).");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Comprovante de endereço da empresa não anexado (Etapa 3: Documentos).");
    }
  }

  if (!state.buyerInfo?.nome) {
    missingFields.push("Nome do comprador/representante (Etapa 3 ou edite ✏️ na Revisão).");
  }
  if (!state.buyerInfo?.cpf) {
    missingFields.push("CPF do comprador/representante (Etapa 3 ou edite ✏️ na Revisão).");
  }
  if (!state.buyerInfo?.telefone) {
    missingFields.push("Telefone do comprador/representante (Edite ✏️ na Revisão).");
  }
  if (!state.buyerInfo?.email) {
    missingFields.push("E-mail do comprador/representante (Edite ✏️ na Revisão).");
  }
  if (!state.buyerInfo?.logradouro) missingFields.push("Logradouro do comprador/representante (Edite ✏️ na Revisão).");
  if (!state.buyerInfo?.bairro) missingFields.push("Bairro do comprador/representante (Edite ✏️ na Revisão).");
  if (!state.buyerInfo?.cidade) missingFields.push("Cidade do comprador/representante (Edite ✏️ na Revisão).");
  if (!state.buyerInfo?.estado) missingFields.push("Estado do comprador/representante (Edite ✏️ na Revisão).");
  if (!state.buyerInfo?.cep) missingFields.push("CEP do comprador/representante (Edite ✏️ na Revisão).");
  return missingFields;
};


export default function RevisaoEnvioPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [isStateLoading, setIsStateLoading] = useState(true);

  const [currentBuyerInfo, setCurrentBuyerInfo] = useState<BuyerInfo>({ ...initialStoredProcessState.buyerInfo });
  const [currentCompanyInfo, setCurrentCompanyInfo] = useState<CompanyInfo | null>(null);
  const [currentInternalTeamMemberInfo, setCurrentInternalTeamMemberInfo] = useState<BuyerInfo>({ ...initialStoredProcessState.internalTeamMemberInfo });


  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const [isEditResponsavelOpen, setIsEditResponsavelOpen] = useState(false);
  const [isEditCompradorOpen, setIsEditCompradorOpen] = useState(false);
  const [isEditEmpresaOpen, setIsEditEmpresaOpen] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsStateLoading(true);
      const loadedProcessState = await loadProcessState();
      console.log('[RevisaoEnvioPage] loadInitialData - Loaded state:', loadedProcessState ? JSON.parse(JSON.stringify(loadedProcessState)) : loadedProcessState);

      if (!loadedProcessState.processId) {
        console.error("[RevisaoEnvioPage] CRITICAL: Loaded state has no processId. Redirecting to start.");
        toast({
          title: "Erro de Sessão",
          description: "Não foi possível carregar os dados do processo (ID ausente). Por favor, inicie novamente.",
          variant: "destructive",
          duration: 7000,
        });
        router.replace('/');
        return;
      }

      let tempBuyerInfo = loadedProcessState.buyerInfo
          ? { ...loadedProcessState.buyerInfo }
          : { ...initialStoredProcessState.buyerInfo };
      let tempCompanyInfo = loadedProcessState.buyerType === 'pj'
        ? (loadedProcessState.companyInfo
            ? { ...loadedProcessState.companyInfo }
            : { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) })
        : null;
      let tempInternalTeamMemberInfo = loadedProcessState.internalTeamMemberInfo
          ? { ...loadedProcessState.internalTeamMemberInfo }
          : { ...initialStoredProcessState.internalTeamMemberInfo };


      const { buyerInfo: preFilledBuyer, companyInfo: preFilledCompany } = attemptToPreFillInfo(
        loadedProcessState,
        tempBuyerInfo,
        tempCompanyInfo
      );

      const buyerActuallyChanged = JSON.stringify(preFilledBuyer) !== JSON.stringify(tempBuyerInfo);
      const companyActuallyChanged = loadedProcessState.buyerType === 'pj' && JSON.stringify(preFilledCompany) !== JSON.stringify(tempCompanyInfo);

      if (buyerActuallyChanged) tempBuyerInfo = preFilledBuyer;
      if (companyActuallyChanged && loadedProcessState.buyerType === 'pj') tempCompanyInfo = preFilledCompany;

      setCurrentBuyerInfo(tempBuyerInfo);
      setCurrentCompanyInfo(tempCompanyInfo);
      setCurrentInternalTeamMemberInfo(tempInternalTeamMemberInfo);

      setProcessState(prev => ({
        ...prev,
        ...loadedProcessState,
        buyerInfo: tempBuyerInfo,
        companyInfo: tempCompanyInfo,
        internalTeamMemberInfo: tempInternalTeamMemberInfo,
      }));

      setIsStateLoading(false);
    };
    loadInitialData();
  }, [router, toast]);


  const handleSaveResponsavel = async (updatedData: Record<string, string>) => {
    const newInternalInfo = {
        ...currentInternalTeamMemberInfo, 
        ...updatedData,
    } as BuyerInfo;
    setCurrentInternalTeamMemberInfo(newInternalInfo); 

    const updatedFullProcessState = {
        ...processState,
        internalTeamMemberInfo: newInternalInfo,
    };
    setProcessState(updatedFullProcessState); 
    await saveProcessState(updatedFullProcessState); 
    toast({ 
        title: (
          <div className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-400" />
            Responsável Interno Atualizado
          </div>
        ), 
        description: "Informações salvas e sincronizadas com o servidor.",
        className: "bg-secondary text-secondary-foreground border-secondary"
    });
  };

  const handleSaveComprador = async (updatedData: Record<string, string>) => {
    const newBuyerInfo = {
        ...currentBuyerInfo, 
        ...updatedData,
    } as BuyerInfo;
    setCurrentBuyerInfo(newBuyerInfo);

    const updatedFullProcessState = {
        ...processState,
        buyerInfo: newBuyerInfo,
    };
    setProcessState(updatedFullProcessState); 
    await saveProcessState(updatedFullProcessState); 
    toast({ 
        title: (
          <div className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-400" />
            Dados do Comprador Atualizados
          </div>
        ), 
        description: "Informações salvas e sincronizadas com o servidor.",
        className: "bg-secondary text-secondary-foreground border-secondary"
    });
  };

  const handleSaveEmpresa = async (updatedData: Record<string, string>) => {
    if (processState.buyerType === 'pj') {
        const newCompanyInfo = {
            ...(currentCompanyInfo || initialStoredProcessState.companyInfo!), 
            ...updatedData,
        } as CompanyInfo;
        setCurrentCompanyInfo(newCompanyInfo); 

        const updatedFullProcessState = {
            ...processState,
            companyInfo: newCompanyInfo,
        };
        setProcessState(updatedFullProcessState); 
        await saveProcessState(updatedFullProcessState); 
        toast({ 
            title: (
              <div className="flex items-center">
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-400" />
                Dados da Empresa Atualizados
              </div>
            ), 
            description: "Informações salvas e sincronizadas com o servidor.",
            className: "bg-secondary text-secondary-foreground border-secondary"
        });
    }
  };

  const responsavelFields: FieldConfig[] = [
    { id: 'nome', label: 'Nome Completo', value: currentInternalTeamMemberInfo.nome, type: 'text', required: true },
    { id: 'cpf', label: 'CPF', value: currentInternalTeamMemberInfo.cpf, type: 'text', required: true },
    { id: 'telefone', label: 'Telefone', value: currentInternalTeamMemberInfo.telefone, type: 'tel', required: true },
    { id: 'email', label: 'E-mail', value: currentInternalTeamMemberInfo.email, type: 'email', required: true },
    { id: 'cargo', label: 'Cargo', value: currentInternalTeamMemberInfo.cargo || '', type: 'text', required: true },
  ];

  const compradorFields: FieldConfig[] = [
    { id: 'nome', label: 'Nome Completo', value: currentBuyerInfo.nome, type: 'text', required: true },
    { id: 'cpf', label: 'CPF', value: currentBuyerInfo.cpf, type: 'text', required: true },
    { id: 'telefone', label: 'Telefone (WhatsApp)', value: currentBuyerInfo.telefone, type: 'tel', required: true },
    { id: 'email', label: 'E-mail', value: currentBuyerInfo.email, type: 'email', required: true },
    { id: 'logradouro', label: 'Logradouro (Rua, Av, Nº, Comp.)', value: currentBuyerInfo.logradouro || '', type: 'text', required: true },
    { id: 'bairro', label: 'Bairro', value: currentBuyerInfo.bairro || '', type: 'text', required: true },
    { id: 'cidade', label: 'Cidade', value: currentBuyerInfo.cidade || '', type: 'text', required: true },
    { id: 'estado', label: 'Estado (UF)', value: currentBuyerInfo.estado || '', type: 'text', required: true },
    { id: 'cep', label: 'CEP', value: currentBuyerInfo.cep || '', type: 'text', required: true },
  ];

  const empresaFields: FieldConfig[] = currentCompanyInfo ? [
    { id: 'razaoSocial', label: 'Razão Social', value: currentCompanyInfo.razaoSocial, type: 'text', required: true },
    { id: 'nomeFantasia', label: 'Nome Fantasia (Opcional)', value: currentCompanyInfo.nomeFantasia || '', type: 'text' },
    { id: 'cnpj', label: 'CNPJ', value: currentCompanyInfo.cnpj, type: 'text', required: true },
  ] : [];


  const isPrintDisabled = useCallback(() => {
    if (isStateLoading) return true; 
    return getMissingFieldsList(processState).length > 0;
  }, [processState, isStateLoading]);

  const showPendingChecks = () => {
    const missingFields = getMissingFieldsList(processState);

    if (missingFields.length > 0) {
      toast({
        title: "Pendências Encontradas",
        description: (
          <div className="max-h-60 overflow-y-auto">
            <p className="mb-2 font-semibold">Por favor, corrija os itens abaixo. Use os botões de edição (✏️) nesta página ou o botão 'Voltar' para as etapas anteriores:</p>
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
        title: (
          <div className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-300" />
            Tudo Certo!
          </div>
        ),
        description: "Todos os dados necessários estão preenchidos. Você pode prosseguir para a impressão.",
        className: "bg-green-600 text-primary-foreground border-green-700",
        duration: 5000,
      });
    }
  };


  const handlePrepareForPrint = async () => {
    const missingFields = getMissingFieldsList(processState);
    if (missingFields.length > 0) {
      showPendingChecks();
      return;
    }

    setIsPreparingPrint(true);
    const stateToSave: StoredProcessState = {
      ...processState,
      currentStep: "/print-contract"
    };

    console.log('[RevisaoEnvioPage] State being saved before navigating to print:', JSON.parse(JSON.stringify(stateToSave)));
    console.log('[RevisaoEnvioPage] stateToSave.extractedData:', stateToSave.extractedData ? JSON.parse(JSON.stringify(stateToSave.extractedData)) : 'null');
    console.log('[RevisaoEnvioPage] stateToSave.internalTeamMemberInfo:', stateToSave.internalTeamMemberInfo ? JSON.parse(JSON.stringify(stateToSave.internalTeamMemberInfo)) : 'null');

    await saveProcessState(stateToSave);

    toast({ 
        title: (
            <div className="flex items-center">
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-300" />
                Etapa 4 Concluída!
            </div>
        ), 
        description: "Informações salvas. Carregando contrato para impressão...", 
        className: "bg-green-600 text-primary-foreground border-green-700"
    });
    router.push('/print-contract');
  };

  const handleBack = async () => {
    setIsNavigating(true);
    const stateToSave: StoredProcessState = {
        ...processState,
    };
    await saveProcessState(stateToSave);
    router.push("/processo/documentos");
  };

  useEffect(() => {
    const currentProcessStateForEffect = processState;
    const saveDebounced = setTimeout(async () => {
        if (!isNavigating && !isPreparingPrint && !isStateLoading) {
             if (JSON.stringify(currentProcessStateForEffect) !== localStorage.getItem("contratoFacilProcessState_v14_robust_parse")) {
                await saveProcessState(currentProcessStateForEffect);
             }
        }
    }, 1200); 

    return () => {
      clearTimeout(saveDebounced);
      if (!isNavigating && !isPreparingPrint && !isStateLoading) {
      }
    };
  }, [processState, isNavigating, isPreparingPrint, isStateLoading]);


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
            <CardHeader className="p-6 flex flex-row items-center justify-between">
                <div className="flex items-center">
                    <Building className="mr-3 h-6 w-6 text-primary" />
                    <CardTitle className="text-xl font-headline text-primary">Informações da Empresa</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsEditEmpresaOpen(true)} className="text-primary/70 hover:text-primary">
                    <Edit3 className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
                <p className="text-foreground/80"><strong>Razão Social:</strong> {currentCompanyInfo?.razaoSocial || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Nome Fantasia:</strong> {currentCompanyInfo?.nomeFantasia || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>CNPJ:</strong> {currentCompanyInfo?.cnpj || 'Não informado'}</p>
                <CardDescription className="text-foreground/70 pt-2 text-xs">Confirme ou edite os dados da empresa. Alguns campos podem ter sido pré-preenchidos pela IA.</CardDescription>
            </CardContent>
        </Card>
      )}

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm mt-8">
        <CardHeader className="p-6 flex flex-row items-center justify-between">
            <div className="flex items-center">
                 <UserRound className="mr-3 h-7 w-7 text-primary" />
                <CardTitle className="text-2xl font-headline text-primary">
                    {processState.buyerType === 'pf' ? "Informações do Comprador" : "Informações do Representante Legal"}
                </CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsEditCompradorOpen(true)} className="text-primary/70 hover:text-primary">
                <Edit3 className="h-5 w-5" />
            </Button>
        </CardHeader>
        <CardContent className="space-y-2 p-6 pt-0">
            <p className="text-foreground/80"><strong>Nome Completo:</strong> {currentBuyerInfo.nome || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>CPF:</strong> {currentBuyerInfo.cpf || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>Telefone (WhatsApp):</strong> {currentBuyerInfo.telefone || 'Não informado'}</p>
            <p className="text-foreground/80"><strong>E-mail:</strong> {currentBuyerInfo.email || 'Não informado'}</p>
            <div className="pt-2">
                <h4 className="text-sm font-medium text-primary/80 flex items-center"><MapPin className="mr-1 h-4 w-4" /> Endereço:</h4>
                <p className="text-foreground/80 pl-5">
                    {currentBuyerInfo.logradouro || '[Logradouro não informado]'}, {currentBuyerInfo.bairro || '[Bairro não informado]'}<br/>
                    {currentBuyerInfo.cidade || '[Cidade não informada]'} - {currentBuyerInfo.estado || '[UF não informada]'}<br/>
                    CEP: {currentBuyerInfo.cep || '[CEP não informado]'}
                </p>
            </div>
            <CardDescription className="text-foreground/70 pt-2 text-xs">
            Confirme ou edite os dados. Alguns campos podem ter sido pré-preenchidos pela análise da IA dos documentos anexados ou do contrato principal.
          </CardDescription>
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

          {currentInternalTeamMemberInfo && (
            <>
             <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserCog className="mr-2 h-5 w-5" />Responsável Interno</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsEditResponsavelOpen(true)} className="text-primary/70 hover:text-primary -mr-2">
                        <Edit3 className="h-5 w-5" />
                    </Button>
                </div>
                <p className="text-foreground/80"><strong>Nome:</strong> {currentInternalTeamMemberInfo.nome || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>CPF:</strong> {currentInternalTeamMemberInfo.cpf || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Telefone:</strong> {currentInternalTeamMemberInfo.telefone || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>E-mail:</strong> {currentInternalTeamMemberInfo.email || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Cargo:</strong> {currentInternalTeamMemberInfo.cargo || 'Não informado'}</p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          {processState.buyerType === 'pj' && currentCompanyInfo && (
            <>
              <div className="space-y-1">
                 <div className="flex items-center justify-between">
                    <h3 className="flex items-center text-lg font-semibold text-primary/90"><Building className="mr-2 h-5 w-5" />Dados da Empresa</h3>
                </div>
                <p className="text-foreground/80"><strong>Razão Social:</strong> {currentCompanyInfo?.razaoSocial || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>Nome Fantasia:</strong> {currentCompanyInfo?.nomeFantasia || 'Não informado'}</p>
                <p className="text-foreground/80"><strong>CNPJ:</strong> {currentCompanyInfo?.cnpj || 'Não informado'}</p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          {currentBuyerInfo && (
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserRound className="mr-2 h-5 w-5" />{processState.buyerType === 'pf' ? "Dados do Comprador" : "Dados do Representante"}</h3>
              </div>
              <p className="text-foreground/80"><strong>Nome:</strong> {currentBuyerInfo.nome || 'Não informado'}</p>
              <p className="text-foreground/80"><strong>CPF:</strong> {currentBuyerInfo.cpf || 'Não informado'}</p>
              <p className="text-foreground/80"><strong>Telefone:</strong> {currentBuyerInfo.telefone || 'Não informado'}</p>
              <p className="text-foreground/80"><strong>E-mail:</strong> {currentBuyerInfo.email || 'Não informado'}</p>
              <p className="text-foreground/80"><strong>Endereço:</strong> {currentBuyerInfo.logradouro ? `${currentBuyerInfo.logradouro}, ${currentBuyerInfo.bairro || ''} - ${currentBuyerInfo.cidade || ''}/${currentBuyerInfo.estado || ''}, CEP: ${currentBuyerInfo.cep || ''}` : 'Não informado'}</p>
            </div>
          )}
           <hr className="border-border/30"/>


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
                className="w-full sm:flex-1 bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-sm sm:text-base py-3 px-3 sm:py-4 sm:px-4 whitespace-normal text-center rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:bg-muted"
                disabled={isStateLoading || isPreparingPrint || isNavigating || isPrintDisabled()}
            >
                {isPreparingPrint ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-5 w-5" /> Preparar Contrato para Impressão
                  </>
                )}
            </Button>
        </CardFooter>
      </Card>

      <div className="flex justify-center sm:justify-start mt-8">
        <Button
          onClick={handleBack}
          variant="outline"
          className="border-primary/80 text-primary hover:bg-primary/10 text-lg py-6 px-8 rounded-lg"
          disabled={isStateLoading || isPreparingPrint || isNavigating}
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Documentos
        </Button>
      </div>

      <EditInfoDialog
        isOpen={isEditResponsavelOpen}
        setIsOpen={setIsEditResponsavelOpen}
        dialogTitle="Editar Responsável Interno"
        fieldsConfig={responsavelFields}
        onSaveHandler={handleSaveResponsavel}
        initialData={currentInternalTeamMemberInfo}
      />

      <EditInfoDialog
        isOpen={isEditCompradorOpen}
        setIsOpen={setIsEditCompradorOpen}
        dialogTitle={processState.buyerType === 'pf' ? "Editar Dados do Comprador" : "Editar Dados do Representante Legal"}
        fieldsConfig={compradorFields}
        onSaveHandler={handleSaveComprador}
        initialData={currentBuyerInfo}
      />

      {processState.buyerType === 'pj' && currentCompanyInfo && (
        <EditInfoDialog
            isOpen={isEditEmpresaOpen}
            setIsOpen={setIsEditEmpresaOpen}
            dialogTitle="Editar Informações da Empresa"
            fieldsConfig={empresaFields}
            onSaveHandler={handleSaveEmpresa}
            initialData={currentCompanyInfo}
        />
      )}
    </>
  );
}

