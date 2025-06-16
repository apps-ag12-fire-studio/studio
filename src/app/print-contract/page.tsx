
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
  
  const compradorNome = contractData.nomesDasPartes && contractData.nomesDasPartes.length > 0 ? contractData.nomesDasPartes[0].split(', COMO')[0] : '[NOME DO COMPRADOR]';
  const compradorDocumento = contractData.documentosDasPartes && contractData.documentosDasPartes.length > 0 ? contractData.documentosDasPartes[0] : '[CPF ou CNPJ DO COMPRADOR]';


  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background p-4 sm:p-8">
      <div className="w-full max-w-3xl space-y-6">
        <Card className="shadow-lg printable-area">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-xl font-headline text-primary text-center">📄 MODELO SIMPLES DE CONTRATO DE COMPRA DE PRODUTO DIGITAL</CardTitle>
            <CardDescription className="text-center text-muted-foreground mt-2">
              CONTRATO DE COMPRA E ACESSO A PRODUTO DIGITAL
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 text-sm contract-text-content">
            <p>Pelo presente instrumento particular, de um lado:</p>

            <div className="space-y-1 pl-4">
              <p><strong>COMPRADOR:</strong></p>
              <p>Nome: {compradorNome}</p>
              <p>CPF/CNPJ: {compradorDocumento}</p>
              <p>E-mail: [E-MAIL DO COMPRADOR]</p>
              <p>Telefone: [WHATSAPP DO COMPRADOR]</p>
            </div>

            <p>E de outro lado:</p>

            <div className="space-y-1 pl-4">
              <p><strong>VENDEDOR:</strong></p>
              <p>Nome: PABLO MARÇAL (ou empresa representante oficial)</p>
              <p>CNPJ: [CNPJ DA EMPRESA VENDEDORA]</p>
              <p>Endereço: [ENDEREÇO COMPLETO DA EMPRESA VENDEDORA]</p>
              <p>E-mail: [E-MAIL DA EMPRESA VENDEDORA]</p>
            </div>

            <p>Têm entre si justo e contratado o seguinte:</p>

            <hr className="my-3"/>

            <h3 className="font-semibold text-base text-primary">1. OBJETO</h3>
            <p className="pl-4">1.1. O presente contrato tem por objeto a <strong>compra do produto digital</strong> denominado: <strong>{contractData.objetoDoContrato || '[NOME DO PRODUTO – ex: Mentoria Código do Reino, Evento Empresas Exponenciais, etc.]'}</strong>, de autoria de Pablo Marçal, disponibilizado via acesso online.</p>

            <hr className="my-3"/>

            <h3 className="font-semibold text-base text-primary">2. VALOR E FORMA DE PAGAMENTO</h3>
            <p className="pl-4">2.1. O valor acordado para a aquisição do produto é de <strong>{contractData.valorPrincipal || 'R$ [VALOR]'}</strong>.</p>
            <p className="pl-4">2.2. O pagamento poderá ser efetuado via [Pix / Cartão de Crédito / Boleto], conforme escolha do comprador no ato da compra.</p>
            <p className="pl-4">2.3. A liberação do acesso ao produto ocorrerá após a <strong>confirmação do pagamento</strong>.</p>
            
            <hr className="my-3"/>

            <h3 className="font-semibold text-base text-primary">3. ENTREGA DO PRODUTO</h3>
            <p className="pl-4">3.1. O produto será disponibilizado por meio digital, com acesso enviado para o e-mail ou WhatsApp do comprador em até <strong>[X horas/dias úteis]</strong> após confirmação do pagamento.</p>
            <p className="pl-4">3.2. O acesso poderá ser feito via plataforma [Hotmart / Eduzz / app oficial do evento / link privado], conforme orientações enviadas ao comprador.</p>

            <hr className="my-3"/>

            <h3 className="font-semibold text-base text-primary">4. DIREITOS E RESPONSABILIDADES</h3>
            <p className="pl-4">4.1. O comprador se compromete a <strong>utilizar o conteúdo apenas para fins pessoais e educativos</strong>, sendo vedada a reprodução, distribuição ou comercialização sem autorização expressa do autor.</p>
            <p className="pl-4">4.2. O vendedor garante o acesso ao conteúdo durante o prazo estipulado na oferta, respeitando eventuais atualizações ou encerramentos conforme descrito no momento da compra.</p>

            <hr className="my-3"/>

            <h3 className="font-semibold text-base text-primary">5. POLÍTICA DE REEMBOLSO</h3>
            <p className="pl-4">5.1. O comprador terá o <strong>direito de solicitar reembolso</strong> dentro do prazo de <strong>7 dias corridos</strong>, conforme previsto no Código de Defesa do Consumidor, desde que ainda não tenha consumido integralmente o conteúdo.</p>
            <p className="pl-4">5.2. Após este prazo, o valor pago será considerado como definitivo e o acesso será mantido conforme estipulado.</p>

            <hr className="my-3"/>

            <h3 className="font-semibold text-base text-primary">6. DISPOSIÇÕES FINAIS</h3>
            <p className="pl-4">6.1. As partes elegem o foro da comarca de {contractData.foroEleito || '[CIDADE/UF DO FORO]'} para dirimir eventuais conflitos decorrentes deste contrato.</p>
            <p className="pl-4">6.2. Este contrato entra em vigor na data da efetivação da compra, tendo validade até a entrega integral do conteúdo ou conforme os termos de acesso estabelecidos. {contractData.prazoContrato ? `(Prazo extraído: ${contractData.prazoContrato})` : ''}</p>
            
            <hr className="my-3"/>

            <p className="text-center mt-6">{contractData.localEDataAssinatura || '[Local], [Data]'}</p>
            
            <div className="mt-10 space-y-8">
              <div className="w-3/4 mx-auto border-b border-foreground pb-1 text-center">
                <p className="text-xs">(Assinatura do Comprador)</p>
              </div>
              <div className="w-3/4 mx-auto border-b border-foreground pb-1 text-center">
                 <p className="text-xs">(Assinatura do Representante Legal - Equipe Pablo Marçal)</p>
              </div>
            </div>

            {contractData.outrasObservacoesRelevantes && (
                <div className="mt-6 pt-4 border-t">
                    <h3 className="font-semibold text-base text-primary">Outras Observações Extraídas:</h3>
                    <p className="text-muted-foreground text-xs">{contractData.outrasObservacoesRelevantes}</p>
                </div>
            )}
          </CardContent>
        </Card>
        
        <div className="mt-6 w-full max-w-3xl flex flex-col sm:flex-row gap-4 print-hidden">
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
