
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
  contractPhotoName: string | null;
  contractPhotoStoragePath?: string | null;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;

  signedContractPhotoPreview: string | null;
  signedContractPhotoName: string | null;
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

function cleanUndefinedValues<T extends object>(obj: T | null | undefined): T | null {
  if (obj === null || obj === undefined) {
    return null;
  }
  const cleaned = { ...obj } as T;
  for (const key in cleaned) {
    if (cleaned[key] === undefined) {
      (cleaned as any)[key] = null;
    } else if (typeof cleaned[key] === 'object' && !(cleaned[key] instanceof Timestamp)) {
      (cleaned as any)[key] = cleanUndefinedValues(cleaned[key] as object | null);
    }
  }
  return cleaned;
}

function ensureAllKeysPresent(state: Partial<StoredProcessState>): StoredProcessState {
    const completeState = { ...initialStoredProcessState, ...state };
    // Ensure nested objects are also fully initialized if they exist partially
    completeState.buyerInfo = { ...initialStoredProcessState.buyerInfo, ...(state.buyerInfo || {}) };
    completeState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo, ...(state.internalTeamMemberInfo || {}) };
    if (completeState.buyerType === 'pj') {
        completeState.companyInfo = { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }), ...(state.companyInfo || {}) };
    } else {
        completeState.companyInfo = null;
    }
    return completeState;
}


async function storeStateInFirestore(state: StoredProcessState) {
  if (!state.processId) {
    console.warn("[FirestoreStore] Attempted to save state to Firestore without a processId.");
    return;
  }
  try {
    const docRef = doc(db, "inProgressContracts", state.processId);
    const stateToStore = cleanUndefinedValues({ ...state, lastUpdated: Timestamp.now() });
    if (!stateToStore) {
        console.error("[FirestoreStore] Cleaned state became null, aborting Firestore save.");
        return;
    }
    await setDoc(docRef, stateToStore, { merge: true });
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
      console.log("[FirestoreLoad] Raw Firestore data:", JSON.parse(JSON.stringify(firestoreData)));
      return cleanUndefinedValues(firestoreData);
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

export function saveProcessState(state: StoredProcessState | undefined | null) {
  console.log("[LSSave] Attempting to save process state. Input state:", state ? JSON.parse(JSON.stringify(state)) : state);
  if (typeof window === 'undefined') return;

  if (state === undefined || state === null) {
    console.error("[LSSave] Attempted to save undefined or null state. Aborting save.");
    toast({
      title: "Erro Interno ao Salvar",
      description: "Tentativa de salvar um estado inválido. Por favor, recarregue a página.",
      variant: "destructive",
      duration: 10000,
    });
    return;
  }

  try {
    let stateToSave = { ...state };
    const activeId = getActiveProcessId();

    if (activeId && stateToSave.processId !== activeId) {
      console.warn(`[LSSave] State processId (${stateToSave.processId}) differs from activeId (${activeId}). Aligning to activeId.`);
      stateToSave.processId = activeId;
    }
    if (!stateToSave.processId && activeId) {
      console.log(`[LSSave] State has no processId, but activeId (${activeId}) exists. Assigning activeId.`);
      stateToSave.processId = activeId;
    }
    
    const cleanedStateForStorage = cleanUndefinedValues(ensureAllKeysPresent(stateToSave));
    if (!cleanedStateForStorage) {
        console.error("[LSSave] Cleaned state for localStorage became null. Aborting save.");
        return;
    }
    
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(cleanedStateForStorage));
    console.log("[LSSave] Process state saved to localStorage:", JSON.parse(JSON.stringify(cleanedStateForStorage)));

    if (cleanedStateForStorage.processId) {
      storeStateInFirestore(cleanedStateForStorage);
    } else {
      console.warn("[LSSave] No processId in cleaned state, skipping Firestore save.");
    }
  } catch (error: any) {
    console.error("[LSSave] Error saving process state:", error);
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
    return ensureAllKeysPresent(initialStoredProcessState);
  }

  let mergedState: Partial<StoredProcessState> = {};
  const activeId = getActiveProcessId();
  let sourceOfTruthLog = `ActiveID: ${activeId}. `;

  console.log(`[LSLoad] Active processId from ACTIVE_PROCESS_ID_KEY: ${activeId}`);

  let firestoreData: Partial<StoredProcessState> | null = null;
  if (activeId) {
    firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      sourceOfTruthLog += `Firestore (for ${activeId}) provided data. `;
      mergedState = { ...mergedState, ...firestoreData };
    } else {
      sourceOfTruthLog += `Firestore (for ${activeId}) provided NO data. `;
    }
  } else {
    sourceOfTruthLog += `No activeId. `;
  }
  console.log(`[LSLoad] State after Firestore check:`, JSON.parse(JSON.stringify(mergedState)));


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
      console.log("[LSLoad] Parsed localStorage data:", JSON.parse(JSON.stringify(localStorageParsed)));

      if (activeId && localStorageParsed.processId === activeId) {
        // LocalStorage data is for the current active process. Merge it on top of Firestore data.
        sourceOfTruthLog += `LocalStorage (for ${activeId}) provided data, merging. `;
        mergedState = { ...mergedState, ...localStorageParsed };
      } else if (!activeId && localStorageParsed.processId) {
        // No active session, but localStorage has a process. Resume it.
        sourceOfTruthLog += `No activeId, but LocalStorage has process ${localStorageParsed.processId}. Resuming. `;
        mergedState = { ...localStorageParsed }; // Take LS as base
        setActiveProcessId(localStorageParsed.processId); // Make it active
      } else if (activeId && localStorageParsed.processId && localStorageParsed.processId !== activeId) {
        sourceOfTruthLog += `LocalStorage has data for ${localStorageParsed.processId}, but active is ${activeId}. Ignoring LS. `;
        // Stick with Firestore data for activeId or empty if Firestore had nothing for activeId
      } else if (!localStorageParsed.processId && activeId) {
        sourceOfTruthLog += `LocalStorage data has no processId. Sticking with Firestore for ${activeId} or empty. `;
      } else {
         sourceOfTruthLog += `LocalStorage data condition not met for merging or resuming. `;
      }
    } catch (error) {
      console.error("[LSLoad] Error parsing localStorage state JSON:", error, "Raw string was:", localStorageRaw);
      localStorage.removeItem(PROCESS_STATE_KEY);
      sourceOfTruthLog += `Corrupted LocalStorage, removed. `;
    }
  } else {
    sourceOfTruthLog += `No valid LocalStorage data found. `;
    if (localStorageRaw === "undefined" || localStorageRaw === "null") {
        localStorage.removeItem(PROCESS_STATE_KEY);
    }
  }
  console.log(`[LSLoad] State after LocalStorage check:`, JSON.parse(JSON.stringify(mergedState)));


  let finalState = ensureAllKeysPresent(mergedState);
  if (activeId && finalState.processId !== activeId) {
    console.warn(`[LSLoad] Final state's processId ${finalState.processId} does not match activeId ${activeId}. Forcing to activeId.`);
    finalState.processId = activeId;
  }


  if (finalState.processId) {
    // Ensure the currently active processId is what's in the state before saving
    if (!getActiveProcessId()) {
        setActiveProcessId(finalState.processId);
    } else if (getActiveProcessId() !== finalState.processId) {
        // This case should ideally not happen if logic is correct, but as a safeguard:
        console.warn(`[LSLoad] Mismatch: active_id is ${getActiveProcessId()}, finalState.processId is ${finalState.processId}. Prioritizing active_id.`);
        finalState.processId = getActiveProcessId();
    }
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(finalState));
  } else {
     console.log(`[LSLoad] No processId in finalState after all checks. Clearing localStorage and activeId.`);
     localStorage.removeItem(PROCESS_STATE_KEY);
     clearActiveProcessId();
  }
  
  console.log(`[LSLoad] Source of Truth determination: ${sourceOfTruthLog}`);
  console.log("[LSLoad] Final loaded state being returned:", JSON.parse(JSON.stringify(finalState)));
  return finalState;
}


export function clearProcessState() {
  try {
    localStorage.removeItem(PROCESS_STATE_KEY);
    clearActiveProcessId();
    console.log("[ClearState] Local process state and activeProcessId cleared.");
  } catch (error) {
    console.error("[ClearState] Error clearing process state from localStorage:", error);
  }
}

// PrintData related functions are kept for potential direct use or reference.
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
    const cleanedData = cleanUndefinedValues(data);
    if (!cleanedData) {
        console.error("[SavePrintData] Cleaned print data became null. Aborting save.");
        return;
    }
    localStorage.setItem('contractPrintData_v9_firestore_sync', JSON.stringify(cleanedData));
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

    