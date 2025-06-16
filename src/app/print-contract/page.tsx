
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { ExtractContractDataOutput } from '@/ai/flows/extract-contract-data-flow';
import { ArrowLeft, Printer } from 'lucide-react';

export default function PrintContractPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [contractData, setContractData] = useState<ExtractContractDataOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const dataString = localStorage.getItem('extractedContractData');
      if (dataString) {
        const parsedData: ExtractContractDataOutput = JSON.parse(dataString);
        setContractData(parsedData);
      } else {
        toast({
          title: 'Erro ao carregar dados',
          description: 'Não foram encontrados dados do contrato para impressão. Redirecionando...',
          variant: 'destructive',
        });
        router.replace('/');
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({
        title: 'Erro Crítico',
        description: 'Ocorreu um problema ao carregar os dados do contrato.',
        variant: 'destructive',
      });
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardContent className="p-8 text-center">
            <p className="text-lg text-muted-foreground">Carregando dados do contrato...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contractData) {
     // This case should ideally be handled by the redirect in useEffect, but as a fallback:
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="items-center">
            <CardTitle className="text-2xl text-destructive">Erro</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">Não foi possível carregar os dados do contrato para impressão.</p>
            <Button onClick={() => router.push('/')} variant="outline">
              <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const isEmptyData = !Object.values(contractData).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  });


  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-6">
        <Card className="shadow-lg printable-area">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-2xl font-headline text-primary text-center">CONTRATO (MODELO PARA IMPRESSÃO)</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Este é um modelo gerado com os dados extraídos. Verifique todas as informações.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-sm contract-text-content">
            {isEmptyData && (
                <p className="text-center text-muted-foreground py-4">Nenhum dado foi extraído do contrato para preenchimento.</p>
            )}

            {!isEmptyData && (
              <>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-primary">Partes Envolvidas:</h3>
                  {contractData.nomesDasPartes && contractData.nomesDasPartes.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {contractData.nomesDasPartes.map((parte, index) => (
                        <li key={`parte-${index}`}>
                          {parte}
                          {contractData.documentosDasPartes && contractData.documentosDasPartes[index] &&
                            ` (Documento: ${contractData.documentosDasPartes[index]})`}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground italic">Não informado.</p>}
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-primary">Objeto do Contrato:</h3>
                  <p>{contractData.objetoDoContrato || <span className="text-muted-foreground italic">Não informado.</span>}</p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-primary">Valor Principal:</h3>
                  <p>{contractData.valorPrincipal || <span className="text-muted-foreground italic">Não informado.</span>}</p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-primary">Prazo do Contrato:</h3>
                  <p>{contractData.prazoContrato || <span className="text-muted-foreground italic">Não informado.</span>}</p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-primary">Local e Data de Assinatura:</h3>
                  <p>{contractData.localEDataAssinatura || <span className="text-muted-foreground italic">Não informado.</span>}</p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-base text-primary">Foro Eleito:</h3>
                  <p>{contractData.foroEleito || <span className="text-muted-foreground italic">Não informado.</span>}</p>
                </div>

                {contractData.outrasObservacoesRelevantes && (
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base text-primary">Outras Observações Relevantes:</h3>
                    <p>{contractData.outrasObservacoesRelevantes}</p>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
              <p>Este documento foi gerado eletronicamente com base nos dados extraídos.</p>
              <p>Assinaturas (se aplicável):</p>
              <div className="mt-10 space-y-8">
                <div className="w-full border-b border-foreground pb-1"></div>
                <div className="w-full border-b border-foreground pb-1"></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-6 w-full max-w-2xl flex flex-col sm:flex-row gap-4 print-hidden">
          <Button onClick={() => window.print()} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
            <Printer className="mr-2 h-5 w-5" /> Imprimir Contrato
          </Button>
          <Button variant="outline" onClick={() => router.push('/')} className="flex-1">
            <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Início
          </Button>
        </div>
      </div>
    </div>
  );
}

