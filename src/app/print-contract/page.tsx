
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Printer, Loader2, FilePenLine, Image as ImageIcon, QrCode } from 'lucide-react';
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, BuyerInfo, CompanyInfo } from '@/lib/process-store';

// Componente para o rodapé de impressão personalizado
const PrintFooter = ({ processId }: { processId: string | null }) => {
  if (!processId) return null;

  const verificationBaseUrl = "https://contratofacil.app/verify"; // Use seu domínio real aqui
  const verificationUrl = `${verificationBaseUrl}?id=${processId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(verificationUrl)}`;

  return (
    <div className="custom-print-footer print-only">
      <div className="verification-text">
        <p>Para verificar a autenticidade deste documento, acesse:</p>
        <p className="font-semibold">{verificationUrl}</p>
      </div>
      <Image 
        src={qrCodeUrl} 
        alt={`QR Code para verificação do Processo ID ${processId}`} 
        width={70} 
        height={70}
        className="qr-code-image"
        unoptimized // Para evitar otimização do Next/Image em URLs externas de API
      />
    </div>
  );
};


export default function PrintContractPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentProcessState, setCurrentProcessState] = useState<StoredProcessState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false); 

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const loadedData = await loadProcessState();
      
      console.log('[PrintContractPage] Loaded data by loadProcessState():', loadedData ? JSON.parse(JSON.stringify(loadedData)) : String(loadedData));
      if (loadedData) {
        console.log('  [PrintContractPage] > loadedData.processId:', loadedData.processId);
        console.log('  [PrintContractPage] > loadedData.internalTeamMemberInfo:', JSON.stringify(loadedData.internalTeamMemberInfo, null, 2));
        console.log('  [PrintContractPage] > loadedData.extractedData:', JSON.stringify(loadedData.extractedData, null, 2));
        console.log('  [PrintContractPage] > loadedData.buyerInfo:', JSON.stringify(loadedData.buyerInfo, null, 2));
        console.log('  [PrintContractPage] > loadedData.companyInfo:', JSON.stringify(loadedData.companyInfo, null, 2));
      }

      setCurrentProcessState(loadedData); 
      setIsLoading(false);
    };
    fetchData();
  }, []); 

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handleInitiatePrint = () => {
    setIsPrinting(true);
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch (error) {
        console.error("Error calling window.print():", error);
        toast({
            title: "Erro ao Imprimir",
            description: "Não foi possível abrir a caixa de diálogo de impressão.",
            variant: "destructive"
        });
        setIsPrinting(false); 
      }
    });
  };

  const handleProceedToSignedUpload = async () => {
    if (!currentProcessState || !currentProcessState.processId) {
        toast({ title: "Erro de Processo", description: "ID do processo não encontrado. Não é possível prosseguir.", variant: "destructive" });
        return;
    }
    const stateToSave = {...currentProcessState, currentStep: "/processo/foto-contrato-assinado" };
    await saveProcessState(stateToSave);
    setCurrentProcessState(stateToSave); 

    toast({
      title: "Impressão (Simulada) Concluída!",
      description: "Prossiga para anexar a foto do contrato assinado.",
      className: "bg-green-600 text-primary-foreground border-green-700",
    });
    router.push('/processo/foto-contrato-assinado');
  };

  const renderDocumentImage = (url: string | null | undefined, label: string) => {
    if (!url) return null;
    const isPdf = url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf') || url.includes('application%2Fpdf');

    if (isPdf) {
      return (
        <div className="mb-4 p-2 border border-dashed border-border text-center text-sm text-muted-foreground document-to-print">
          <FilePenLine className="h-8 w-8 mx-auto mb-1 text-primary" />
          {label} (PDF)
          <p className="text-xs print-hidden">Conteúdo de PDFs não é exibido na pré-visualização de impressão da página, mas será incluído na impressão se o navegador suportar.</p>
        </div>
      );
    }
    return (
      <div className="mb-6 document-to-print">
        <p className="font-semibold text-center text-muted-foreground mb-2">{label}</p>
        <Image
          src={url}
          alt={label}
          width={800} 
          height={1120} 
          objectFit="contain"
          className="w-full h-auto max-w-full block rounded-md border border-border/30"
        />
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

  if (!currentProcessState || !currentProcessState.processId) {
     console.error(
        '[PrintContractPage] Critical Error: Process state or processId is missing after loading. currentProcessState:', 
        currentProcessState ? JSON.parse(JSON.stringify(currentProcessState)) : String(currentProcessState)
    );
    return (
      <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-card-premium rounded-2xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="items-center p-8">
            <CardTitle className="text-2xl text-destructive font-headline">Erro Crítico de Sessão</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8">
            <p className="text-muted-foreground mb-6">Não foi possível encontrar os dados do processo atual (ID ausente ou estado nulo após carregamento). Por favor, inicie o processo novamente.</p>
            <Button onClick={() => router.push('/')} variant="outline" className="border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
              <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para o Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const extractedDataMissing = !currentProcessState.extractedData || Object.keys(currentProcessState.extractedData).length === 0 || !Object.values(currentProcessState.extractedData).some(v => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ''));
  const internalTeamMemberInfoMissing = 
    !currentProcessState.internalTeamMemberInfo || 
    !currentProcessState.internalTeamMemberInfo.nome || 
    !currentProcessState.internalTeamMemberInfo.cpf || 
    !currentProcessState.internalTeamMemberInfo.email || 
    !currentProcessState.internalTeamMemberInfo.telefone ||
    !currentProcessState.internalTeamMemberInfo.cargo; 
  const buyerInfoMissing = !currentProcessState.buyerInfo || !currentProcessState.buyerInfo.nome || !currentProcessState.buyerInfo.cpf || !currentProcessState.buyerInfo.email || !currentProcessState.buyerInfo.telefone;
  const companyInfoMissingForPJ = currentProcessState.buyerType === 'pj' && (!currentProcessState.companyInfo || !currentProcessState.companyInfo.razaoSocial || !currentProcessState.companyInfo.cnpj);

  if (extractedDataMissing || internalTeamMemberInfoMissing || buyerInfoMissing || companyInfoMissingForPJ) {
    let missingPartsDescriptionList = [];
    if (extractedDataMissing) missingPartsDescriptionList.push("Dados do Contrato");
    if (internalTeamMemberInfoMissing) missingPartsDescriptionList.push("Informações do Responsável Interno (Nome, CPF, Email, Telefone, Cargo)");
    if (buyerInfoMissing) missingPartsDescriptionList.push("Informações do Comprador/Representante (Nome, CPF, Email, Telefone)");
    if (companyInfoMissingForPJ) missingPartsDescriptionList.push("Informações da Empresa (PJ - Razão Social, CNPJ)");
    
    const descriptionText = `Dados essenciais para impressão não encontrados: ${missingPartsDescriptionList.join('; ')}. Verifique as etapas anteriores ou se o processo foi reiniciado.`;

    console.error(
        '[PrintContractPage] Essential data for printing missing. \nDescription:', descriptionText,
        '\nProcess ID:', currentProcessState.processId,
        '\nFlags:', JSON.stringify({ extractedDataMissing, internalTeamMemberInfoMissing, buyerInfoMissing, companyInfoMissingForPJ }, null, 2),
        '\nRelevant State Parts (stringified for clarity):', JSON.stringify({
            processId: currentProcessState.processId,
            buyerType: currentProcessState.buyerType,
            currentStep: currentProcessState.currentStep,
            extractedData: currentProcessState.extractedData,
            internalTeamMemberInfo: currentProcessState.internalTeamMemberInfo,
            buyerInfo: currentProcessState.buyerInfo,
            companyInfo: currentProcessState.companyInfo,
            selectedPlayer: currentProcessState.selectedPlayer,
            contractSourceType: currentProcessState.contractSourceType
        }, null, 2)
    );
    
    return (
       <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg shadow-card-premium rounded-2xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="items-center p-8">
            <CardTitle className="text-2xl text-destructive font-headline text-center">Erro ao Carregar Dados para Impressão</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8">
            <p className="text-muted-foreground mb-2">Os seguintes dados essenciais não foram encontrados para gerar o contrato:</p>
            <ul className="list-disc list-inside text-left text-muted-foreground mb-4 text-sm inline-block">
                {extractedDataMissing && <li>Dados do Contrato</li>}
                {internalTeamMemberInfoMissing && <li>Informações do Responsável Interno (incluindo Cargo)</li>}
                {buyerInfoMissing && <li>Informações do Comprador/Representante</li>}
                {companyInfoMissingForPJ && <li>Informações da Empresa (PJ)</li>}
            </ul>
            <p className="text-muted-foreground mb-6">Por favor, volte e verifique se todas as informações foram preenchidas e salvas corretamente nas etapas anteriores. Se o problema persistir, tente reiniciar o processo.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => router.push('/processo/revisao-envio')} variant="outline" className="border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Voltar para Revisão
                </Button>
                <Button onClick={() => router.push('/')} variant="outline" className="border-destructive/80 text-destructive hover:bg-destructive/10 text-base py-3 rounded-lg">
                     Voltar para o Início
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { extractedData, buyerInfo, internalTeamMemberInfo, companyInfo, buyerType, selectedPlayer, processId } = currentProcessState; 

  const nomesDasPartesArray = Array.isArray(extractedData?.nomesDasPartes)
    ? extractedData.nomesDasPartes
    : (extractedData?.nomesDasPartes && typeof extractedData.nomesDasPartes === 'object' ? Object.values(extractedData.nomesDasPartes) : []);

  const documentosDasPartesArray = Array.isArray(extractedData?.documentosDasPartes)
    ? extractedData.documentosDasPartes
    : (extractedData?.documentosDasPartes && typeof extractedData.documentosDasPartes === 'object' ? Object.values(extractedData.documentosDasPartes) : []);


  const vendedorNome = selectedPlayer ||
                       (nomesDasPartesArray.find(nome => String(nome).toUpperCase().includes("VENDEDOR"))) ||
                       "PABLO MARÇAL (ou empresa representante oficial)";

  const vendedorDocumento = documentosDasPartesArray.find((doc, index) => {
    const nomeParteCorrigido = Array.isArray(nomesDasPartesArray) && nomesDasPartesArray[index] ? String(nomesDasPartesArray[index]).toUpperCase() : "";
    return nomeParteCorrigido.includes("VENDEDOR") || (selectedPlayer && nomeParteCorrigido.includes(selectedPlayer.toUpperCase()));
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
      <div className="printable-page-wrapper">
        <div className="w-full max-w-3xl space-y-8 mx-auto my-0 print:my-0 print:mx-auto print:space-y-0">
          <div className="print-hidden text-center mb-6">
              <h1 className="text-3xl font-headline text-primary text-glow-gold">Pré-visualização do Contrato e Documentos</h1>
              <p className="text-muted-foreground mt-2">Este conjunto está pronto para impressão. Após imprimir e assinar, anexe a foto do contrato assinado.</p>
          </div>
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/95 printable-area">
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
            <PrintFooter processId={processId} />
          </Card>

          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/95 printable-area">
            <CardHeader className="border-b border-border/50 pb-4 p-6">
              <CardTitle className="text-xl sm:text-2xl font-headline text-primary text-center uppercase tracking-wider">
                <ImageIcon className="inline-block mr-2 h-6 w-6" /> Anexos - Documentos do Comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-4">
              {buyerType === 'pf' && (
                <>
                  {renderDocumentImage(currentProcessState.rgAntigoFrente?.previewUrl, 'RG (Antigo) - Frente')}
                  {renderDocumentImage(currentProcessState.rgAntigoVerso?.previewUrl, 'RG (Antigo) - Verso')}
                  {renderDocumentImage(currentProcessState.cnhAntigaFrente?.previewUrl, 'CNH (Antiga) - Frente')}
                  {renderDocumentImage(currentProcessState.cnhAntigaVerso?.previewUrl, 'CNH (Antiga) - Verso')}
                </>
              )}
              {buyerType === 'pj' && (
                <>
                  {renderDocumentImage(currentProcessState.cartaoCnpjFile?.previewUrl, 'Cartão CNPJ')}
                  {renderDocumentImage(currentProcessState.docSocioFrente?.previewUrl, 'Documento do Sócio/Representante - Frente')}
                  {renderDocumentImage(currentProcessState.docSocioVerso?.previewUrl, 'Documento do Sócio/Representante - Verso')}
                </>
              )}
              {renderDocumentImage(currentProcessState.comprovanteEndereco?.previewUrl, buyerType === 'pf' ? 'Comprovante de Endereço Pessoal' : 'Comprovante de Endereço da Empresa')}
            </CardContent>
             <PrintFooter processId={processId} />
          </Card>

          <div className="mt-8 w-full max-w-3xl flex flex-col sm:flex-row gap-4 print-hidden">
            <Button 
                onClick={handleInitiatePrint} 
                disabled={isPrinting}
                className="flex-1 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-600/90 hover:to-blue-800/90 text-lg py-4 rounded-lg text-white shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparando Impressão...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-5 w-5" /> Imprimir Tudo
                </>
              )}
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

    

    