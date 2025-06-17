
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Printer, Loader2, FilePenLine, Image as ImageIcon } from 'lucide-react'; 
import { loadPrintData, type PrintData } from '@/lib/process-store';
import { saveProcessState, loadProcessState } from '@/lib/process-store'; 

export default function PrintContractPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const data = loadPrintData();
    if (data && data.extractedData && data.buyerInfo && data.internalTeamMemberInfo) {
      setPrintData(data);
    } else {
      toast({
        title: 'Erro ao Carregar Dados',
        description: 'Dados do contrato ou informações essenciais não encontrados para impressão. Redirecionando...',
        variant: 'destructive',
      });
      router.replace('/processo/revisao-envio'); 
    }
    setIsLoading(false);
  }, [router, toast]);

  const handleProceedToSignedUpload = () => {
    const currentState = loadProcessState();
    saveProcessState({ ...currentState, currentStep: "/processo/foto-contrato-assinado" });
    toast({
      title: "Impressão (Simulada) Concluída!",
      description: "Prossiga para anexar a foto do contrato assinado.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push('/processo/foto-contrato-assinado');
  };

  const renderDocumentImage = (url: string | null | undefined, label: string) => {
    if (!url) return null;
    if (url.startsWith('data:application/pdf')) {
      return (
        <div className="mb-4 p-2 border border-dashed border-border text-center text-sm text-muted-foreground">
          <FilePenLine className="h-8 w-8 mx-auto mb-1 text-primary" />
          {label} (PDF) - Conteúdo de PDFs não é exibido na pré-visualização, mas será incluído se o navegador suportar a impressão de data URIs de PDF.
        </div>
      );
    }
    return (
      <div className="mb-6 document-to-print" style={{ pageBreakInside: 'avoid' }}>
        <p className="font-semibold text-center text-muted-foreground mb-2 print:text-xs">{label}</p>
        <div className="relative w-full aspect-[7/10] mx-auto border border-border/50 rounded overflow-hidden bg-muted/10 print:aspect-auto print:h-[calc(100vh/2.2)] print:w-auto print:max-w-full print:border-none print:shadow-none">
          <Image src={url} alt={label} layout="fill" objectFit="contain" />
        </div>
      </div>
    );
  };


  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-card-premium rounded-2xl bg-card/80 backdrop-blur-sm">
          <CardContent className="p-10 text-center flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Carregando dados do contrato...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!printData || !printData.extractedData || !printData.buyerInfo || !printData.internalTeamMemberInfo) { 
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-card-premium rounded-2xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="items-center p-8">
            <CardTitle className="text-2xl text-destructive font-headline">Erro de Carregamento</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8">
            <p className="text-muted-foreground mb-6">Não foi possível carregar os dados completos do contrato. Verifique as etapas anteriores.</p>
            <Button onClick={() => router.push('/processo/revisao-envio')} variant="outline" className="border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
              <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Revisão
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { extractedData, buyerInfo, companyInfo, buyerType, selectedPlayer, internalTeamMemberInfo } = printData;

  const vendedorNome = selectedPlayer || 
                       extractedData?.nomesDasPartes?.find(nome => nome.toUpperCase().includes("VENDEDOR")) || 
                       "PABLO MARÇAL (ou empresa representante oficial)";
  
  const vendedorDocumento = extractedData?.documentosDasPartes?.find((doc, index) => {
    const nomeParte = extractedData.nomesDasPartes?.[index]?.toUpperCase();
    return nomeParte?.includes("VENDEDOR") || (selectedPlayer && nomeParte?.includes(selectedPlayer.toUpperCase()));
  }) || "[CNPJ DA EMPRESA VENDEDORA]";


  const renderCompradorInfo = () => {
    if (buyerType === 'pj' && companyInfo && buyerInfo) {
      return (
        <>
          <p className="font-headline text-primary/90 text-base">COMPRADOR (PESSOA JURÍDICA):</p>
          <p><strong>Razão Social:</strong> {companyInfo.razaoSocial || '[RAZÃO SOCIAL DA EMPRESA]'}</p>
          <p><strong>CNPJ:</strong> {companyInfo.cnpj || '[CNPJ DA EMPRESA]'}</p>
          <p><strong>Representada por:</strong> {buyerInfo.nome || '[NOME DO REPRESENTANTE]'}</p>
          <p><strong>CPF do Representante:</strong> {buyerInfo.cpf || '[CPF DO REPRESENTANTE]'}</p>
          <p><strong>E-mail:</strong> {buyerInfo.email || '[E-MAIL DO REPRESENTANTE]'}</p>
          <p><strong>Telefone:</strong> {buyerInfo.telefone || '[TELEFONE DO REPRESENTANTE]'}</p>
        </>
      );
    }
    return (
      <>
        <p className="font-headline text-primary/90 text-base">COMPRADOR (PESSOA FÍSICA):</p>
        <p><strong>Nome:</strong> {buyerInfo?.nome || '[NOME DO COMPRADOR]'}</p>
        <p><strong>CPF:</strong> {buyerInfo?.cpf || '[CPF DO COMPRADOR]'}</p>
        <p><strong>E-mail:</strong> {buyerInfo?.email || '[E-MAIL DO COMPRADOR]'}</p>
        <p><strong>Telefone:</strong> {buyerInfo?.telefone || '[TELEFONE DO COMPRADOR]'}</p>
      </>
    );
  };


  return (
    <>
      <style jsx global>{`
        @media print {
          .document-to-print {
            page-break-before: always !important;
          }
          .no-page-break-after {
            page-break-after: avoid !important;
          }
        }
      `}</style>
      <header className="text-center py-8 print-hidden">
        <div className="mb-1 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Contrato Fácil
        </div>
        <p className="mb-4 text-sm text-foreground/80">
          Financeiro Plataforma Internacional - Solução SAAS com Inteligência Artificial em treinamento por Antônio Fogaça.
        </p>
        <p className="text-xl text-muted-foreground font-headline">
          Passo 5: Impressão do Contrato e Documentos
        </p>
      </header>
      <div className="flex min-h-screen flex-col items-center justify-start bg-background text-foreground p-6 sm:p-12 print-only-flex-col">
        <div className="w-full max-w-3xl space-y-8">
          <div className="print-hidden text-center mb-6">
              <h1 className="text-3xl font-headline text-primary text-glow-gold">Pré-visualização do Contrato e Documentos</h1>
              <p className="text-muted-foreground mt-2">Este conjunto está pronto para impressão. Após imprimir e assinar, anexe a foto do contrato assinado.</p>
          </div>
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/95 printable-area no-page-break-after">
            <CardHeader className="border-b border-border/50 pb-4 p-6">
              <CardTitle className="text-xl sm:text-2xl font-headline text-primary text-center uppercase tracking-wider">
                Contrato de Compra de Produto Digital
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground mt-2 text-sm">
                Instrumento Particular de Compra e Acesso {selectedPlayer ? ` - Player: ${selectedPlayer}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6 text-sm contract-text-content text-foreground/90 leading-relaxed">
              <p>Pelo presente instrumento particular, de um lado:</p>

              <div className="space-y-1 pl-4 border-l-2 border-primary/30 py-2">
                {renderCompradorInfo()}
              </div>

              <p>E de outro lado:</p>

              <div className="space-y-1 pl-4 border-l-2 border-primary/30 py-2">
                <p className="font-headline text-primary/90 text-base">VENDEDOR:</p>
                <p><strong>Nome:</strong> {vendedorNome}</p>
                <p><strong>CNPJ/CPF:</strong> {vendedorDocumento}</p>
                <p><strong>Endereço:</strong> [ENDEREÇO COMPLETO DA EMPRESA VENDEDORA]</p>
                <p><strong>E-mail:</strong> [E-MAIL DA EMPRESA VENDEDORA]</p>
              </div>

              <p>Têm entre si justo e contratado o seguinte:</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">1. OBJETO DO CONTRATO</h3>
              <p className="pl-4">1.1. O presente contrato tem por objeto a aquisição do produto digital denominado: <strong>{extractedData?.objetoDoContrato || '[NOME DO PRODUTO DIGITAL]'}</strong>, de autoria de {selectedPlayer || 'Pablo Marçal'} (ou empresa representante), disponibilizado via acesso online, conforme especificações detalhadas na oferta do produto.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">2. VALOR E CONDIÇÕES DE PAGAMENTO</h3>
              <p className="pl-4">2.1. O valor total para a aquisição do produto digital é de <strong>{extractedData?.valorPrincipal || 'R$ [VALOR TOTAL]'}</strong>.</p>
              <p className="pl-4">2.2. Forma de Pagamento: {extractedData?.condicoesDePagamento ? extractedData.condicoesDePagamento : 'Conforme selecionado pelo COMPRADOR no ato da compra.'}</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">3. ACESSO E ENTREGA</h3>
              <p className="pl-4">3.1. O produto será entregue digitalmente, com as credenciais e instruções de acesso enviadas para o e-mail cadastrado pelo COMPRADOR.</p>
              <p className="pl-4">3.2. O prazo de acesso ao conteúdo do produto é de {extractedData?.prazoContrato || '[PRAZO DE ACESSO]'} a contar da data de liberação do acesso.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">4. DIREITOS E RESPONSABILIDADES</h3>
              <p className="pl-4">4.1. O COMPRADOR compromete-se a utilizar o conteúdo exclusivamente para fins pessoais e intransferíveis, sendo vedada a reprodução, cópia, distribuição, ou comercialização do material sem autorização expressa e por escrito do VENDEDOR.</p>
              <p className="pl-4">4.2. O VENDEDOR garante o funcionamento da plataforma de acesso e a disponibilidade do conteúdo durante o prazo contratado, ressalvadas interrupções por manutenções programadas ou motivos de força maior.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">5. POLÍTICA DE REEMBOLSO</h3>
              <p className="pl-4">5.1. O COMPRADOR poderá solicitar o cancelamento e reembolso integral do valor pago no prazo de 07 (sete) dias corridos a contar da data da compra, conforme Art. 49 do Código de Defesa do Consumidor.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">6. DISPOSIÇÕES GERAIS</h3>
              <p className="pl-4">6.1. As partes elegem o foro da comarca de {extractedData?.foroEleito || '[CIDADE/UF DO FORO]'} para dirimir quaisquer controvérsias oriundas do presente contrato.</p>
              {extractedData?.outrasObservacoesRelevantes && (
                  <p className="pl-4 mt-2"><strong>Observações Adicionais:</strong> {extractedData.outrasObservacoesRelevantes}</p>
              )}
              <hr className="my-6 border-border/30"/>
              <p className="text-center mt-8 text-muted-foreground">{extractedData?.localEDataAssinatura || '[Local], [Data]'}</p>
              <div className="mt-12 space-y-10">
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">
                     {buyerType === 'pj' && companyInfo ? companyInfo.razaoSocial : buyerInfo?.nome || '[NOME DO COMPRADOR/EMPRESA]'}
                     {buyerType === 'pj' && buyerInfo && <span className="block text-xs text-muted-foreground">Representado por: {buyerInfo.nome}</span>}
                   </p>
                   <p className="text-xs text-muted-foreground">(COMPRADOR{buyerType === 'pj' ? ' - PESSOA JURÍDICA' : ''})</p>
                </div>
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">[ESPAÇO PARA ASSINATURA DO REPRESENTANTE LEGAL]</p>
                   <p className="text-xs text-muted-foreground">(VENDEDOR - Representante Legal {selectedPlayer ? `- ${selectedPlayer}`: ''})</p>
                </div>
              </div>
              <hr className="my-6 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide text-center">TESTEMUNHAS</h3>
              <div className="mt-8 space-y-10">
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">{internalTeamMemberInfo.nome || '[ASSINATURA TESTEMUNHA - RESP. INTERNO]'}</p>
                   <p className="text-xs text-muted-foreground">(Testemunha - Responsável Interno)</p>
                   {internalTeamMemberInfo.cpf && <p className="text-xs text-muted-foreground">CPF: {internalTeamMemberInfo.cpf}</p>}
                </div>
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">[ESPAÇO PARA ASSINATURA DA SEGUNDA TESTEMUNHA]</p>
                   <p className="text-xs text-muted-foreground">(Testemunha)</p>
                   <p className="text-xs text-muted-foreground">CPF: [CPF DA SEGUNDA TESTEMUNHA]</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Documentos do Comprador */}
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/95 printable-area">
            <CardHeader className="border-b border-border/50 pb-4 p-6">
              <CardTitle className="text-xl sm:text-2xl font-headline text-primary text-center uppercase tracking-wider">
                <ImageIcon className="inline-block mr-2 h-6 w-6" /> Anexos - Documentos do Comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-4">
              {buyerType === 'pf' && (
                <>
                  {renderDocumentImage(printData.rgAntigoFrenteUrl, 'RG (Antigo) - Frente')}
                  {renderDocumentImage(printData.rgAntigoVersoUrl, 'RG (Antigo) - Verso')}
                  {renderDocumentImage(printData.rgQrcodeDocUrl, 'RG (QRCode)')}
                  {renderDocumentImage(printData.cnhAntigaFrenteUrl, 'CNH (Antiga) - Frente')}
                  {renderDocumentImage(printData.cnhAntigaVersoUrl, 'CNH (Antiga) - Verso')}
                  {renderDocumentImage(printData.cnhQrcodeDocUrl, 'CNH (QRCode)')}
                </>
              )}
              {buyerType === 'pj' && (
                <>
                  {renderDocumentImage(printData.cartaoCnpjFileUrl, 'Cartão CNPJ')}
                  {renderDocumentImage(printData.docSocioFrenteUrl, 'Documento do Sócio/Representante - Frente')}
                  {renderDocumentImage(printData.docSocioVersoUrl, 'Documento do Sócio/Representante - Verso')}
                </>
              )}
              {renderDocumentImage(printData.comprovanteEnderecoUrl, buyerType === 'pf' ? 'Comprovante de Endereço Pessoal' : 'Comprovante de Endereço da Empresa')}
            </CardContent>
          </Card>

          <div className="mt-8 w-full max-w-3xl flex flex-col sm:flex-row gap-4 print-hidden">
            <Button onClick={() => window.print()} className="flex-1 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-600/90 hover:to-blue-800/90 text-lg py-4 rounded-lg text-white shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
              <Printer className="mr-2 h-5 w-5" /> Imprimir Tudo
            </Button>
            <Button onClick={handleProceedToSignedUpload} className="flex-1 bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-4 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
               <FilePenLine className="mr-2 h-5 w-5" /> Contrato Assinado - Anexar Foto
            </Button>
          </div>
          <div className="mt-4 w-full max-w-3xl print-hidden">
             <Button variant="outline" onClick={() => router.push('/processo/revisao-envio')} className="w-full border-primary/80 text-primary hover:bg-primary/10 text-lg py-4 rounded-lg">
              <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Revisão
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

