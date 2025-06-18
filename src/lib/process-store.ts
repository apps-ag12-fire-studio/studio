
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
  contractPhotoName: string | null; // Changed from undefined
  contractPhotoStoragePath?: string | null;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;

  signedContractPhotoPreview: string | null;
  signedContractPhotoName: string | null; // Changed from undefined
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

function cleanUndefinedValues<T extends object>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const cleaned = { ...obj };
  for (const key in cleaned) {
    if (cleaned[key] === undefined) {
      (cleaned as any)[key] = null; // Assign null if undefined
    } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      (cleaned as any)[key] = cleanUndefinedValues(cleaned[key] as object); // Recurse for nested objects
    }
  }
  return cleaned;
}


async function storeStateInFirestore(state: StoredProcessState) {
  if (!state.processId) {
    console.warn("[FirestoreStore] Attempted to save state to Firestore without a processId.");
    return;
  }
  try {
    const docRef = doc(db, "inProgressContracts", state.processId);
    // Ensure cleaning BEFORE sending to Firestore
    const cleanedStateToStore = cleanUndefinedValues({ ...state, lastUpdated: Timestamp.now() });

    await setDoc(docRef, cleanedStateToStore, { merge: true });
    console.log("[FirestoreStore] Process state saved to Firestore:", state.processId);
  } catch (error) {
    console.error("[FirestoreStore] Error saving state to Firestore:", error);
    toast({
      title: "Erro ao Salvar Progresso na Nuvem",
      description: "Seu progresso local foi salvo, mas não pudemos sincronizar com a nuvem. Verifique sua conexão.",
      variant: "destructive",
      duration: 7000,
    });
  }
}

async function loadStateFromFirestore(processId: string): Promise<Partial<StoredProcessState> | null> {
  console.log(`[FirestoreLoad] Attempting to load state from Firestore for processId: ${processId}`);
  try {
    const docRef = doc(db, "inProgressContracts", processId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const firestoreData = docSnap.data() as StoredProcessState;
      console.log("[FirestoreLoad] Process state loaded from Firestore:", processId, firestoreData);
      return cleanUndefinedValues(firestoreData); // Clean just in case, though Firestore usually handles this
    }
    console.log("[FirestoreLoad] No process state found in Firestore for:", processId);
    return null;
  } catch (error) {
    console.error("[FirestoreLoad] Error loading state from Firestore:", error);
    toast({
      title: "Erro ao Carregar Progresso da Nuvem",
      description: "Não foi possível carregar seu progresso da nuvem. Tentaremos usar dados locais, se disponíveis.",
      variant: "destructive",
      duration: 7000,
    });
    return null;
  }
}

export function saveProcessState(state: StoredProcessState | undefined) {
  if (typeof window === 'undefined') return;

  if (state === undefined) {
    console.error("[LSSave] Attempted to save undefined state. Aborting save.");
    toast({
      title: "Erro Interno ao Salvar",
      description: "Tentativa de salvar um estado inválido. Por favor, recarregue a página. Se o problema persistir, contate o suporte.",
      variant: "destructive",
      duration: 10000,
    });
    return;
  }

  try {
    let stateToSave = { ...state }; // Create a mutable copy
    const activeId = getActiveProcessId();

    if (activeId && stateToSave.processId !== activeId) {
      console.warn(`[LSSave] State processId (${stateToSave.processId}) differs from activeId (${activeId}). Aligning to activeId.`);
      stateToSave.processId = activeId;
    }
    if (!stateToSave.processId && activeId) {
      stateToSave.processId = activeId;
    }
    
    const cleanedStateForLocalStorage = cleanUndefinedValues(stateToSave);
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(cleanedStateForLocalStorage));
    console.log("[LSSave] Process state saved to localStorage:", cleanedStateForLocalStorage);

    if (cleanedStateForLocalStorage.processId) {
      storeStateInFirestore(cleanedStateForLocalStorage);
    } else {
      console.warn("[LSSave] No processId in state, skipping Firestore save.");
    }
  } catch (error: any) {
    console.error("[LSSave] Error saving process state to localStorage:", error);
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
  console.log("[LSLoad] Attempting to load process state...");
  if (typeof window === 'undefined') {
    console.log("[LSLoad] Window not defined, returning initial state.");
    return { ...initialStoredProcessState };
  }

  let finalState: StoredProcessState = { ...initialStoredProcessState };
  const activeId = getActiveProcessId();
  console.log(`[LSLoad] Active processId from localStorage (ACTIVE_PROCESS_ID_KEY): ${activeId}`);

  if (activeId) {
    finalState.processId = activeId;
  }

  let firestoreData: Partial<StoredProcessState> | null = null;
  if (activeId) {
    firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      finalState = { ...finalState, ...firestoreData, processId: activeId }; // Prioritize Firestore if activeId matches
      console.log("[LSLoad] Merged Firestore data for activeId:", finalState);
    }
  }

  let localStorageRaw: string | null = null;
  try {
    localStorageRaw = localStorage.getItem(PROCESS_STATE_KEY);
    console.log(`[LSLoad] Raw state from localStorage (PROCESS_STATE_KEY):`, localStorageRaw);
  } catch (error) {
    console.error("[LSLoad] Error reading from localStorage:", error);
  }

  if (localStorageRaw && localStorageRaw !== "undefined" && localStorageRaw !== "null") {
    try {
      const localStorageParsed = JSON.parse(localStorageRaw) as Partial<StoredProcessState>;
      console.log("[LSLoad] Parsed localStorage data:", localStorageParsed);

      if (localStorageParsed.processId && localStorageParsed.processId === finalState.processId) {
        // LS data is for the current active process, merge it considering Firestore might be more authoritative or LS has offline changes.
        // A more sophisticated merge (e.g., by lastUpdated timestamp) could be done here.
        // For now, let's assume LS could have fresher offline edits for an active session.
        finalState = { ...finalState, ...localStorageParsed };
        console.log("[LSLoad] Merged localStorage data (same processId as active/Firestore):", finalState);
      } else if (localStorageParsed.processId && !finalState.processId) {
        // No activeId, no Firestore, but LS has a process. Adopt it.
        finalState = { ...initialStoredProcessState, ...localStorageParsed };
        setActiveProcessId(finalState.processId!);
        console.log(`[LSLoad] Resumed session with processId ${finalState.processId} from orphaned localStorage data.`);
      } else if (localStorageParsed.processId && localStorageParsed.processId !== finalState.processId) {
        console.warn(`[LSLoad] LocalStorage has data for processId ${localStorageParsed.processId}, but active/Firestore is ${finalState.processId}. Using data for active/Firestore process.`);
      }
    } catch (error) {
      console.error("[LSLoad] Error parsing localStorage state JSON:", error, "Raw string was:", localStorageRaw);
      localStorage.removeItem(PROCESS_STATE_KEY); // Corrupted data, remove it
      console.log("[LSLoad] Removed corrupted PROCESS_STATE_KEY from localStorage.");
    }
  } else if (localStorageRaw === "undefined" || localStorageRaw === "null") {
    console.log(`[LSLoad] localStorage contained literal string "${localStorageRaw}". Clearing it.`);
    localStorage.removeItem(PROCESS_STATE_KEY);
  }


  // Final cleanup and ensuring all keys from initialStoredProcessState are present
  finalState = cleanUndefinedValues({ ...initialStoredProcessState, ...finalState });
  
  // Ensure buyerType consistency and essential objects are initialized
  if (finalState.buyerType === 'pf') {
    finalState.companyInfo = null;
  } else if (finalState.buyerType === 'pj' && !finalState.companyInfo) {
    finalState.companyInfo = { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }) };
  }
  if (!finalState.buyerInfo) {
    finalState.buyerInfo = { ...(initialStoredProcessState.buyerInfo) };
  }
  if (!finalState.internalTeamMemberInfo) {
    finalState.internalTeamMemberInfo = { ...(initialStoredProcessState.internalTeamMemberInfo) };
  }

  console.log("[LSLoad] Final loaded state before returning:", finalState);
  // Persist the reconciled/cleaned state back to localStorage if a valid processId exists
  // This helps ensure consistency if Firestore had newer data or if orphaned LS data was adopted.
  if (finalState.processId) {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(finalState));
    if (!getActiveProcessId()) {
        setActiveProcessId(finalState.processId);
    }
  } else {
     // If after all, we still don't have a processId, clear LS to avoid inconsistent states.
     localStorage.removeItem(PROCESS_STATE_KEY);
     clearActiveProcessId();
  }
  
  return finalState;
}


export function clearProcessState() {
  try {
    // const activeId = getActiveProcessId(); // No longer needed to interact with Firestore here
    localStorage.removeItem(PROCESS_STATE_KEY);
    // localStorage.removeItem(PRINT_DATA_KEY); // This key is no longer used by the primary flow
    clearActiveProcessId();
    console.log("[ClearState] Local process state and activeProcessId cleared.");
  } catch (error) {
    console.error("[ClearState] Error clearing process state from localStorage:", error);
  }
}

// PrintData related functions are no longer primarily used in the main flow to print-contract page
// but kept for potential direct use or reference.
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
    localStorage.setItem('contractPrintData_v9_firestore_sync', JSON.stringify(cleanUndefinedValues(data)));
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
    const dataString = localStorage.getItem('contractPrintData_v9_firestore_sync');
    if (dataString && dataString !== "undefined" && dataString !== "null") {
      const parsedData = JSON.parse(dataString) as PrintData;
       parsedData.buyerType = parsedData.buyerType || 'pf';
       parsedData.companyInfo = parsedData.companyInfo || null;
      return cleanUndefinedValues(parsedData);
    }
  } catch (error) {
    console.error("Error loading print data from localStorage:", error);
    if (typeof window !== 'undefined') localStorage.removeItem('contractPrintData_v9_firestore_sync');
  }
  return null;
}
