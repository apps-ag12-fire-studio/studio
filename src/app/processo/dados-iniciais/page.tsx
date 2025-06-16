
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
import { ArrowRight, FileSearch, FileText as FileTextIcon, ChevronRight, UserCog, Users as PlayersIcon } from "lucide-react";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";

const players = [
  "Pablo Marçal",
  "Antônio Fogaça",
  "Diego Vicente",
  "Diego Abner",
  "Patrícia Pimentel",
  "Matheus Ribeiro",
  "Rogério Penna"
];

export default function DadosIniciaisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);

  useEffect(() => {
    const loadedState = loadProcessState();
    if (!loadedState.internalTeamMemberInfo) {
      loadedState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo };
    }
     if (!loadedState.buyerInfo) {
      loadedState.buyerInfo = { ...initialStoredProcessState.buyerInfo };
    }
    if (loadedState.selectedPlayer === undefined) {
      loadedState.selectedPlayer = null;
    }
    if (loadedState.selectedContractTemplateName === undefined) {
      loadedState.selectedContractTemplateName = null;
    }
    setProcessState(loadedState);
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
    setProcessState(prevState => ({
      ...prevState,
      contractSourceType: value,
      contractPhotoPreview: null,
      contractPhotoName: undefined,
      photoVerificationResult: null,
      photoVerified: false,
      extractedData: value === 'existing' ? prevState.extractedData : null, 
      selectedPlayer: value === 'existing' ? prevState.selectedPlayer : null,
      selectedContractTemplateName: value === 'existing' ? prevState.selectedContractTemplateName : null,
    }));
  };

  const handlePlayerSelect = (playerName: string) => {
    setProcessState(prevState => ({
      ...prevState,
      selectedPlayer: playerName,
      extractedData: null, 
      selectedContractTemplateName: null,
    }));
  };

  const handleSelectExistingContract = () => {
    if (!processState.selectedPlayer) {
      toast({ title: "Player Não Selecionado", description: "Por favor, selecione um Player primeiro.", variant: "destructive" });
      return;
    }
    const templateName = "Modelo de Compra de Produto Digital";
    const sampleContractData: ExtractContractDataOutput = {
      nomesDasPartes: ["CLIENTE EXEMPLO, COMO COMPRADOR", `${processState.selectedPlayer}, COMO VENDEDOR`],
      documentosDasPartes: ["000.000.000-00", "[CNPJ DA EMPRESA VENDEDORA]"],
      objetoDoContrato: `PRODUTO DIGITAL (Player: ${processState.selectedPlayer})`,
      valorPrincipal: "R$ 1.000,00 (mil reais)",
      condicoesDePagamento: "Pagamento único via Pix.",
      prazoContrato: "Acesso por 12 meses",
      localEDataAssinatura: "São Paulo, Data Atual",
      foroEleito: "Comarca de São Paulo/SP",
      outrasObservacoesRelevantes: `Contrato modelo para ${processState.selectedPlayer} carregado para demonstração.`
    };
    setProcessState(prevState => ({
      ...prevState,
      extractedData: sampleContractData,
      selectedContractTemplateName: templateName,
    }));
    toast({ 
      title: "Modelo Carregado com Sucesso!", 
      description: `O ${templateName} para ${processState.selectedPlayer} foi carregado.`, 
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

    const nextPath = processState.contractSourceType === 'new' ? "/processo/foto-contrato" : "/processo/documentos";

    saveProcessState({ ...processState, currentStep: nextPath });
    toast({
      title: "Etapa 1 Concluída!",
      description: "Dados iniciais validados com sucesso.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push(nextPath);
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
          Passo 1: Dados Iniciais
        </p>
      </header>

      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <FileSearch className="mr-3 h-7 w-7" /> Origem do Contrato
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Escolha como fornecer os dados do contrato.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <RadioGroup
            value={processState.contractSourceType}
            onValueChange={handleContractSourceChange}
            className="space-y-4"
          >
            <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
              <RadioGroupItem value="new" id="source-new" className="border-primary/50 text-primary focus:ring-primary" />
              <Label htmlFor="source-new" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Novo Contrato <span className="text-sm text-muted-foreground">(Enviar Foto para Análise)</span></Label>
            </div>
            <div className="flex items-center space-x-3 p-4 border border-border rounded-xl hover:border-primary/70 transition-colors cursor-pointer bg-background/30">
              <RadioGroupItem value="existing" id="source-existing" className="border-primary/50 text-primary focus:ring-primary" />
              <Label htmlFor="source-existing" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Contrato Existente <span className="text-sm text-muted-foreground">(Selecionar Modelo)</span></Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
      
      <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center text-2xl font-headline text-primary">
            <UserCog className="mr-3 h-7 w-7" /> Informações do Responsável Interno
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Dados do membro da equipe que está conduzindo este processo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="internal-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
            <Input id="internal-nome" value={processState.internalTeamMemberInfo.nome} onChange={(e) => handleInternalTeamMemberInputChange(e, 'nome')} placeholder="Nome do responsável interno" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="internal-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">CPF</Label>
              <Input id="internal-cpf" value={processState.internalTeamMemberInfo.cpf} onChange={(e) => handleInternalTeamMemberInputChange(e, 'cpf')} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
            <div>
              <Label htmlFor="internal-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Telefone</Label>
              <Input id="internal-telefone" type="tel" value={processState.internalTeamMemberInfo.telefone} onChange={(e) => handleInternalTeamMemberInputChange(e, 'telefone')} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
          </div>
          <div>
            <Label htmlFor="internal-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
            <Input id="internal-email" type="email" value={processState.internalTeamMemberInfo.email} onChange={(e) => handleInternalTeamMemberInputChange(e, 'email')} placeholder="email.interno@empresa.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
        </CardContent>
      </Card>

      {processState.contractSourceType === 'existing' && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <PlayersIcon className="mr-3 h-7 w-7" /> Selecionar Player
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Escolha o produtor do conteúdo.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <Select value={processState.selectedPlayer || ""} onValueChange={handlePlayerSelect}>
              <SelectTrigger className="w-full bg-input border-border/70 focus:border-primary focus:ring-primary text-lg py-3 placeholder:text-muted-foreground/70">
                <SelectValue placeholder="Selecione um Player..." />
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
            <CardDescription className="text-foreground/70 pt-1">Escolha um modelo pré-definido para o Player: <strong>{processState.selectedPlayer}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
              <Button 
                type="button" 
                onClick={handleSelectExistingContract} 
                variant="outline"
                className="w-full border-primary/80 text-primary hover:bg-primary/10 text-base py-4 rounded-lg flex justify-between items-center group"
              >
                <div className="flex items-center">
                  <FileTextIcon className="mr-3 h-5 w-5" /> 
                  Modelo de Compra de Produto Digital
                </div>
                <ChevronRight className="h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
              </Button>
              {processState.extractedData && processState.selectedContractTemplateName && (
                <p className="text-sm text-green-400 text-center">Modelo de contrato para {processState.selectedPlayer} carregado com sucesso.</p>
              )}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Simulação: Para cada player, o mesmo modelo de contrato será carregado. Funcionalidade completa de listagem de contratos específicos por player será implementada futuramente.
              </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end mt-8">
        <Button 
          onClick={handleNext} 
          className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-6 px-8 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
        >
          Próximo <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
