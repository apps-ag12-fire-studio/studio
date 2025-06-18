
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase'; // Import db
import { doc, setDoc, getDoc, Timestamp, collection } from 'firebase/firestore'; // Firestore imports

export interface BuyerInfo {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
}

export type BuyerType = 'pf' | 'pj';

export interface DocumentFile {
  name?: string;
  previewUrl?: string | null;
  storagePath?: string | null;
  analysisResult?: ExtractBuyerDocumentDataOutput | { error: string } | null;
}

export interface CompanyInfo {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
}

export type PfDocumentType = 'rgAntigo' | 'cnhAntiga';

export interface StoredProcessState {
  processId: string | null; // Added processId
  currentStep: string;
  contractSourceType: 'new' | 'existing';
  selectedPlayer: string | null;
  selectedContractTemplateName: string | null;
  
  buyerType: BuyerType;
  buyerInfo: BuyerInfo; 
  companyInfo: CompanyInfo | null; 
  internalTeamMemberInfo: BuyerInfo;

  rgAntigoFrente: DocumentFile | null;
  rgAntigoVerso: DocumentFile | null;
  cnhAntigaFrente: DocumentFile | null;
  cnhAntigaVerso: DocumentFile | null;
  
  cartaoCnpjFile: DocumentFile | null;
  docSocioFrente: DocumentFile | null;
  docSocioVerso: DocumentFile | null;

  comprovanteEndereco: DocumentFile | null;

  contractPhotoPreview: string | null;
  contractPhotoName?: string;
  contractPhotoStoragePath?: string | null;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;
  
  signedContractPhotoPreview: string | null;
  signedContractPhotoName?: string;
  signedContractPhotoStoragePath?: string | null;
  lastUpdated?: Timestamp; // For Firestore
}

export const initialStoredProcessState: StoredProcessState = {
  processId: null, // Initial processId
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
  contractPhotoStoragePath: null,
  photoVerificationResult: null,
  photoVerified: false,
  extractedData: null,

  signedContractPhotoPreview: null,
  signedContractPhotoName: undefined,
  signedContractPhotoStoragePath: null,
};

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v12_firestore_sync'; 
const PRINT_DATA_KEY = 'contractPrintData_v9_firestore_sync'; 
const ACTIVE_PROCESS_ID_KEY = 'contratoFacilActiveProcessId_v1';

// Helper to get active process ID from localStorage
function getActiveProcessId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACTIVE_PROCESS_ID_KEY);
  }
  return null;
}

// Helper to set active process ID in localStorage
export function setActiveProcessId(id: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_PROCESS_ID_KEY, id);
  }
}

// Helper to clear active process ID from localStorage
function clearActiveProcessId() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_PROCESS_ID_KEY);
  }
}

// Firestore interaction
async function storeStateInFirestore(state: StoredProcessState) {
  if (!state.processId) {
    console.warn("Attempted to save state to Firestore without a processId.");
    return;
  }
  try {
    const docRef = doc(db, "inProgressContracts", state.processId);
    // Create a shallow copy for Firestore, ensuring Timestamp is correctly handled
    const stateToStore = { ...state, lastUpdated: Timestamp.now() };
    await setDoc(docRef, stateToStore, { merge: true });
    console.log("Process state saved to Firestore:", state.processId);
  } catch (error) {
    console.error("Error saving state to Firestore:", error);
    toast({
      title: "Erro ao Salvar Progresso na Nuvem",
      description: "Seu progresso local foi salvo, mas não pudemos sincronizar com a nuvem. Verifique sua conexão.",
      variant: "destructive",
      duration: 7000,
    });
  }
}

async function loadStateFromFirestore(processId: string): Promise<Partial<StoredProcessState> | null> {
  try {
    const docRef = doc(db, "inProgressContracts", processId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("Process state loaded from Firestore:", processId);
      return docSnap.data() as StoredProcessState;
    }
    console.log("No process state found in Firestore for:", processId);
    return null;
  } catch (error) {
    console.error("Error loading state from Firestore:", error);
    toast({
      title: "Erro ao Carregar Progresso da Nuvem",
      description: "Não foi possível carregar seu progresso da nuvem. Tentaremos usar dados locais, se disponíveis.",
      variant: "destructive",
      duration: 7000,
    });
    return null;
  }
}

export function saveProcessState(state: StoredProcessState) {
  try {
    const stateToSave = { ...state };
    // Ensure processId from active key is in the state being saved
    const activeId = getActiveProcessId();
    if (activeId && stateToSave.processId !== activeId) {
      console.warn("Mismatch between active processId and state's processId. Using activeId.");
      stateToSave.processId = activeId;
    }

    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(stateToSave));
    if (stateToSave.processId) {
      storeStateInFirestore(stateToSave); // Async, non-blocking
    }
  } catch (error: any) {
    console.error("Error saving process state to localStorage:", error);
    let description = "Não foi possível salvar os dados atuais localmente.";
    if (error.name === 'QuotaExceededError' || (error.message && error.message.toLowerCase().includes('quota'))) {
      description = "O armazenamento local está cheio. Algumas informações podem não ter sido salvas localmente.";
    }
    toast({
      title: "Erro ao Salvar Progresso Localmente",
      description: description,
      variant: "destructive",
      duration: 10000, 
    });
  }
}

export async function loadProcessState(): Promise<StoredProcessState> {
  let loadedState: StoredProcessState | null = null;
  const activeId = getActiveProcessId();

  if (activeId) {
    const firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      // Ensure all keys from initialStoredProcessState are present, Firestore data takes precedence
      loadedState = { ...initialStoredProcessState, ...firestoreData, processId: activeId };
    }
  }

  if (!loadedState) { // If Firestore failed or no activeId, try localStorage
    try {
      const storedStateString = localStorage.getItem(PROCESS_STATE_KEY);
      if (storedStateString && storedStateString !== "undefined" && storedStateString !== "null") { 
        const parsedLocalStorageState = JSON.parse(storedStateString) as StoredProcessState;
        loadedState = { ...initialStoredProcessState, ...parsedLocalStorageState };
        // Ensure processId is consistent if an activeId exists
        if (activeId && loadedState.processId !== activeId) {
          loadedState.processId = activeId;
        } else if (!activeId && loadedState.processId) {
          // If there's no active ID, but localStorage had one, it's stale.
          // This scenario should be less common if clearProcessState works.
          loadedState.processId = null;
        }
      }
    } catch (error) {
      console.error("Error loading process state from localStorage:", error);
      localStorage.removeItem(PROCESS_STATE_KEY); 
    }
  }
  
  // Fallback to initial state if nothing loaded, ensuring processId is at least from activeId or null
  if (!loadedState) {
    loadedState = { ...initialStoredProcessState, processId: activeId };
  }

  // Final check: if companyInfo should be null (for 'pf'), ensure it is.
  if (loadedState.buyerType === 'pf') {
    loadedState.companyInfo = null;
  } else if (loadedState.buyerType === 'pj' && !loadedState.companyInfo) {
    loadedState.companyInfo = { razaoSocial: '', nomeFantasia: '', cnpj: '' };
  }
  if (!loadedState.buyerInfo) {
    loadedState.buyerInfo = { ...initialStoredProcessState.buyerInfo };
  }
  if (!loadedState.internalTeamMemberInfo) {
    loadedState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo };
  }
  
  // Save the resolved state (whether from Firestore, localStorage, or initial) back to localStorage
  // This ensures localStorage is up-to-date with the "source of truth" for this session load.
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(loadedState));
  }

  return loadedState;
}

export function clearProcessState() {
  try {
    const activeId = getActiveProcessId();
    if (activeId) {
      // Optionally, delete or mark as 'abandoned' in Firestore
      // For now, we just clear local pointers.
      // const docRef = doc(db, "inProgressContracts", activeId);
      // deleteDoc(docRef); // Or update a status field
    }
    localStorage.removeItem(PROCESS_STATE_KEY);
    localStorage.removeItem(PRINT_DATA_KEY);
    clearActiveProcessId();
    console.log("Process state cleared.");
  } catch (error) {
    console.error("Error clearing process state from localStorage:", error);
  }
}

// --- Print Data (unchanged for now but kept for completeness) ---
export interface PrintData {
  extractedData: ExtractContractDataOutput | null;
  buyerInfo: BuyerInfo | null; 
  companyInfo: CompanyInfo | null;
  buyerType: BuyerType;
  selectedPlayer: string | null;
  internalTeamMemberInfo: BuyerInfo | null;

  rgAntigoFrenteUrl?: string | null;
  rgAntigoVersoUrl?: string | null;
  cnhAntigaFrenteUrl?: string | null;
  cnhAntigaVersoUrl?: string | null;
  
  cartaoCnpjFileUrl?: string | null;
  docSocioFrenteUrl?: string | null;
  docSocioVersoUrl?: string | null;
  
  comprovanteEnderecoUrl?: string | null;
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
  } catch (error) {
    console.error("Error loading print data from localStorage:", error);
    localStorage.removeItem(PRINT_DATA_KEY); 
  }
  return null;
}
