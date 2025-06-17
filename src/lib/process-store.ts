
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { toast } from '@/hooks/use-toast';

export interface BuyerInfo {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
}

export type BuyerType = 'pf' | 'pj'; // Pessoa Física ou Pessoa Jurídica

export interface DocumentFile {
  name?: string;
  previewUrl?: string | null;
  analysisResult?: ExtractBuyerDocumentDataOutput | { error: string } | null;
}

export interface CompanyInfo {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
}

export type PfDocumentType = 'rgAntigo' | 'rgQrcode' | 'cnhAntiga' | 'cnhQrcode';

// StoredProcessState holds data that is JSON serializable for localStorage
export interface StoredProcessState {
  currentStep: string;
  contractSourceType: 'new' | 'existing';
  selectedPlayer: string | null;
  selectedContractTemplateName: string | null;
  
  buyerType: BuyerType;
  buyerInfo: BuyerInfo; // For PF or Representative of PJ
  companyInfo: CompanyInfo | null; // For PJ
  internalTeamMemberInfo: BuyerInfo;

  // Pessoa Física specific documents
  rgAntigoFrente: DocumentFile | null;
  rgAntigoVerso: DocumentFile | null;
  rgQrcodeDoc: DocumentFile | null; // Simplified from frente/verso
  cnhAntigaFrente: DocumentFile | null;
  cnhAntigaVerso: DocumentFile | null;
  cnhQrcodeDoc: DocumentFile | null; // Simplified from frente/verso
  
  // Pessoa Jurídica specific documents
  cartaoCnpjFile: DocumentFile | null;
  docSocioFrente: DocumentFile | null;
  docSocioVerso: DocumentFile | null;

  // Common documents
  comprovanteEndereco: DocumentFile | null;

  contractPhotoPreview: string | null;
  contractPhotoName?: string;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;
  
  signedContractPhotoPreview: string | null;
  signedContractPhotoName?: string;
}

export const initialStoredProcessState: StoredProcessState = {
  currentStep: '/processo/dados-iniciais',
  contractSourceType: 'new',
  selectedPlayer: null,
  selectedContractTemplateName: null,
  
  buyerType: 'pf',
  buyerInfo: { nome: '', cpf: '', telefone: '', email: '' },
  companyInfo: null,
  internalTeamMemberInfo: { nome: '', cpf: '', telefone: '', email: '' },

  rgAntigoFrente: null,
  rgAntigoVerso: null,
  rgQrcodeDoc: null,
  cnhAntigaFrente: null,
  cnhAntigaVerso: null,
  cnhQrcodeDoc: null,

  cartaoCnpjFile: null,
  docSocioFrente: null,
  docSocioVerso: null,
  comprovanteEndereco: null,

  contractPhotoPreview: null,
  contractPhotoName: undefined,
  photoVerificationResult: null,
  photoVerified: false,
  extractedData: null,
  signedContractPhotoPreview: null,
  signedContractPhotoName: undefined,
};

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v8'; // Incremented version
const PRINT_DATA_KEY = 'contractPrintData_v5'; // Incremented version


export function saveProcessState(state: StoredProcessState) {
  try {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving process state to localStorage:", error);
    toast({
      title: "Erro ao Salvar Progresso",
      description: "Não foi possível salvar os dados atuais. Isso pode ocorrer se o armazenamento estiver cheio.",
      variant: "destructive",
      duration: 10000, 
    });
  }
}

export function loadProcessState(): StoredProcessState {
  try {
    const storedState = localStorage.getItem(PROCESS_STATE_KEY);
    if (storedState && storedState !== "undefined" && storedState !== "null") { 
      let parsedState = JSON.parse(storedState) as StoredProcessState;
      
      parsedState = { ...initialStoredProcessState, ...parsedState }; 
      
      if (!parsedState.buyerInfo) {
        parsedState.buyerInfo = { ...initialStoredProcessState.buyerInfo };
      }
      if (parsedState.buyerType === 'pj' && !parsedState.companyInfo) {
         parsedState.companyInfo = { razaoSocial: '', nomeFantasia: '', cnpj: '' };
      } else if (parsedState.buyerType === 'pf') {
        parsedState.companyInfo = null; 
      }
      if (!parsedState.internalTeamMemberInfo) {
        parsedState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo };
      }
      
      // Ensure new single QRCode doc fields are initialized if loading older state
      if (parsedState.rgQrcodeDoc === undefined) parsedState.rgQrcodeDoc = null;
      if (parsedState.cnhQrcodeDoc === undefined) parsedState.cnhQrcodeDoc = null;

      // Clean up old multi-file QRCode fields if they exist from a previous version
      const legacyRgQrcodeFrente = (parsedState as any).rgQrcodeFrente;
      if (legacyRgQrcodeFrente !== undefined) delete (parsedState as any).rgQrcodeFrente;
      const legacyRgQrcodeVerso = (parsedState as any).rgQrcodeVerso;
      if (legacyRgQrcodeVerso !== undefined) delete (parsedState as any).rgQrcodeVerso;
      const legacyCnhQrcodeFrente = (parsedState as any).cnhQrcodeFrente;
      if (legacyCnhQrcodeFrente !== undefined) delete (parsedState as any).cnhQrcodeFrente;
      const legacyCnhQrcodeVerso = (parsedState as any).cnhQrcodeVerso;
      if (legacyCnhQrcodeVerso !== undefined) delete (parsedState as any).cnhQrcodeVerso;
      
      return parsedState;
    }
  } catch (error) {
    console.error("Error loading process state from localStorage:", error);
    localStorage.removeItem(PROCESS_STATE_KEY); 
  }
  return JSON.parse(JSON.stringify(initialStoredProcessState)); 
}

export function clearProcessState() {
  try {
    localStorage.removeItem(PROCESS_STATE_KEY);
    localStorage.removeItem(PRINT_DATA_KEY);
  } catch (error) {
    console.error("Error clearing process state from localStorage:", error);
  }
}

export interface PrintData {
  extractedData: ExtractContractDataOutput | null;
  buyerInfo: BuyerInfo | null; 
  companyInfo: CompanyInfo | null;
  buyerType: BuyerType;
  selectedPlayer: string | null;
  internalTeamMemberInfo: BuyerInfo | null;
  // PF Documents for printing
  rgAntigoFrenteUrl?: string | null;
  rgAntigoVersoUrl?: string | null;
  rgQrcodeDocUrl?: string | null; // Simplified
  cnhAntigaFrenteUrl?: string | null;
  cnhAntigaVersoUrl?: string | null;
  cnhQrcodeDocUrl?: string | null; // Simplified
  // PJ Documents
  cartaoCnpjFileUrl?: string | null;
  docSocioFrenteUrl?: string | null;
  docSocioVersoUrl?: string | null;
  // Common
  comprovanteEnderecoUrl?: string | null;
  signedContractPhotoUrl?: string | null;
}


export function savePrintData(data: PrintData) {
  try {
    localStorage.setItem(PRINT_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving print data to localStorage:", error);
     toast({
      title: "Erro ao Salvar Dados para Impressão",
      description: "Não foi possível salvar os dados para impressão.",
      variant: "destructive",
    });
  }
}

export function loadPrintData(): PrintData | null {
  try {
    const dataString = localStorage.getItem(PRINT_DATA_KEY);
    if (dataString && dataString !== "undefined" && dataString !== "null") {
      const parsedData = JSON.parse(dataString) as PrintData;
       parsedData.buyerType = parsedData.buyerType || 'pf';
       parsedData.companyInfo = parsedData.companyInfo || null;
       
       // Ensure new QRCode doc URL fields are initialized
       if (parsedData.rgQrcodeDocUrl === undefined) parsedData.rgQrcodeDocUrl = null;
       if (parsedData.cnhQrcodeDocUrl === undefined) parsedData.cnhQrcodeDocUrl = null;

       // Clean up old multi-file QRCode URL fields
       if ((parsedData as any).rgQrcodeFrenteUrl !== undefined) delete (parsedData as any).rgQrcodeFrenteUrl;
       if ((parsedData as any).rgQrcodeVersoUrl !== undefined) delete (parsedData as any).rgQrcodeVersoUrl;
       if ((parsedData as any).cnhQrcodeFrenteUrl !== undefined) delete (parsedData as any).cnhQrcodeFrenteUrl;
       if ((parsedData as any).cnhQrcodeVersoUrl !== undefined) delete (parsedData as any).cnhQrcodeVersoUrl;

      return parsedData;
    }
  } catch (error)
{
    console.error("Error loading print data from localStorage:", error);
    localStorage.removeItem(PRINT_DATA_KEY); 
  }
  return null;
}

