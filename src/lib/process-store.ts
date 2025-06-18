
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

export interface BuyerInfo {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
}

export type BuyerType = 'pf' | 'pj';

export interface DocumentFile {
  name?: string | null;
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
  processId: string | null;
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
  contractPhotoName?: string | null;
  contractPhotoStoragePath?: string | null;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;

  signedContractPhotoPreview: string | null;
  signedContractPhotoName?: string | null;
  signedContractPhotoStoragePath?: string | null;
  lastUpdated?: Timestamp;
}

export const initialStoredProcessState: StoredProcessState = {
  processId: null,
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
  contractPhotoName: null,
  contractPhotoStoragePath: null,
  photoVerificationResult: null,
  photoVerified: false,
  extractedData: null,

  signedContractPhotoPreview: null,
  signedContractPhotoName: null,
  signedContractPhotoStoragePath: null,
};

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v12_firestore_sync';
const PRINT_DATA_KEY = 'contractPrintData_v9_firestore_sync'; // Kept for reference, not primary
const ACTIVE_PROCESS_ID_KEY = 'contratoFacilActiveProcessId_v1';

function getActiveProcessId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACTIVE_PROCESS_ID_KEY);
  }
  return null;
}

export function setActiveProcessId(id: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_PROCESS_ID_KEY, id);
  }
}

function clearActiveProcessId() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACTIVE_PROCESS_ID_KEY);
  }
}

// Helper to clean undefined values from an object recursively
// Firestore does not accept undefined, and it's good practice for localStorage too
function cleanUndefinedValues(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item));
  }
  const cleaned = { ...obj };
  for (const key in cleaned) {
    if (cleaned[key] === undefined) {
      cleaned[key] = null;
    } else if (typeof cleaned[key] === 'object') {
      cleaned[key] = cleanUndefinedValues(cleaned[key]);
    }
  }
  return cleaned;
}


async function storeStateInFirestore(state: StoredProcessState) {
  if (!state.processId) {
    console.warn("Attempted to save state to Firestore without a processId.");
    return;
  }
  try {
    const docRef = doc(db, "inProgressContracts", state.processId);
    const stateToStore = { ...state, lastUpdated: Timestamp.now() };
    
    // Use the robust cleaner before sending to Firestore
    const cleanedStateToStore = cleanUndefinedValues(stateToStore);

    await setDoc(docRef, cleanedStateToStore, { merge: true });
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
      // Firestore data should already be clean of undefined values
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
    let stateToSave = { ...state };
    const activeId = getActiveProcessId();

    if (activeId && stateToSave.processId !== activeId) {
      stateToSave.processId = activeId;
    }
    if (!stateToSave.processId && activeId) {
      stateToSave.processId = activeId;
    }
    
    // Clean before saving to localStorage
    const cleanedStateForLocalStorage = cleanUndefinedValues(stateToSave);
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(cleanedStateForLocalStorage));

    if (cleanedStateForLocalStorage.processId) {
      storeStateInFirestore(cleanedStateForLocalStorage);
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
  let mergedState: StoredProcessState = { ...initialStoredProcessState };
  const activeId = getActiveProcessId();

  // 1. Set processId in mergedState if activeId exists
  if (activeId) {
    mergedState.processId = activeId;
  }

  // 2. Try to load from Firestore if activeId exists
  let firestoreData: Partial<StoredProcessState> | null = null;
  if (activeId) {
    firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      // Firestore data is source of truth if available for this activeId
      mergedState = { ...mergedState, ...firestoreData, processId: activeId };
    }
  }

  // 3. Try to load from localStorage
  let localStorageData: Partial<StoredProcessState> | null = null;
  try {
    const storedStateString = localStorage.getItem(PROCESS_STATE_KEY);
    if (storedStateString && storedStateString !== "undefined" && storedStateString !== "null") {
      localStorageData = JSON.parse(storedStateString) as StoredProcessState;
    }
  } catch (error) {
    console.error("Error parsing localStorage state:", error);
    if (typeof window !== 'undefined') localStorage.removeItem(PROCESS_STATE_KEY);
  }

  // 4. Merge localStorageData intelligently
  if (localStorageData) {
    if (localStorageData.processId && localStorageData.processId === mergedState.processId) {
      // LS data is for the current active process, merge it over Firestore/initial
      // (potentially newer if offline changes were made)
      mergedState = { ...mergedState, ...localStorageData };
    } else if (localStorageData.processId && !mergedState.processId) {
      // No activeId, no Firestore, but LS has a process. Adopt it.
      mergedState = { ...initialStoredProcessState, ...localStorageData };
      setActiveProcessId(mergedState.processId!); // Set this as the active process
      console.log(`Resumed session with processId ${mergedState.processId} from orphaned localStorage data.`);
    } else if (localStorageData.processId && localStorageData.processId !== mergedState.processId) {
      // LS data is for a different processId than current active/Firestore one.
      // This is stale data, ignore it for merging, but don't delete it yet, user might switch back.
      console.warn(`LocalStorage has data for ${localStorageData.processId}, but active is ${mergedState.processId}. Using data for active process.`);
    }
  }
  
  // 5. Final cleaning and ensuring all keys from initial state are present
  let finalState: StoredProcessState = { ...initialStoredProcessState }; // Start with a full template

  // Merge the determined state (mergedState) onto the full template
  // This ensures all keys from initialStoredProcessState are present
  finalState = { ...finalState, ...mergedState };

  // Final clean of any undefined values that might have slipped through merging
  finalState = cleanUndefinedValues(finalState);
  
  // Ensure buyerType consistency
  if (finalState.buyerType === 'pf') {
    finalState.companyInfo = null;
  } else if (finalState.buyerType === 'pj' && !finalState.companyInfo) {
    finalState.companyInfo = { ...(initialStoredProcessState.companyInfo!) };
  }
  if (!finalState.buyerInfo) {
    finalState.buyerInfo = { ...(initialStoredProcessState.buyerInfo) };
  }
  if (!finalState.internalTeamMemberInfo) {
    finalState.internalTeamMemberInfo = { ...(initialStoredProcessState.internalTeamMemberInfo) };
  }

  // Persist the potentially reconciled/cleaned state back to localStorage
  // This is important if Firestore had more recent data or if orphaned LS data was adopted.
  if (typeof window !== 'undefined' && finalState.processId) {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(finalState));
    if (!getActiveProcessId()) { // If activeId was just set from orphaned LS data
        setActiveProcessId(finalState.processId);
    }
  } else if (typeof window !== 'undefined' && !finalState.processId) {
     // If after all, we still don't have a processId, clear LS to avoid inconsistent states.
     localStorage.removeItem(PROCESS_STATE_KEY);
     clearActiveProcessId();
  }
  
  return finalState;
}


export function clearProcessState() {
  try {
    const activeId = getActiveProcessId();
    if (activeId) {
      // No need to delete from Firestore immediately, let it be archival or cleaned by a separate process
    }
    localStorage.removeItem(PROCESS_STATE_KEY);
    localStorage.removeItem(PRINT_DATA_KEY);
    clearActiveProcessId();
    console.log("Local process state and activeProcessId cleared.");
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
    localStorage.setItem(PRINT_DATA_KEY, JSON.stringify(cleanUndefinedValues(data)));
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
      return cleanUndefinedValues(parsedData);
    }
  } catch (error) {
    console.error("Error loading print data from localStorage:", error);
    if (typeof window !== 'undefined') localStorage.removeItem(PRINT_DATA_KEY);
  }
  return null;
}
