
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

export type PfDocumentType = 'rgAntigo' | 'cnhAntiga'; // Simplificado: removido rgQrcode e cnhQrcode

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

  // Pessoa Física specific documents - Simplificado
  rgAntigoFrente: DocumentFile | null;
  rgAntigoVerso: DocumentFile | null;
  cnhAntigaFrente: DocumentFile | null;
  cnhAntigaVerso: DocumentFile | null;
  
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
  cnhAntigaFrente: null,
  cnhAntigaVerso: null,

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

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v9'; // Incremented version
const PRINT_DATA_KEY = 'contractPrintData_v6'; // Incremented version


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
      
      // Clean up fields that were removed
      if ((parsedState as any).rgQrcodeDoc !== undefined) delete (parsedState as any).rgQrcodeDoc;
      if ((parsedState as any).cnhQrcodeDoc !== undefined) delete (parsedState as any).cnhQrcodeDoc;
      
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
  // PF Documents for printing - Simplificado
  rgAntigoFrenteUrl?: string | null;
  rgAntigoVersoUrl?: string | null;
  cnhAntigaFrenteUrl?: string | null;
  cnhAntigaVersoUrl?: string | null;
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
       
       // Clean up old QRCode URL fields if they exist from a previous version
       if ((parsedData as any).rgQrcodeDocUrl !== undefined) delete (parsedData as any).rgQrcodeDocUrl;
       if ((parsedData as any).cnhQrcodeDocUrl !== undefined) delete (parsedData as any).cnhQrcodeDocUrl;

      return parsedData;
    }
  } catch (error)
{
    console.error("Error loading print data from localStorage:", error);
    localStorage.removeItem(PRINT_DATA_KEY); 
  }
  return null;
}
