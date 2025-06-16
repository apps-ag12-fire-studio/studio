
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, BuyerInfo } from "@/lib/process-store";
import { ArrowRight, UserRound, FileSearch, FileText as FileTextIcon, ChevronRight } from "lucide-react";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";

export default function DadosIniciaisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processState, setProcessState] = useState<StoredProcessState>(initialStoredProcessState);

  useEffect(() => {
    const loadedState = loadProcessState();
    // Ensure buyerInfo is always an object
    if (!loadedState.buyerInfo) {
      loadedState.buyerInfo = { ...initialStoredProcessState.buyerInfo };
    }
    setProcessState(loadedState);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BuyerInfo) => {
    setProcessState(prevState => ({
      ...prevState,
      buyerInfo: {
        ...prevState.buyerInfo,
        [field]: e.target.value,
      }
    }));
  };

  const handleContractSourceChange = (value: 'new' | 'existing') => {
    setProcessState(prevState => ({
      ...prevState,
      contractSourceType: value,
      // Reset photo and AI related fields if switching source
      contractPhotoPreview: null,
      contractPhotoName: undefined,
      photoVerificationResult: null,
      photoVerified: false,
      extractedData: value === 'existing' ? prevState.extractedData : null, // Keep existing extracted data if switching to existing
    }));
  };

  const handleSelectExistingContract = () => {
    const sampleContractData: ExtractContractDataOutput = {
      nomesDasPartes: ["CLIENTE EXEMPLO, COMO COMPRADOR", "PABLO MARÇAL, COMO VENDEDOR"],
      documentosDasPartes: ["000.000.000-00", "[CNPJ DA EMPRESA VENDEDORA]"],
      objetoDoContrato: "PRODUTO DIGITAL EXEMPLO (ex: Mentoria XPTO)",
      valorPrincipal: "R$ 1.000,00 (mil reais)",
      condicoesDePagamento: "Pagamento único via Pix.",
      prazoContrato: "Acesso por 12 meses",
      localEDataAssinatura: "São Paulo, 15 de Agosto de 2024",
      foroEleito: "Comarca de São Paulo/SP",
      outrasObservacoesRelevantes: "Este é um contrato modelo carregado para demonstração."
    };
    setProcessState(prevState => ({
      ...prevState,
      extractedData: sampleContractData,
    }));
    toast({ title: "Modelo Carregado", description: "Contrato de Produto Digital carregado com dados de exemplo.", className: "bg-secondary text-secondary-foreground border-secondary" });
  };
  
  const validateStep = () => {
    const { buyerInfo } = processState;
    if (!buyerInfo.nome || !buyerInfo.cpf || !buyerInfo.telefone || !buyerInfo.email) {
      toast({ title: "Campos Obrigatórios", description: "Preencha todas as 'Informações do Comprador'.", variant: "destructive" });
      return false;
    }
    if (processState.contractSourceType === 'existing' && !processState.extractedData) {
      toast({ title: "Ação Necessária", description: "Selecione um modelo de contrato existente para prosseguir.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    const nextStepPath = processState.contractSourceType === 'new' 
      ? "/processo/foto-contrato" 
      : "/processo/documentos";
    
    saveProcessState({ ...processState, currentStep: nextStepPath });
    router.push(nextStepPath);
  };

  return (
    <>
      <header className="text-center py-8">
        <div className="mb-4 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mt-2 text-xl text-muted-foreground font-headline">
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
              <Label htmlFor="source-new" className="font-medium text-lg cursor-pointer flex-1 text-foreground">Novo Contrato <span className="text-sm text-muted-foreground">(Enviar Foto)</span></Label>
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
            <UserRound className="mr-3 h-7 w-7" /> Informações do Comprador
          </CardTitle>
          <CardDescription className="text-foreground/70 pt-1">Dados da parte que assinará como comprador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6 pt-0">
          <div>
            <Label htmlFor="responsavel-nome" className="text-foreground/90 text-sm uppercase tracking-wider">Nome Completo</Label>
            <Input id="responsavel-nome" value={processState.buyerInfo.nome} onChange={(e) => handleInputChange(e, 'nome')} placeholder="Nome completo do comprador" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="responsavel-cpf" className="text-foreground/90 text-sm uppercase tracking-wider">CPF</Label>
              <Input id="responsavel-cpf" value={processState.buyerInfo.cpf} onChange={(e) => handleInputChange(e, 'cpf')} placeholder="000.000.000-00" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
            <div>
              <Label htmlFor="responsavel-telefone" className="text-foreground/90 text-sm uppercase tracking-wider">Telefone (WhatsApp)</Label>
              <Input id="responsavel-telefone" type="tel" value={processState.buyerInfo.telefone} onChange={(e) => handleInputChange(e, 'telefone')} placeholder="(00) 00000-0000" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
            </div>
          </div>
          <div>
            <Label htmlFor="responsavel-email" className="text-foreground/90 text-sm uppercase tracking-wider">E-mail</Label>
            <Input id="responsavel-email" type="email" value={processState.buyerInfo.email} onChange={(e) => handleInputChange(e, 'email')} placeholder="seu.email@dominio.com" className="mt-2 bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3" />
          </div>
        </CardContent>
      </Card>

      {processState.contractSourceType === 'existing' && (
        <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center text-2xl font-headline text-primary">
              <FileTextIcon className="mr-3 h-7 w-7" /> Selecionar Modelo de Contrato
            </CardTitle>
            <CardDescription className="text-foreground/70 pt-1">Escolha um modelo pré-definido.</CardDescription>
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
                  Modelo de Compra de Produto Digital (Pablo Marçal)
                </div>
                <ChevronRight className="h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
              </Button>
              {processState.extractedData && (
                <p className="text-sm text-green-400 text-center">Modelo de contrato carregado com sucesso.</p>
              )}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Simulação: Funcionalidade completa de listagem de contratos salvos será implementada futuramente.
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
