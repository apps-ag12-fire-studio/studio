
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Printer, Loader2, FilePenLine, Image as ImageIcon, QrCode, Edit3, CheckCircle2, MapPin } from 'lucide-react';
import { StoredProcessState, loadProcessState, saveProcessState, initialStoredProcessState, BuyerInfo, CompanyInfo } from "@/lib/process-store";
import { EditInfoDialog, FieldConfig } from "@/components/processo/edit-info-dialog";

// Component for the custom print footer
const PrintFooter = ({ processId }: { processId: string | null }) => {
  if (!processId) return null;

  const verificationBaseUrl = "https://contratofacil.app/verify"; 
  const verificationUrl = `${verificationBaseUrl}?id=${processId}`;
  // QR code size will be controlled by CSS for print, but for the API a reasonable size is good.
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(verificationUrl)}`;

  return (
    <div className="custom-print-footer print-only">
      <div className="verification-text">
        <p>To verify the authenticity of this document, visit:</p>
        <p className="font-semibold">{verificationUrl}</p>
      </div>
      <Image 
        src={qrCodeUrl} 
        alt={`QR Code for verification of Process ID ${processId}`} 
        width={80} 
        height={80}
        className="qr-code-image"
        unoptimized 
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
  const [currentBuyerInfo, setCurrentBuyerInfo] = useState<BuyerInfo>(initialStoredProcessState.buyerInfo);
  const [isEditCompradorOpen, setIsEditCompradorOpen] = useState(false);


  useEffect(() => {
    const fetchDataAndUpdateSignature = async () => {
      setIsLoading(true);
      let loadedData = await loadProcessState(); // Step 1: Load current state
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      let finalSigningString = ""; // This will be the string set in the contract
      let locationDisplayForContract = ""; // What actually goes into contract's location part
      let geoStatusMessageForToast = "Geolocation was not requested or failed. City/State are based on the contract template or require manual input."; // Default toast message part

      // Step 2: Define how to construct the signing string based on contract's current location and geo attempt
      const updateSigningStringAndDetermineDisplay = (
        currentContractLocationString: string | undefined, 
        geoAttemptSuccessful: boolean, 
        coordinates?: GeolocationCoordinates
      ) => {
        let determinedLocationPart = currentContractLocationString ? currentContractLocationString.split(',')[0].trim() : "";
        const isGenericLocationInContract = !determinedLocationPart || /\[local.*?\]/i.test(determinedLocationPart) || determinedLocationPart.trim() === "";

        if (isGenericLocationInContract) {
          if (geoAttemptSuccessful && coordinates) {
            locationDisplayForContract = `Location (GPS Detected)`; // For contract
          } else {
            locationDisplayForContract = "[Place of Signing]"; // Fallback for contract
          }
        } else { // Specific location already in contract
          locationDisplayForContract = determinedLocationPart;
        }
        finalSigningString = `${locationDisplayForContract}, ${today}`;
      };
      
      // Step 3: Define what to do after geolocation attempt (success or failure)
      const processLoadedDataAfterGeoAttempt = async (
          geoSuccess: boolean, 
          coordinates?: GeolocationCoordinates, 
          customGeoErrorMessage?: string
        ) => {
        
        if (geoSuccess && coordinates) {
            geoStatusMessageForToast = `GPS coordinates obtained (${coordinates.latitude.toFixed(2)}, ${coordinates.longitude.toFixed(2)}). Exact City/State still require manual confirmation or a reverse geocoding service (not configured).`;
        } else if (customGeoErrorMessage) {
            geoStatusMessageForToast = customGeoErrorMessage;
        } // else default geoStatusMessageForToast remains

        updateSigningStringAndDetermineDisplay(loadedData?.extractedData?.localEDataAssinatura, geoSuccess, coordinates);

        let stateWasModified = false;
        if (loadedData && loadedData.extractedData && finalSigningString && finalSigningString !== loadedData.extractedData.localEDataAssinatura) {
            loadedData = {
                ...loadedData,
                extractedData: {
                    ...(loadedData.extractedData!),
                    localEDataAssinatura: finalSigningString,
                },
            };
            stateWasModified = true;
        }
        
        if (loadedData) {
            console.log('[PrintContractPage] Loaded data by loadProcessState() before setting local states:', loadedData ? JSON.parse(JSON.stringify(loadedData)) : String(loadedData));
            setCurrentBuyerInfo(loadedData.buyerInfo || initialStoredProcessState.buyerInfo);
        }
        setCurrentProcessState(loadedData); 
      
        if (stateWasModified && loadedData?.processId) { // Save only if modified and processId exists
          await saveProcessState(loadedData);
        }

        if (typeof window !== 'undefined' && !localStorage.getItem('geolocationToastShownForPrintContractPage_v2')) {
            toast({
                title: "Location and Date of Signature Updated",
                description: `Date: ${today}. Location in contract: "${locationDisplayForContract}". ${geoStatusMessageForToast}`,
                duration: 12000, // Increased duration for better readability
            });
            localStorage.setItem('geolocationToastShownForPrintContractPage_v2', 'true');
        }
        setIsLoading(false);
      };

      // Step 4: Attempt geolocation
      if (navigator.geolocation) {
        console.log("[Geolocation] Attempting to get current position...");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log("[Geolocation] Success:", position.coords);
            processLoadedDataAfterGeoAttempt(true, position.coords);
          },
          (error) => {
            console.warn("[Geolocation] Error Code:", error.code, "Message:", error.message);
            let userFriendlyError = `Failed to get geolocation (Error ${error.code}). City/State are based on the template or require manual input.`;
            if (error.code === error.PERMISSION_DENIED) {
              userFriendlyError = "Geolocation permission denied. City/State are based on the template or require manual input.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              userFriendlyError = "Location information unavailable. City/State are based on the template or require manual input.";
            } else if (error.code === error.TIMEOUT) {
              userFriendlyError = "Timed out getting geolocation. City/State are based on the template or require manual input.";
            }
            processLoadedDataAfterGeoAttempt(false, undefined, userFriendlyError);
          },
          { timeout: 10000, enableHighAccuracy: false } 
        );
      } else {
        console.warn("[Geolocation] Not supported by this browser.");
        processLoadedDataAfterGeoAttempt(false, undefined, "Geolocation is not supported in this browser. City/State are based on the template or require manual input.");
      }
    };

    fetchDataAndUpdateSignature();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSaveComprador = async (updatedData: Record<string, string>) => {
    if (!currentProcessState) return;
    const newBuyerInfo = {
        ...currentBuyerInfo, 
        ...updatedData,
    } as BuyerInfo;
    setCurrentBuyerInfo(newBuyerInfo);

    const updatedFullProcessState = {
        ...currentProcessState,
        buyerInfo: newBuyerInfo,
    };
    setCurrentProcessState(updatedFullProcessState); 
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


  const handleInitiatePrint = () => {
    setIsPrinting(true);
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch (error) {
        console.error("Error calling window.print():", error);
        toast({
            title: "Error Printing",
            description: "Could not open the print dialog.",
            variant: "destructive"
        });
        setIsPrinting(false); 
      }
    });
  };

  const handleProceedToSignedUpload = async () => {
    if (!currentProcessState || !currentProcessState.processId) {
        toast({ title: "Process Error", description: "Process ID not found. Cannot proceed.", variant: "destructive" });
        return;
    }
    const stateToSave = {...currentProcessState, currentStep: "/processo/foto-contrato-assinado" };
    await saveProcessState(stateToSave);
    setCurrentProcessState(stateToSave); 

    toast({
      title: "Print (Simulated) Complete!",
      description: "Proceed to attach the photo of the signed contract.",
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
          <p className="text-xs print-hidden">PDF content is not displayed in the page print preview, but will be included in the print if the browser supports it.</p>
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
          className="w-full h-auto max-w-full block rounded-md border border-border/30 object-contain" 
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
            <p className="text-lg text-muted-foreground">Loading data and geolocation...</p>
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
            <CardTitle className="text-2xl text-destructive font-headline">Critical Session Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8">
            <p className="text-muted-foreground mb-6">Could not find the current process data (ID missing or null state after loading). Please start the process again.</p>
            <Button onClick={() => router.push('/')} variant="outline" className="border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
              <ArrowLeft className="mr-2 h-5 w-5" /> Back to Home
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
  const buyerInfoMissing = !currentBuyerInfo || !currentBuyerInfo.nome || !currentBuyerInfo.cpf || !currentBuyerInfo.email || !currentBuyerInfo.telefone || !currentBuyerInfo.logradouro;
  const companyInfoMissingForPJ = currentProcessState.buyerType === 'pj' && (!currentProcessState.companyInfo || !currentProcessState.companyInfo.razaoSocial || !currentProcessState.companyInfo.cnpj);

  if (extractedDataMissing || internalTeamMemberInfoMissing || buyerInfoMissing || companyInfoMissingForPJ) {
    let missingPartsDescriptionList = [];
    if (extractedDataMissing) missingPartsDescriptionList.push("Contract Data");
    if (internalTeamMemberInfoMissing) missingPartsDescriptionList.push("Internal Responsible Information (Name, ID, Email, Phone, Role)");
    if (buyerInfoMissing) missingPartsDescriptionList.push("Buyer/Representative Information (Name, ID, Email, Phone, Full Address)");
    if (companyInfoMissingForPJ) missingPartsDescriptionList.push("Company Information (Legal Name, Tax ID)");
    
    const descriptionText = `Essential data for printing not found: ${missingPartsDescriptionList.join('; ')}. Check previous steps or if the process was reset.`;

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
            buyerInfo: currentBuyerInfo,
            companyInfo: currentProcessState.companyInfo,
            selectedPlayer: currentProcessState.selectedPlayer,
            contractSourceType: currentProcessState.contractSourceType
        }, null, 2)
    );
    
    return (
       <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg shadow-card-premium rounded-2xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="items-center p-8">
            <CardTitle className="text-2xl text-destructive font-headline text-center">Error Loading Data for Printing</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8">
            <p className="text-muted-foreground mb-2">The following essential data was not found to generate the contract:</p>
            <ul className="list-disc list-inside text-left text-muted-foreground mb-4 text-sm inline-block">
                {extractedDataMissing && <li>Contract Data</li>}
                {internalTeamMemberInfoMissing && <li>Internal Responsible Information (including Role)</li>}
                {buyerInfoMissing && <li>Buyer/Representative Information (including Address)</li>}
                {companyInfoMissingForPJ && <li>Company Information</li>}
            </ul>
            <p className="text-muted-foreground mb-6">Please go back and check if all information was filled out and saved correctly in the previous steps. If the problem persists, try restarting the process.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => router.push('/processo/revisao-envio')} variant="outline" className="border-primary/80 text-primary hover:bg-primary/10 text-base py-3 rounded-lg">
                    <ArrowLeft className="mr-2 h-5 w-5" /> Back to Review
                </Button>
                <Button onClick={() => router.push('/')} variant="outline" className="border-destructive/80 text-destructive hover:bg-destructive/10 text-base py-3 rounded-lg">
                     Back to Home
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { extractedData, companyInfo, buyerType, selectedPlayer, processId, internalTeamMemberInfo } = currentProcessState; 

  const nomesDasPartesArray = Array.isArray(extractedData?.nomesDasPartes)
    ? extractedData.nomesDasPartes
    : (extractedData?.nomesDasPartes && typeof extractedData.nomesDasPartes === 'object' ? Object.values(extractedData.nomesDasPartes) : []);

  const documentosDasPartesArray = Array.isArray(extractedData?.documentosDasPartes)
    ? extractedData.documentosDasPartes
    : (extractedData?.documentosDasPartes && typeof extractedData.documentosDasPartes === 'object' ? Object.values(extractedData.documentosDasPartes) : []);


  const vendedorNome = selectedPlayer ||
                       (nomesDasPartesArray.find(nome => String(nome).toUpperCase().includes("SELLER"))) ||
                       "PABLO MARÇAL (or official representative company)";

  const vendedorDocumento = documentosDasPartesArray.find((doc, index) => {
    const nomeParteCorrigido = Array.isArray(nomesDasPartesArray) && nomesDasPartesArray[index] ? String(nomesDasPartesArray[index]).toUpperCase() : "";
    return nomeParteCorrigido.includes("SELLER") || (selectedPlayer && nomeParteCorrigido.includes(selectedPlayer.toUpperCase()));
  }) || "[SELLING COMPANY TAX ID]";


  const renderCompradorInfo = () => {
    const displayAddress = `${currentBuyerInfo.logradouro || '[Address Line]'},\n${currentBuyerInfo.bairro || '[Neighborhood]'}\n${currentBuyerInfo.cidade || '[City]'} - ${currentBuyerInfo.estado || '[State]'},\nZIP: ${currentBuyerInfo.cep || '[ZIP]'}`;
    const fullAddressPlaceholder = '[BUYER\'S FULL ADDRESS:\nStreet, Neighborhood,\nCity - State, ZIP: ZIP]';


    if (buyerType === 'pj' && companyInfo && currentBuyerInfo) {
      return (
        <>
          <p className="font-headline text-primary/90 text-base">BUYER (COMPANY):</p>
          <p><strong>Legal Name:</strong> {companyInfo.razaoSocial || '[COMPANY LEGAL NAME]'}</p>
          <p><strong>Tax ID:</strong> {companyInfo.cnpj || '[COMPANY TAX ID]'}</p>
          <p><strong>Address (Headquarters):</strong> <span className="whitespace-pre-line">{currentBuyerInfo.logradouro ? displayAddress : fullAddressPlaceholder}</span></p>
          <p><strong>Represented by:</strong> {currentBuyerInfo.nome || '[REPRESENTATIVE NAME]'}</p>
          <p><strong>Representative's ID/SSN:</strong> {currentBuyerInfo.cpf || '[REPRESENTATIVE ID]'}</p>
          <p><strong>E-mail:</strong> {currentBuyerInfo.email || '[REPRESENTATIVE EMAIL]'}</p>
          <p><strong>Phone:</strong> {currentBuyerInfo.telefone || '[REPRESENTATIVE PHONE]'}</p>
        </>
      );
    }
    return (
      <>
        <p className="font-headline text-primary/90 text-base">BUYER (INDIVIDUAL):</p>
        <p><strong>Name:</strong> {currentBuyerInfo?.nome || '[BUYER NAME]'}</p>
        <p><strong>ID/SSN:</strong> {currentBuyerInfo?.cpf || '[BUYER ID]'}</p>
        <p><strong>E-mail:</strong> {currentBuyerInfo?.email || '[BUYER EMAIL]'}</p>
        <p><strong>Phone:</strong> {currentBuyerInfo?.telefone || '[BUYER PHONE]'}</p>
        <p><strong>Address:</strong> <span className="whitespace-pre-line">{currentBuyerInfo.logradouro ? displayAddress : fullAddressPlaceholder}</span></p>

      </>
    );
  };

  return (
    <>
      <header className="text-center py-8 print-hidden">
        <div className="mb-1 text-5xl font-headline text-primary text-glow-gold uppercase tracking-wider">
          Easy Contract
        </div>
        <p className="mb-4 text-sm text-foreground/80">
          International Platform Financial - SAAS Solution with Artificial Intelligence in training by Antônio Fogaça.
        </p>
        <p className="text-xl text-muted-foreground font-headline">
          Step 5: Printing the Contract and Documents
        </p>
      </header>
      <div className="printable-page-wrapper">
        <div className="w-full max-w-3xl space-y-8 mx-auto my-0 print:my-0 print:mx-auto print:space-y-0">
          <div className="print-hidden text-center mb-6">
              <h1 className="text-3xl font-headline text-primary text-glow-gold">Contract and Documents Preview</h1>
              <p className="text-muted-foreground mt-2">This set is ready for printing. After printing and signing, attach the photo of the signed contract.</p>
          </div>
          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/95 printable-area">
            <CardHeader className="border-b border-border/50 pb-4 p-6">
              <CardTitle className="text-xl sm:text-2xl font-headline text-primary text-center uppercase tracking-wider">
                Digital Product Purchase Agreement
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground mt-2 text-sm">
                Private Instrument of Purchase and Access {selectedPlayer ? ` - Player: ${selectedPlayer}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6 text-sm contract-text-content text-foreground/90 leading-relaxed">
              <div className="flex justify-between items-start print-hidden">
                <p>By this private instrument, on one hand:</p>
                <Button variant="ghost" size="icon" onClick={() => setIsEditCompradorOpen(true)} className="text-primary/70 hover:text-primary -mt-2 -mr-2">
                    <Edit3 className="h-5 w-5" />
                </Button>
              </div>
               <p className="print-only">By this private instrument, on one hand:</p>


              <div className="space-y-1 pl-4 border-l-2 border-primary/30 py-2">
                {renderCompradorInfo()}
              </div>

              <p>And on the other hand:</p>

              <div className="space-y-1 pl-4 border-l-2 border-primary/30 py-2">
                <p className="font-headline text-primary/90 text-base">SELLER:</p>
                <p><strong>Name:</strong> {vendedorNome}</p>
                <p><strong>Tax ID:</strong> {vendedorDocumento}</p>
                <p><strong>Address:</strong> [SELLING COMPANY FULL ADDRESS]</p>
                <p><strong>E-mail:</strong> [SELLING COMPANY EMAIL]</p>
              </div>

              <p>Hereby agree and contract as follows:</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">1. OBJECT OF THE CONTRACT</h3>
              <p className="pl-4">1.1. The object of this contract is the purchase of the digital product named: <strong>{extractedData?.objetoDoContrato || '[DIGITAL PRODUCT NAME]'}</strong>, authored by {selectedPlayer || 'Pablo Marçal'} (or representative company), made available via online access, according to the specifications detailed in the product offer.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">2. PRICE AND PAYMENT TERMS</h3>
              <p className="pl-4">2.1. The total price for the purchase of the digital product is <strong>{extractedData?.valorPrincipal || '$[TOTAL PRICE]'}</strong>.</p>
              <p className="pl-4">2.2. Payment Method: {extractedData?.condicoesDePagamento ? extractedData.condicoesDePagamento : 'As selected by the BUYER at the time of purchase.'}</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">3. ACCESS AND DELIVERY</h3>
              <p className="pl-4">3.1. The product will be delivered digitally, with access credentials and instructions sent to the email address registered by the BUYER.</p>
              <p className="pl-4">3.2. The access period to the product content is {extractedData?.prazoContrato || '[ACCESS PERIOD]'} from the date of access release.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">4. RIGHTS AND RESPONSIBILITIES</h3>
              <p className="pl-4">4.1. The BUYER agrees to use the content exclusively for personal and non-transferable purposes, and is prohibited from reproducing, copying, distributing, or commercializing the material without the express written authorization of the SELLER.</p>
              <p className="pl-4">4.2. The SELLER guarantees the functioning of the access platform and the availability of the content during the contracted period, except for interruptions due to scheduled maintenance or force majeure.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">5. REFUND POLICY</h3>
              <p className="pl-4">5.1. The BUYER may request cancellation and a full refund of the amount paid within 07 (seven) calendar days from the date of purchase, in accordance with consumer protection laws.</p>
              <hr className="my-4 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide">6. GENERAL PROVISIONS</h3>
              <p className="pl-4">6.1. The parties elect the jurisdiction of {extractedData?.foroEleito || '[CITY/STATE OF JURISDICTION]'} to settle any disputes arising from this contract.</p>
              {extractedData?.outrasObservacoesRelevantes && (
                  <p className="pl-4 mt-2"><strong>Additional Notes:</strong> {extractedData.outrasObservacoesRelevantes}</p>
              )}
              <hr className="my-6 border-border/30"/>
              <p className="text-center mt-8 text-muted-foreground">{extractedData?.localEDataAssinatura || '[Place], [Date]'}</p>
              <div className="mt-12 space-y-10">
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">
                     {buyerType === 'pj' && companyInfo ? companyInfo.razaoSocial : currentBuyerInfo?.nome || '[BUYER/COMPANY NAME]'}
                     {buyerType === 'pj' && currentBuyerInfo && <span className="block text-xs text-muted-foreground">Represented by: {currentBuyerInfo.nome}</span>}
                   </p>
                   <p className="text-xs text-muted-foreground">(BUYER{buyerType === 'pj' ? ' - COMPANY' : ''})</p>
                </div>
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">[SPACE FOR LEGAL REPRESENTATIVE'S SIGNATURE]</p>
                   <p className="text-xs text-muted-foreground">(SELLER - Legal Representative {selectedPlayer ? `- ${selectedPlayer}`: ''})</p>
                </div>
              </div>
              <hr className="my-6 border-border/30"/>
              <h3 className="font-semibold text-base text-primary/90 font-headline uppercase tracking-wide text-center">WITNESSES</h3>
              <div className="mt-8 space-y-10">
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">{internalTeamMemberInfo.nome || '[WITNESS SIGNATURE - INTERNAL RESP.]'}</p>
                   <p className="text-xs text-muted-foreground">(Witness - Internal Responsible)</p>
                   {internalTeamMemberInfo.cpf && <p className="text-xs text-muted-foreground">ID/SSN: {internalTeamMemberInfo.cpf}</p>}
                </div>
                <div className="w-full sm:w-3/4 mx-auto border-b border-foreground/70 pb-2 text-center">
                   <p className="text-sm min-h-[1.25rem]">[SPACE FOR SECOND WITNESS SIGNATURE]</p>
                   <p className="text-xs text-muted-foreground">(Witness)</p>
                   <p className="text-xs text-muted-foreground">ID/SSN: [SECOND WITNESS ID/SSN]</p>
                </div>
              </div>
            </CardContent>
            <PrintFooter processId={processId} />
          </Card>

          <Card className="shadow-card-premium rounded-2xl border-border/50 bg-card/95 printable-area">
            <CardHeader className="border-b border-border/50 pb-4 p-6">
              <CardTitle className="text-xl sm:text-2xl font-headline text-primary text-center uppercase tracking-wider">
                <ImageIcon className="inline-block mr-2 h-6 w-6" /> Attachments - Buyer's Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-4">
              {buyerType === 'pf' && (
                <>
                  {renderDocumentImage(currentProcessState.rgAntigoFrente?.previewUrl, 'ID Card (Old) - Front')}
                  {renderDocumentImage(currentProcessState.rgAntigoVerso?.previewUrl, 'ID Card (Old) - Back')}
                  {renderDocumentImage(currentProcessState.cnhAntigaFrente?.previewUrl, 'Driver\'s License (Old) - Front')}
                  {renderDocumentImage(currentProcessState.cnhAntigaVerso?.previewUrl, 'Driver\'s License (Old) - Back')}
                </>
              )}
              {buyerType === 'pj' && (
                <>
                  {renderDocumentImage(currentProcessState.cartaoCnpjFile?.previewUrl, 'Company Registration Doc')}
                  {renderDocumentImage(currentProcessState.docSocioFrente?.previewUrl, 'Partner/Representative\'s ID - Front')}
                  {renderDocumentImage(currentProcessState.docSocioVerso?.previewUrl, 'Partner/Representative\'s ID - Back')}
                </>
              )}
              {renderDocumentImage(currentProcessState.comprovanteEndereco?.previewUrl, buyerType === 'pf' ? 'Personal Proof of Address' : 'Company Proof of Address')}
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
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing Print...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-5 w-5" /> Print All
                </>
              )}
            </Button>
            <Button onClick={handleProceedToSignedUpload} className="flex-1 bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-lg py-4 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105">
               <FilePenLine className="mr-2 h-5 w-5" /> Signed Contract - Attach Photo
            </Button>
          </div>
          <div className="mt-4 w-full max-w-3xl print-hidden">
             <Button variant="outline" onClick={() => router.push('/processo/revisao-envio')} className="w-full border-primary/80 text-primary hover:bg-primary/10 text-lg py-4 rounded-lg">
              <ArrowLeft className="mr-2 h-5 w-5" /> Back to Review
            </Button>
          </div>
        </div>
      </div>
      <EditInfoDialog
        isOpen={isEditCompradorOpen}
        setIsOpen={setIsEditCompradorOpen}
        dialogTitle={processState.buyerType === 'pf' ? "Edit Buyer Data" : "Edit Legal Representative Data"}
        fieldsConfig={compradorFields}
        onSaveHandler={handleSaveComprador}
        initialData={currentBuyerInfo}
      />
    </>
  );
}
