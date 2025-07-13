
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, BuyerInfo } from "@/lib/process-store";
import { ArrowRight, FileSearch, FileText as FileTextIcon, ChevronRight, UserCog, Users as PlayersIcon, Loader2, Briefcase, CheckCircle2 } from "lucide-react";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";

const players = [
  "Pablo Marçal",
  "Antônio Fogaça",
  "Diego Vicente",
  "Diego Abner (Já é kkk)",
  "Patrícia Pimentel",
  "Matheus Ribeiro",
  "Rogério Penna"
];

interface ContractTemplate {
  id: string;
  displayName: string;
  data: (selectedPlayer: string | null) => ExtractContractDataOutput;
}

const contractTemplates: ContractTemplate[] = [
  {
    id: 'digital-product-purchase',
    displayName: 'Digital Product Purchase Agreement',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: ["EXAMPLE CLIENT, AS BUYER", `${selectedPlayer || 'PLAYER NAME'}, AS SELLER`],
      documentosDasPartes: ["000.000.000-00", "[SELLING COMPANY TIN]"],
      objetoDoContrato: `DIGITAL PRODUCT (Player: ${selectedPlayer || 'PLAYER NAME'})`,
      valorPrincipal: "$ 15,000.00 (fifteen thousand dollars)",
      condicoesDePagamento: "Single payment via Wire Transfer.",
      prazoContrato: "12 months access",
      localEDataAssinatura: "New York, Current Date",
      foroEleito: "Courts of New York/NY",
      outrasObservacoesRelevantes: `Template agreement for ${selectedPlayer || 'PLAYER NAME'} loaded for demonstration.`
    })
  },
  {
    id: 'service-agreement',
    displayName: 'Service Agreement',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: ["[CLIENT NAME], as CLIENT", `${selectedPlayer || '[PROVIDER NAME]'}, as PROVIDER`],
      documentosDasPartes: ["[CLIENT TIN]", "[PROVIDER TIN]"],
      objetoDoContrato: `Provision of [SERVICE DESCRIPTION] services (Provider: ${selectedPlayer || '[PROVIDER NAME]'})`,
      valorPrincipal: "$ [AMOUNT]",
      condicoesDePagamento: "[PAYMENT METHOD]",
      prazoContrato: "[XX] days/weeks/months, starting on [START DATE]",
      localEDataAssinatura: "[City, State], [Date]",
      foroEleito: "[CITY/STATE]",
      outrasObservacoesRelevantes: "Clause 1 - Object: The purpose of this agreement is the provision of the following services: [SERVICE DESCRIPTION]. Clause 4 - Obligations of the Parties: The Provider shall deliver the described services with quality and punctuality. The Client shall make payments on the agreed dates. Clause 5 - Termination: This agreement may be terminated by either party with [X] days prior notice."
    })
  },
  {
    id: 'business-partnership',
    displayName: 'Business Partnership Agreement',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: [`${selectedPlayer || '[COMPANY 1 NAME]'}, as PARTNER 1`, "[COMPANY 2 NAME], as PARTNER 2"],
      documentosDasPartes: ["[COMPANY 1 TIN]", "[COMPANY 2 TIN]"],
      objetoDoContrato: `Business Partnership between ${selectedPlayer || '[COMPANY 1 NAME]'} and [COMPANY 2 NAME] for [DESCRIBE PURPOSE: E.G., JOINT MARKETING, PRODUCT SALES, JOINT SERVICE PROVISION, ETC.]`,
      valorPrincipal: "Profits/Results shared as follows: [DESCRIBE PERCENTAGE OR DISTRIBUTION MODEL]",
      condicoesDePagamento: `Responsibilities: ${selectedPlayer || '[COMPANY 1]'}: [RESPONSIBILITIES OF COMPANY 1]; [COMPANY 2]: [RESPONSIBILITIES OF COMPANY 2].`,
      prazoContrato: "[XX] months, starting on [DATE]",
      localEDataAssinatura: "[City, State], [Date]",
      foroEleito: "[CITY/STATE]",
      outrasObservacoesRelevantes: "Clause 1 - Object: The parties commit to commercially collaborate for [DESCRIBE PURPOSE]. Clause 5 - Termination: May be terminated by either party with [X] days prior notice."
    })
  },
  {
    id: 'confidentiality-agreement-nda',
    displayName: 'Confidentiality Agreement (NDA)',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: [`${selectedPlayer || '[DISCLOSING PARTY NAME]'}, as DISCLOSING PARTY`, "[RECEIVING PARTY NAME], as RECEIVING PARTY"],
      documentosDasPartes: ["[DISCLOSING PARTY TIN]", "[RECEIVING PARTY TIN]"],
      objetoDoContrato: `Confidentiality Agreement (NDA) between ${selectedPlayer || '[DISCLOSING PARTY NAME]'} and [RECEIVING PARTY NAME] for [PURPOSE OF AGREEMENT]`,
      valorPrincipal: "Not applicable",
      condicoesDePagamento: "Clause 3 – Obligations of the Receiving Party: Not to disclose the information received; To use it only for the permitted purposes; To protect the content with the same care as it would protect its own information.",
      prazoContrato: "Clause 4 – Term: This agreement comes into effect on the date of signature and will remain valid for [X YEARS] after the termination of the relationship between the parties.",
      localEDataAssinatura: "[City, State], [Date]",
      foroEleito: "[CITY/STATE]",
      outrasObservacoesRelevantes: "Clause 1 – Object: This agreement aims to protect the confidential information exchanged between the parties in the context of [PURPOSE OF AGREEMENT]. Clause 2 – Definition of Confidential Information: Any written, oral, visual, or electronic information disclosed by one party to the other is considered confidential."
    })
  }
];

export default function DadosIniciaisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [isLoading, setIsLoading] = useState(false); 
  const [isStateLoading, setIsStateLoading] = useState(true); 

  useEffect(() => {
    const loadInitialState = async () => {
      setIsStateLoading(true);
      const loadedState = await loadProcessState();
      setProcessState(loadedState);
      setIsStateLoading(false);
    };
    loadInitialState();
  }, []);
  
  const handleInternalTeamMemberInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    setProcessState(prevState => ({
      ...prevState,
      internalTeamMemberInfo: {
        ...prevState.internalTeamMemberInfo,
        [field]: e.target.value,
      }
    }));
  };

  const handleContractSourceChange = (value: 'new' | 'existing') => {
    const newState = {
      ...processState,
      contractSourceType: value,
      contractPhotoPreview: null,
      contractPhotoName: undefined,
      photoVerificationResult: null,
      photoVerified: false,
      extractedData: value === 'existing' ? processState.extractedData : null, 
      selectedPlayer: value === 'existing' ? processState.selectedPlayer : null,
      selectedContractTemplateName: value === 'existing' ? processState.selectedContractTemplateName : null,
    };
    setProcessState(newState);
  };

  const handlePlayerSelect = (playerName: string) => {
    const newState = {
      ...processState,
      selectedPlayer: playerName,
      extractedData: null, 
      selectedContractTemplateName: null, 
    };
    setProcessState(newState);
  };

  const handleSelectContractTemplate = (templateId: string) => {
    if (!processState.selectedPlayer) {
      toast({ title: "Player Not Selected", description: "Please select a Player first.", variant: "destructive" });
      return;
    }
    const template = contractTemplates.find(t => t.id === templateId);
    if (!template) {
      toast({ title: "Template Not Found", description: "An error occurred while loading the contract template.", variant: "destructive" });
      return;
    }

    const contractData = template.data(processState.selectedPlayer);
    
    const newState = {
      ...processState,
      extractedData: contractData,
      selectedContractTemplateName: template.displayName,
    };
    setProcessState(newState);
    // No need to save here, will be saved on "Next"
  };
  
  const validateStep = () => {
    const { internalTeamMemberInfo } = processState;
    if (!internalTeamMemberInfo.nome || !internalTeamMemberInfo.cpf || !internalTeamMemberInfo.telefone || !internalTeamMemberInfo.email || !internalTeamMemberInfo.cargo) { // Added cargo check
      toast({ title: "Required Fields", description: "Fill in all 'Internal Responsible Information', including Role.", variant: "destructive" });
      return false;
    }
    if (processState.contractSourceType === 'existing') {
      if (!processState.selectedPlayer) {
        toast({ title: "Action Required", description: "Select a Player.", variant: "destructive" });
        return false;
      }
      if (!processState.extractedData) {
        toast({ title: "Action Required", description: "Select a contract template for the chosen Player.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    setIsLoading(true);

    const nextPath = processState.contractSourceType === 'new' ? "/processo/foto-contrato" : "/processo/documentos";
    const updatedState = { ...processState, currentStep: nextPath };
    
    await saveProcessState(updatedState);
    setProcessState(updatedState); 

    toast({
      title: (
        <div className="flex items-center">
          <CheckCircle2 className="mr-2 h-5 w-5 text-green-300" />
          Step 1 Complete!
        </div>
      ),
      description: "Initial data validated and saved. Loading next step...",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push(nextPath);
  };

   useEffect(() => {
    const currentProcessStateForEffect = processState;
    const saveOnUnmount = async () => {
      if (!isLoading && !isStateLoading) {
        await saveProcessState(currentProcessStateForEffect);
      }
    };

    return () => {
      if (!isLoading) {
          saveOnUnmount();
      }
    };
  }, [processState, isLoading, isStateLoading]);


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
          Step 1: Initial Data
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <FileSearch className="mr-3 h-7 w-7" /> The Contract to be signed is:
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Choose how to provide the contract data.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <RadioGroup
            value={processState.contractSourceType}
            onValueChange={handleContractSourceChange}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
              <RadioGroupItem value="new" id="source-new" className="border-primary/50 text-primary focus:ring-primary" />
              <Label htmlFor="source-new" className="font-medium text-lg cursor-pointer flex-1 text-foreground">A New Contract Template <span className="text-sm text-muted-foreground">(Upload Photo for Analysis)</span></Label>
            </div>
            <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
              <RadioGroupItem value="existing" id="source-existing" className="border-primary/50 text-primary focus:ring-primary" />
              <Label htmlFor="source-existing" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Admin Validated Contract <span className="text-sm text-muted-foreground">(Select Template)</span></Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      
      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <UserCog className="mr-3 h-7 w-7" /> Internal Responsible Information
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Data of the team member conducting this process.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="internal-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Full Name</Label>
            <Input id="internal-nome" value={processState.internalTeamMemberInfo?.nome || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'nome')} placeholder="Name of the internal responsible" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" autoComplete="name"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="internal-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">ID / Social Security</Label>
              <Input id="internal-cpf" value={processState.internalTeamMemberInfo?.cpf || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'cpf')} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" autoComplete="on" />
            </div>
            <div>
              <Label htmlFor="internal-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Phone</Label>
              <Input id="internal-telefone" type="tel" value={processState.internalTeamMemberInfo?.telefone || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'telefone')} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" autoComplete="tel"/>
            </div>
          </div>
          <div>
            <Label htmlFor="internal-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
            <Input id="internal-email" type="email" value={processState.internalTeamMemberInfo?.email || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'email')} placeholder="internal.email@company.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" autoComplete="email"/>
          </div>
          <div>
            <Label htmlFor="internal-cargo" className="text-foreground/90 text-sm uppercase tracking-wider flex items-center">
              <Briefcase className="mr-2 h-4 w-4" /> Role
            </Label>
            <Input id="internal-cargo" value={processState.internalTeamMemberInfo?.cargo || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'cargo')} placeholder="Role of the responsible (e.g., Sales, Manager)" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" autoComplete="organization-title"/>
          </div>
        </CardContent>
      </Card>

      {processState.contractSourceType === 'existing' && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <PlayersIcon className="mr-3 h-7 w-7" /> Select Player (Expert)
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Choose the content producer or main party of the contract.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <Select value={processState.selectedPlayer || ""} onValueChange={handlePlayerSelect}>
              <SelectTrigger className="w-full bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-3 placeholder:text-muted-foreground/70">
                <SelectValue placeholder="Select a Player/Expert..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {players.map(player => (
                  <SelectItem key={player} value={player} className="text-popover-foreground hover:bg-accent/50 focus:bg-accent/70">
                    {player}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {processState.contractSourceType === 'existing' && processState.selectedPlayer && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <FileTextIcon className="mr-3 h-7 w-7" /> Select Contract Template
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Choose a predefined template for the Player: <strong>{processState.selectedPlayer}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6 pt-0">
              {contractTemplates.map(template => (
                <Button 
                  key={template.id}
                  type="button" 
                  onClick={() => handleSelectContractTemplate(template.id)} 
                  variant={processState.selectedContractTemplateName === template.displayName ? "secondary" : "outline"}
                  className="w-full border-primary/80 text-primary hover:bg-primary/10 text-xs sm:text-sm py-3 sm:py-4 px-2 sm:px-4 rounded-lg flex justify-between items-center group data-[variant=secondary]:bg-primary/20"
                >
                  <div className="flex items-center flex-1 min-w-0 mr-2">
                    <FileTextIcon className="mr-2 sm:mr-3 h-5 w-5 flex-shrink-0" />
                    <span className="whitespace-normal break-words text-left">
                      {template.displayName}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
                </Button>
              ))}
              {processState.extractedData && processState.selectedContractTemplateName && (
                <p className="text-sm text-green-400 text-center pt-2">Template "{processState.selectedContractTemplateName}" for {processState.selectedPlayer} loaded.</p>
              )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end mt-8">
        <Button 
          onClick={handleNext}
          disabled={isLoading || isStateLoading} 
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Please wait...
            </>
          ) : (
            <>
              Next <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
