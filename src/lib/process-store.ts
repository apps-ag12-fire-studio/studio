
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
  buyerInfo: BuyerInfo;
  internalTeamMemberInfo: BuyerInfo; // Added for internal team member
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
  buyerInfo: { nome: '', cpf: '', telefone: '', email: '' },
  internalTeamMemberInfo: { nome: '', cpf: '', telefone: '', email: '' }, // Initialized
  contractPhotoPreview: null,
  contractPhotoName: undefined,
  photoVerificationResult: null,
  photoVerified: false,
  extractedData: null,
  attachedDocumentNames: [],
};

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v2';
const PRINT_DATA_KEY = 'contractPrintData';


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
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      // Ensure new fields have default values if loading older state
      if (!parsedState.internalTeamMemberInfo) {
        parsedState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo };
      }
      if (!parsedState.buyerInfo) {
        parsedState.buyerInfo = { ...initialStoredProcessState.buyerInfo };
      }
      return parsedState;
    }
  } catch (error) {
    console.error("Error loading process state from localStorage:", error);
  }
  return JSON.parse(JSON.stringify(initialStoredProcessState)); // Return a deep copy
}

export function clearProcessState() {
  try {
    localStorage.removeItem(PROCESS_STATE_KEY);
    localStorage.removeItem(PRINT_DATA_KEY);
  } catch (error) {
    console.error("Error clearing process state from localStorage:", error);
  }
}

// Helper for print page data
export interface PrintData {
  extractedData: ExtractContractDataOutput | null;
  responsavel: BuyerInfo | null; // This 'responsavel' is the actual buyer for the contract
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
    if (dataString) {
      return JSON.parse(dataString) as PrintData;
    }
  } catch (error) {
    console.error("Error loading print data from localStorage:", error);
  }
  return null;
}
