
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

export type PfDocumentType = 'rgAntigo' | 'cnhAntiga';

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

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v10'; // Incremented version
const PRINT_DATA_KEY = 'contractPrintData_v7'; // Incremented version


export function saveProcessState(state: StoredProcessState) {
  try {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(state));
  } catch (error: any) {
    console.error("Error saving process state to localStorage:", error);
    let description = "Não foi possível salvar os dados atuais. Isso pode ocorrer se o armazenamento estiver cheio.";
    if (error.name === 'QuotaExceededError') {
      description = "O armazenamento local está cheio. Algumas imagens grandes podem não ter sido salvas. Tente limpar o cache do navegador ou prossiga com cuidado.";
    }
    toast({
      title: "Erro ao Salvar Progresso Localmente",
      description: description,
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
       
      return parsedData;
    }
  } catch (error)
{
    console.error("Error loading print data from localStorage:", error);
    localStorage.removeItem(PRINT_DATA_KEY); 
  }
  return null;
}
