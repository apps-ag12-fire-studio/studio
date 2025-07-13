
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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

  const getAnalysisDataFromDocKey = (docKey: keyof StoredProcessState) => {
    const docFile = fullProcessState[docKey] as DocumentFile | null;
    if (docFile?.analysisResult && !(docFile.analysisResult as any).error) {
      return docFile.analysisResult;
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

  if (!state.internalTeamMemberInfo?.nome) missingFields.push("Name of Internal Responsible (Step 1 or edit ✏️ in Review).");
  if (!state.internalTeamMemberInfo?.cpf) missingFields.push("ID of Internal Responsible (Step 1 or edit ✏️ in Review).");
  if (!state.internalTeamMemberInfo?.telefone) missingFields.push("Phone of Internal Responsible (Step 1 or edit ✏️ in Review).");
  if (!state.internalTeamMemberInfo?.email) missingFields.push("Email of Internal Responsible (Step 1 or edit ✏️ in Review).");
  if (!state.internalTeamMemberInfo?.cargo) missingFields.push("Role of Internal Responsible (Step 1 or edit ✏️ in Review).");


  if (state.contractSourceType === 'existing') {
    if (!state.selectedPlayer) {
      missingFields.push("Player (Expert) not selected (Step 1: Initial Data).");
    }
    if (!state.extractedData || isExtractedDataEmpty(state.extractedData)) {
      missingFields.push("Contract template not loaded for Player (Step 1: Initial Data).");
    }
  }

  if (state.contractSourceType === 'new') {
    if (!state.contractPhotoPreview) {
      missingFields.push("Original contract photo not uploaded (Step 2: Contract Photo).");
    } else if (!state.photoVerified) {
      missingFields.push("Original contract photo not verified by AI (Step 2: Contract Photo).");
    }

    if (state.photoVerified && (!state.extractedData || isExtractedDataEmpty(state.extractedData))) {
      missingFields.push("Original contract data not extracted/filled after verification (Step 2: Contract Photo).");
    }
  }

  if (state.buyerType === 'pf') {
    const hasRgAntigo = state.rgAntigoFrente?.previewUrl && state.rgAntigoVerso?.previewUrl;
    const hasCnhAntiga = state.cnhAntigaFrente?.previewUrl && state.cnhAntigaVerso?.previewUrl;
    if (!(hasRgAntigo || hasCnhAntiga)) {
      missingFields.push("Personal document (ID Card or Driver's License - front and back) not attached (Step 3: Documents).");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Personal proof of address not attached (Step 3: Documents).");
    }
  } else { // PJ
    if (!state.companyInfo?.razaoSocial) {
      missingFields.push("Company Legal Name (Step 3 or edit ✏️ in Review).");
    }
    if (!state.companyInfo?.cnpj) {
      missingFields.push("Company Tax ID (Step 3 or edit ✏️ in Review).");
    }

    if (!state.cartaoCnpjFile?.previewUrl) {
      missingFields.push("Company Registration Doc not attached (Step 3: Documents).");
    }
    if (!(state.docSocioFrente?.previewUrl && state.docSocioVerso?.previewUrl)) {
      missingFields.push("Partner/Representative's ID (front and back) not attached (Step 3: Documents).");
    }
    if (!state.comprovanteEndereco?.previewUrl) {
      missingFields.push("Company proof of address not attached (Step 3: Documents).");
    }
  }

  if (!state.buyerInfo?.nome) {
    missingFields.push("Buyer/Representative Name (Step 3 or edit ✏️ in Review).");
  }
  if (!state.buyerInfo?.cpf) {
    missingFields.push("Buyer/Representative ID/SSN (Step 3 or edit ✏️ in Review).");
  }
  if (!state.buyerInfo?.telefone) {
    missingFields.push("Buyer/Representative Phone (Edit ✏️ in Review).");
  }
  if (!state.buyerInfo?.email) {
    missingFields.push("Buyer/Representative Email (Edit ✏️ in Review).");
  }
  if (!state.buyerInfo?.logradouro) missingFields.push("Buyer/Representative Address Line (Edit ✏️ in Review).");
  if (!state.buyerInfo?.bairro) missingFields.push("Buyer/Representative Neighborhood/Area (Edit ✏️ in Review).");
  if (!state.buyerInfo?.cidade) missingFields.push("Buyer/Representative City (Edit ✏️ in Review).");
  if (!state.buyerInfo?.estado) missingFields.push("Buyer/Representative State (Edit ✏️ in Review).");
  if (!state.buyerInfo?.cep) missingFields.push("Buyer/Representative ZIP Code (Edit ✏️ in Review).");
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
          title: "Session Error",
          description: "Could not load process data (ID missing). Please start over.",
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
            Internal Responsible Updated
          </div>
        ), 
        description: "Information saved and synced with the server.",
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
            Buyer Data Updated
          </div>
        ), 
        description: "Information saved and synced with the server.",
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
                Company Data Updated
              </div>
            ), 
            description: "Information saved and synced with the server.",
            className: "bg-secondary text-secondary-foreground border-secondary"
        });
    }
  };

  const responsavelFields: FieldConfig[] = [
    { id: 'nome', label: 'Full Name', value: currentInternalTeamMemberInfo.nome, type: 'text', required: true },
    { id: 'cpf', label: 'ID / Social Security', value: currentInternalTeamMemberInfo.cpf, type: 'text', required: true },
    { id: 'telefone', label: 'Phone', value: currentInternalTeamMemberInfo.telefone, type: 'tel', required: true },
    { id: 'email', label: 'E-mail', value: currentInternalTeamMemberInfo.email, type: 'email', required: true },
    { id: 'cargo', label: 'Role', value: currentInternalTeamMemberInfo.cargo || '', type: 'text', required: true },
  ];

  const compradorFields: FieldConfig[] = [
    { id: 'nome', label: 'Full Name', value: currentBuyerInfo.nome, type: 'text', required: true },
    { id: 'cpf', label: 'ID / SSN', value: currentBuyerInfo.cpf, type: 'text', required: true },
    { id: 'telefone', label: 'Phone (WhatsApp)', value: currentBuyerInfo.telefone, type: 'tel', required: true },
    { id: 'email', label: 'E-mail', value: currentBuyerInfo.email, type: 'email', required: true },
    { id: 'logradouro', label: 'Address (Street, No., Apt.)', value: currentBuyerInfo.logradouro || '', type: 'text', required: true },
    { id: 'bairro', label: 'Neighborhood / Area', value: currentBuyerInfo.bairro || '', type: 'text', required: true },
    { id: 'cidade', label: 'City', value: currentBuyerInfo.cidade || '', type: 'text', required: true },
    { id: 'estado', label: 'State', value: currentBuyerInfo.estado || '', type: 'text', required: true },
    { id: 'cep', label: 'ZIP Code', value: currentBuyerInfo.cep || '', type: 'text', required: true },
  ];

  const empresaFields: FieldConfig[] = currentCompanyInfo ? [
    { id: 'razaoSocial', label: 'Legal Name', value: currentCompanyInfo.razaoSocial, type: 'text', required: true },
    { id: 'nomeFantasia', label: 'Trade Name (Optional)', value: currentCompanyInfo.nomeFantasia || '', type: 'text' },
    { id: 'cnpj', label: 'Company Tax ID', value: currentCompanyInfo.cnpj, type: 'text', required: true },
  ] : [];


  const isPrintDisabled = useCallback(() => {
    if (isStateLoading) return true; 
    return getMissingFieldsList(processState).length > 0;
  }, [processState, isStateLoading]);

  const showPendingChecks = () => {
    const missingFields = getMissingFieldsList(processState);

    if (missingFields.length > 0) {
      toast({
        title: "Pending Items Found",
        description: (
          <div className="max-h-60 overflow-y-auto">
            <p className="mb-2 font-semibold">Please correct the items below. Use the edit buttons (✏️) on this page or the 'Back' button for previous steps:</p>
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
            All Good!
          </div>
        ),
        description: "All necessary data is filled. You can proceed to printing.",
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
    
    await saveProcessState(stateToSave);

    toast({ 
        title: (
            <div className="flex items-center">
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-300" />
                Step 4 Complete!
            </div>
        ), 
        description: "Information saved. Loading contract for printing...", 
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
    };
  }, [processState, isNavigating, isPreparingPrint, isStateLoading]);


  if (isStateLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading process data...</p>
      </div>
    );
  }

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-1 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Easy Contract
        </div>
        <p className="mb-4 text-sm text-foreground/80">
          International Platform Financial - SAAS Solution with Artificial Intelligence in training by Antônio Fogaça.
        </p>
        <p className="text-xl text-muted-foreground font-headline">
          Step 4: {processState.buyerType === 'pj' ? 'Company Data, Representative' : 'Buyer Data'} & Final Review
        </p>
      </header>

      {processState.buyerType === 'pj' && (
         <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-6 flex flex-row items-center justify-between">
                <div className="flex items-center">
                    <Building className="mr-3 h-6 w-6 text-primary" />
                    <CardTitle className="text-xl font-headline text-primary">Company Information</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsEditEmpresaOpen(true)} className="text-primary/70 hover:text-primary">
                    <Edit3 className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-2 p-6 pt-0">
                <p className="text-foreground/80"><strong>Legal Name:</strong> {currentCompanyInfo?.razaoSocial || 'Not provided'}</p>
                <p className="text-foreground/80"><strong>Trade Name:</strong> {currentCompanyInfo?.nomeFantasia || 'Not provided'}</p>
                <p className="text-foreground/80"><strong>Company Tax ID:</strong> {currentCompanyInfo?.cnpj || 'Not provided'}</p>
                <CardDescription className="text-foreground/70 pt-2 text-xs">Confirm or edit the company data. Some fields may have been pre-filled by the AI.</CardDescription>
            </CardContent>
        </Card>
      )}

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm mt-8">
        <CardHeader className="p-6 flex flex-row items-center justify-between">
            <div className="flex items-center">
                 <UserRound className="mr-3 h-7 w-7 text-primary" />
                <CardTitle className="text-2xl font-headline text-primary">
                    {processState.buyerType === 'pf' ? "Buyer Information" : "Legal Representative Information"}
                </CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsEditCompradorOpen(true)} className="text-primary/70 hover:text-primary">
                <Edit3 className="h-5 w-5" />
            </Button>
        </CardHeader>
        <CardContent className="space-y-2 p-6 pt-0">
            <p className="text-foreground/80"><strong>Full Name:</strong> {currentBuyerInfo.nome || 'Not provided'}</p>
            <p className="text-foreground/80"><strong>ID / SSN:</strong> {currentBuyerInfo.cpf || 'Not provided'}</p>
            <p className="text-foreground/80"><strong>Phone (WhatsApp):</strong> {currentBuyerInfo.telefone || 'Not provided'}</p>
            <p className="text-foreground/80"><strong>E-mail:</strong> {currentBuyerInfo.email || 'Not provided'}</p>
            <div className="pt-2">
                <h4 className="text-sm font-medium text-primary/80 flex items-center"><MapPin className="mr-1 h-4 w-4" /> Address:</h4>
                <p className="text-foreground/80 pl-5">
                    {currentBuyerInfo.logradouro || '[Address not provided]'}, {currentBuyerInfo.bairro || '[Area not provided]'}<br/>
                    {currentBuyerInfo.cidade || '[City not provided]'} - {currentBuyerInfo.estado || '[State not provided]'}<br/>
                    ZIP Code: {currentBuyerInfo.cep || '[ZIP not provided]'}
                </p>
            </div>
            <CardDescription className="text-foreground/70 pt-2 text-xs">
            Confirm or edit the data. Some fields may have been pre-filled by the AI analysis of the attached documents or the main contract.
          </CardDescription>
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary"><ListChecks className="mr-3 h-7 w-7" />Review Other Information</CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Check the other data before proceeding to print. The information is updated in real-time as you edit the forms above.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-6 pt-0">
          <div className="space-y-1">
            <h3 className="flex items-center text-lg font-semibold text-primary/90"><ListChecks className="mr-2 h-5 w-5" />The Contract to be signed is:</h3>
            <p className="text-foreground/80">{processState.contractSourceType === 'new' ? 'A New Contract Template (Photo)' : 'Admin Validated Contract (Template)'}</p>
          </div>
          <hr className="border-border/30"/>

          {processState.contractSourceType === 'existing' && processState.selectedPlayer && (
            <>
              <div className="space-y-1">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><PlayersIcon className="mr-2 h-5 w-5" />Selected Player</h3>
                <p className="text-foreground/80">{processState.selectedPlayer}</p>
                {processState.selectedContractTemplateName && <p className="text-sm text-muted-foreground">Template: {processState.selectedContractTemplateName}</p>}
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          {currentInternalTeamMemberInfo && (
            <>
             <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center text-lg font-semibold text-primary/90"><UserCog className="mr-2 h-5 w-5" />Internal Responsible</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsEditResponsavelOpen(true)} className="text-primary/70 hover:text-primary -mr-2">
                        <Edit3 className="h-5 w-5" />
                    </Button>
                </div>
                <p className="text-foreground/80"><strong>Name:</strong> {currentInternalTeamMemberInfo.nome || 'Not provided'}</p>
                <p className="text-foreground/80"><strong>ID/SSN:</strong> {currentInternalTeamMemberInfo.cpf || 'Not provided'}</p>
                <p className="text-foreground/80"><strong>Phone:</strong> {currentInternalTeamMemberInfo.telefone || 'Not provided'}</p>
                <p className="text-foreground/80"><strong>E-mail:</strong> {currentInternalTeamMemberInfo.email || 'Not provided'}</p>
                <p className="text-foreground/80"><strong>Role:</strong> {currentInternalTeamMemberInfo.cargo || 'Not provided'}</p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          {processState.contractSourceType === 'new' && processState.contractPhotoName && (
            <>
              <div className="space-y-1">
                <h3 className="flex items-center text-lg font-semibold text-primary/90"><Camera className="mr-2 h-5 w-5" />Original Contract Photo</h3>
                <p className="text-foreground/80"><strong>File:</strong> {processState.contractPhotoName}</p>
                <p className={`text-sm ${processState.photoVerified ? 'text-green-400' : 'text-red-400'}`}>
                  {processState.photoVerified ? 'Photo Successfully Verified' :
                    (processState.photoVerificationResult?.reason ? `Verification Failed: ${processState.photoVerificationResult.reason}` : 'Photo Not Verified or Failed')}
                </p>
              </div>
              <hr className="border-border/30"/>
            </>
          )}

          {processState.extractedData && !isExtractedDataEmpty(processState.extractedData) && (
            <div className="space-y-1">
              <h3 className="flex items-center text-lg font-semibold text-primary/90"><FileText className="mr-2 h-5 w-5" />Contract Data {processState.contractSourceType === 'existing' ? `(Template from ${processState.selectedPlayer || 'Undefined Player'})` : '(Extracted from Photo)'}</h3>
              <ul className="list-disc list-inside text-foreground/80 space-y-1 pl-2 text-sm">
                {processState.extractedData.objetoDoContrato && <li><strong>Object:</strong> {processState.extractedData.objetoDoContrato}</li>}
                {processState.extractedData.valorPrincipal && <li><strong>Value:</strong> {processState.extractedData.valorPrincipal}</li>}
              </ul>
            </div>
          )}
           <hr className="border-border/30"/>
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
         <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary"><Printer className="mr-3 h-7 w-7" />Prepare for Printing</CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Generate the contract for physical printing, signing, and subsequent attachment of the signed document's photo.</CardDescription>
        </CardHeader>
        <CardFooter className="p-6 flex flex-col sm:flex-row gap-4">
            <Button
                type="button"
                variant="outline"
                onClick={showPendingChecks}
                className="w-full sm:w-auto border-blue-500/70 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                disabled={isStateLoading || isPreparingPrint || isNavigating}
            >
                <Info className="mr-2 h-5 w-5" /> Check for Pending Items
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
                    Preparing...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-5 w-5" /> Prepare Contract for Printing
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
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to Documents
        </Button>
      </div>

      <EditInfoDialog
        isOpen={isEditResponsavelOpen}
        setIsOpen={setIsEditResponsavelOpen}
        dialogTitle="Edit Internal Responsible"
        fieldsConfig={responsavelFields}
        onSaveHandler={handleSaveResponsavel}
        initialData={currentInternalTeamMemberInfo}
      />

      <EditInfoDialog
        isOpen={isEditCompradorOpen}
        setIsOpen={setIsEditCompradorOpen}
        dialogTitle={processState.buyerType === 'pf' ? "Edit Buyer Data" : "Edit Legal Representative Data"}
        fieldsConfig={compradorFields}
        onSaveHandler={handleSaveComprador}
        initialData={currentBuyerInfo}
      />

      {processState.buyerType === 'pj' && currentCompanyInfo && (
        <EditInfoDialog
            isOpen={isEditEmpresaOpen}
            setIsOpen={setIsEditEmpresaOpen}
            dialogTitle="Edit Company Information"
            fieldsConfig={empresaFields}
            onSaveHandler={handleSaveEmpresa}
            initialData={currentCompanyInfo}
        />
      )}
    </>
  );
}
