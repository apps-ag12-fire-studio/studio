
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";

export interface BuyerInfo {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
}

// StoredProcessState holds data that is JSON serializable for localStorage
export interface StoredProcessState {
  currentStep: string;
  contractSourceType: 'new' | 'existing';
  selectedPlayer: string | null;
  selectedContractTemplateName: string | null;
  buyerInfo: BuyerInfo;
  internalTeamMemberInfo: BuyerInfo;
  contractPhotoPreview: string | null;
  contractPhotoName?: string;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;
  attachedDocumentNames: string[];
}

export const initialStoredProcessState: StoredProcessState = {
  currentStep: '/processo/dados-iniciais',
  contractSourceType: 'new',
  selectedPlayer: null,
  selectedContractTemplateName: null,
  buyerInfo: { nome: '', cpf: '', telefone: '', email: '' },
  internalTeamMemberInfo: { nome: '', cpf: '', telefone: '', email: '' },
  contractPhotoPreview: null,
  contractPhotoName: undefined,
  photoVerificationResult: null,
  photoVerified: false,
  extractedData: null,
  attachedDocumentNames: [],
};

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v3';
const PRINT_DATA_KEY = 'contractPrintData_v2';


export function saveProcessState(state: StoredProcessState) {
  try {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving process state to localStorage:", error);
  }
}

export function loadProcessState(): StoredProcessState {
  try {
    const storedState = localStorage.getItem(PROCESS_STATE_KEY);
    if (storedState && storedState !== "undefined") { 
      const parsedState = JSON.parse(storedState) as StoredProcessState;
      
      if (!parsedState.internalTeamMemberInfo) {
        parsedState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo };
      }
      if (!parsedState.buyerInfo) {
        parsedState.buyerInfo = { ...initialStoredProcessState.buyerInfo };
      }
      if (parsedState.selectedPlayer === undefined) { 
        parsedState.selectedPlayer = null;
      }
      if (parsedState.selectedContractTemplateName === undefined) {
        parsedState.selectedContractTemplateName = null;
      }
      return parsedState;
    }
  } catch (error) {
    console.error("Error loading process state from localStorage:", error);
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
  responsavel: BuyerInfo | null; 
  selectedPlayer: string | null;
  internalTeamMemberInfo: BuyerInfo | null;
}

export function savePrintData(data: PrintData) {
  try {
    localStorage.setItem(PRINT_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving print data to localStorage:", error);
  }
}

export function loadPrintData(): PrintData | null {
  try {
    const dataString = localStorage.getItem(PRINT_DATA_KEY);
    if (dataString && dataString !== "undefined") {
      const parsedData = JSON.parse(dataString) as PrintData;
      if (parsedData.selectedPlayer === undefined) {
        parsedData.selectedPlayer = null;
      }
      if (parsedData.internalTeamMemberInfo === undefined) {
        parsedData.internalTeamMemberInfo = null;
      }
      return parsedData;
    }
  } catch (error) {
    console.error("Error loading print data from localStorage:", error);
  }
  return null;
}

