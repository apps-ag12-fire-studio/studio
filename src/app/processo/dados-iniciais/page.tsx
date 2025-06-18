
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
import { ArrowRight, FileSearch, FileText as FileTextIcon, ChevronRight, UserCog, Users as PlayersIcon, Loader2 } from "lucide-react";
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
    id: 'compra-produto-digital',
    displayName: 'Modelo de Compra de Produto Digital',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: ["CLIENTE EXEMPLO, COMO COMPRADOR", `${selectedPlayer || 'NOME DO PLAYER'}, COMO VENDEDOR`],
      documentosDasPartes: ["000.000.000-00", "[CNPJ DA EMPRESA VENDEDORA]"],
      objetoDoContrato: `PRODUTO DIGITAL (Player: ${selectedPlayer || 'NOME DO PLAYER'})`,
      valorPrincipal: "R$ 15.000,00 (quinze mil reais)",
      condicoesDePagamento: "Pagamento único via Pix.",
      prazoContrato: "Acesso por 12 meses",
      localEDataAssinatura: "São Paulo, Data Atual",
      foroEleito: "Comarca de São Paulo/SP",
      outrasObservacoesRelevantes: `Contrato modelo para ${selectedPlayer || 'NOME DO PLAYER'} carregado para demonstração.`
    })
  },
  {
    id: 'prestacao-servicos',
    displayName: 'Contrato de Prestação de Serviços',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: ["[NOME DO CONTRATANTE], como CONTRATANTE", `${selectedPlayer || '[NOME DO CONTRATADO]'}, como CONTRATADO`],
      documentosDasPartes: ["[CPF/CNPJ DO CONTRATANTE]", "[CPF/CNPJ DO CONTRATADO]"],
      objetoDoContrato: `Prestação de Serviços de [DESCREVER O SERVIÇO] (Contratado: ${selectedPlayer || '[NOME DO CONTRATADO]'})`,
      valorPrincipal: "R$ [VALOR]",
      condicoesDePagamento: "[FORMA DE PAGAMENTO]",
      prazoContrato: "[XX] dias/semanas/meses, iniciando-se em [DATA INICIAL]",
      localEDataAssinatura: "[Local], [Data]",
      foroEleito: "[CIDADE/UF]",
      outrasObservacoesRelevantes: "Cláusula 1 – Objeto: O presente contrato tem por objeto a prestação dos seguintes serviços: [DESCREVER O SERVIÇO]. Cláusula 4 – Obrigações das Partes: O Contratado deverá entregar os serviços descritos com qualidade e pontualidade. O Contratante deverá efetuar os pagamentos nos prazos combinados. Cláusula 5 – Rescisão: Este contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de [X] dias."
    })
  },
  {
    id: 'parceria-comercial',
    displayName: 'Contrato de Parceria Comercial',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: [`${selectedPlayer || '[NOME EMPRESA 1]'}, como PARCEIRA 1`, "[NOME EMPRESA 2], como PARCEIRA 2"],
      documentosDasPartes: ["[CNPJ EMPRESA 1]", "[CNPJ EMPRESA 2]"],
      objetoDoContrato: `Parceria Comercial entre ${selectedPlayer || '[NOME EMPRESA 1]'} e [NOME EMPRESA 2] para [DESCREVER A FINALIDADE: EX: DIVULGAÇÃO CONJUNTA, VENDA DE PRODUTOS, PRESTAÇÃO DE SERVIÇOS EM CONJUNTO ETC.]`,
      valorPrincipal: "Lucros/Resultados divididos conforme: [DESCREVER PORCENTAGEM OU MODELO DE DISTRIBUIÇÃO]",
      condicoesDePagamento: `Responsabilidades: ${selectedPlayer || '[EMPRESA 1]'}: [RESPONSABILIDADES DA EMPRESA 1]; [EMPRESA 2]: [RESPONSABILIDADES DA EMPRESA 2].`,
      prazoContrato: "[XX] meses, com início em [DATA]",
      localEDataAssinatura: "[Local], [Data]",
      foroEleito: "[CIDADE/UF]",
      outrasObservacoesRelevantes: "Cláusula 1 – Objeto: As partes se comprometem a colaborar comercialmente para [DESCREVER A FINALIDADE]. Cláusula 5 – Rescisão: Poderá ser rescindido por qualquer das partes com aviso prévio de [X] dias."
    })
  },
  {
    id: 'confidencialidade-nda',
    displayName: 'Contrato de Confidencialidade (NDA)',
    data: (selectedPlayer: string | null) => ({
      nomesDasPartes: [`${selectedPlayer || '[NOME PARTE REVELADORA]'}, como PARTE REVELADORA`, "[NOME PARTE RECEPTORA], como PARTE RECEPTORA"],
      documentosDasPartes: ["[CPF/CNPJ PARTE REVELADORA]", "[CPF/CNPJ PARTE RECEPTORA]"],
      objetoDoContrato: `Acordo de Confidencialidade (NDA) entre ${selectedPlayer || '[NOME PARTE REVELADORA]'} e [NOME PARTE RECEPTORA] para [FINALIDADE DO ACORDO]`,
      valorPrincipal: "Não aplicável",
      condicoesDePagamento: "Cláusula 3 – Obrigações da Parte Receptora: Não divulgar as informações recebidas; Utilizá-las apenas para os fins permitidos; Proteger o conteúdo com o mesmo cuidado que protegeria suas próprias informações.",
      prazoContrato: "Cláusula 4 – Vigência: Este acordo entra em vigor na data de assinatura e permanecerá válido por [X ANOS] após o término da relação entre as partes.",
      localEDataAssinatura: "[Local], [Data]",
      foroEleito: "[CIDADE/UF]",
      outrasObservacoesRelevantes: "Cláusula 1 – Objeto: Este acordo visa proteger as informações confidenciais trocadas entre as partes no contexto de [FINALIDADE DO ACORDO]. Cláusula 2 – Definição de Informação Confidencial: Considera-se confidencial toda e qualquer informação escrita, oral, visual ou eletrônica, revelada por uma das partes à outra."
    })
  }
];

export default function DadosIniciaisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);
  const [isLoading, setIsLoading] = useState(false); // For page navigation
  const [isStateLoading, setIsStateLoading] = useState(true); // For initial state load

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
    // No need to call saveProcessState here if it's called on handleNext or blur/unmount
  };

  const handlePlayerSelect = (playerName: string) => {
    const newState = {
      ...processState,
      selectedPlayer: playerName,
      extractedData: null, 
      selectedContractTemplateName: null, // Reset template when player changes
    };
    setProcessState(newState);
  };

  const handleSelectContractTemplate = (templateId: string) => {
    if (!processState.selectedPlayer) {
      toast({ title: "Player Não Selecionado", description: "Por favor, selecione um Player primeiro.", variant: "destructive" });
      return;
    }
    const template = contractTemplates.find(t => t.id === templateId);
    if (!template) {
      toast({ title: "Modelo Não Encontrado", description: "Ocorreu um erro ao carregar o modelo de contrato.", variant: "destructive" });
      return;
    }

    const contractData = template.data(processState.selectedPlayer);
    
    const newState = {
      ...processState,
      extractedData: contractData,
      selectedContractTemplateName: template.displayName,
    };
    setProcessState(newState);
    saveProcessState(newState); // Save after significant action
    toast({ 
      title: "Modelo Carregado com Sucesso!", 
      description: `O modelo "${template.displayName}" para ${processState.selectedPlayer} foi carregado.`, 
      className: "bg-secondary text-secondary-foreground border-secondary" 
    });
  };
  
  const validateStep = () => {
    const { internalTeamMemberInfo } = processState;
    if (!internalTeamMemberInfo.nome || !internalTeamMemberInfo.cpf || !internalTeamMemberInfo.telefone || !internalTeamMemberInfo.email) {
      toast({ title: "Campos Obrigatórios", description: "Preencha todas as 'Informações do Responsável Interno'.", variant: "destructive" });
      return false;
    }
    if (processState.contractSourceType === 'existing') {
      if (!processState.selectedPlayer) {
        toast({ title: "Ação Necessária", description: "Selecione um Player.", variant: "destructive" });
        return false;
      }
      if (!processState.extractedData) {
        toast({ title: "Ação Necessária", description: "Selecione um modelo de contrato para o Player escolhido.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setIsLoading(true);

    const nextPath = processState.contractSourceType === 'new' ? "/processo/foto-contrato" : "/processo/documentos";
    const updatedState = { ...processState, currentStep: nextPath };
    
    saveProcessState(updatedState); // Save state before navigating
    setProcessState(updatedState); // Update local state if saveProcessState doesn't do it synchronously for UI

    toast({
      title: "Etapa 1 Concluída!",
      description: "Dados iniciais validados. Carregando próxima etapa...",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push(nextPath);
  };

  // Save state on component unmount or input blur for critical fields
  useEffect(() => {
    return () => {
      saveProcessState(processState);
    };
  }, [processState]);


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
          Passo 1: Dados Iniciais
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <FileSearch className="mr-3 h-7 w-7" /> O Contrato que será assinado é:
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Escolha como fornecer os dados do contrato.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <RadioGroup
            value={processState.contractSourceType}
            onValueChange={handleContractSourceChange}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
              <RadioGroupItem value="new" id="source-new" className="border-primary/50 text-primary focus:ring-primary" />
              <Label htmlFor="source-new" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Um Novo Modelo de Contrato <span className="text-sm text-muted-foreground">(Enviar Foto para Análise)</span></Label>
            </div>
            <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
              <RadioGroupItem value="existing" id="source-existing" className="border-primary/50 text-primary focus:ring-primary" />
              <Label htmlFor="source-existing" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Contrato Validado pela ADM <span className="text-sm text-muted-foreground">(Selecionar Modelo)</span></Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      
      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <UserCog className="mr-3 h-7 w-7" /> Informações do Responsável Interno
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Dados do membro da equipe que está conduzindo este processo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="internal-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
            <Input id="internal-nome" value={processState.internalTeamMemberInfo?.nome || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'nome')} placeholder="Nome do responsável interno" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="internal-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">CPF</Label>
              <Input id="internal-cpf" value={processState.internalTeamMemberInfo?.cpf || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'cpf')} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
            <div>
              <Label htmlFor="internal-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Telefone</Label>
              <Input id="internal-telefone" type="tel" value={processState.internalTeamMemberInfo?.telefone || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'telefone')} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
          </div>
          <div>
            <Label htmlFor="internal-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
            <Input id="internal-email" type="email" value={processState.internalTeamMemberInfo?.email || ''} onChange={(e) => handleInternalTeamMemberInputChange(e, 'email')} placeholder="email.interno@empresa.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
        </CardContent>
      </Card>

      {processState.contractSourceType === 'existing' && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <PlayersIcon className="mr-3 h-7 w-7" /> Selecionar Player (Expert)
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Escolha o produtor do conteúdo ou parte principal do contrato.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <Select value={processState.selectedPlayer || ""} onValueChange={handlePlayerSelect}>
              <SelectTrigger className="w-full bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-3 placeholder:text-muted-foreground/70">
                <SelectValue placeholder="Selecione um Player/Expert..." />
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
              <FileTextIcon className="mr-3 h-7 w-7" /> Selecionar Modelo de Contrato
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1 whitespace-normal">Escolha um modelo pré-definido para o Player: <strong>{processState.selectedPlayer}</strong></CardDescription>
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
                <p className="text-sm text-green-400 text-center pt-2">Modelo "{processState.selectedContractTemplateName}" para {processState.selectedPlayer} carregado.</p>
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
              Aguarde...
            </>
          ) : (
            <>
              Próximo <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
