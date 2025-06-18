
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
    console.log(`[ProcessStore] Setting active process ID: ${id}`);
    localStorage.setItem(ACTIVE_PROCESS_ID_KEY, id);
  }
}

function clearActiveProcessId() {
  if (typeof window !== 'undefined') {
    console.log("[ProcessStore] Clearing active process ID.");
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
    } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null && !(cleaned[key] instanceof Timestamp) && !(cleaned[key] instanceof Date)) {
      (cleaned as any)[key] = cleanUndefinedValues(cleaned[key] as object | null);
    }
  }
  return cleaned;
}

function ensureAllKeysPresent(state: Partial<StoredProcessState>): StoredProcessState {
    const completeState = { ...initialStoredProcessState, ...state };
    completeState.buyerInfo = { ...initialStoredProcessState.buyerInfo, ...(state.buyerInfo || {}) };
    completeState.internalTeamMemberInfo = { ...initialStoredProcessState.internalTeamMemberInfo, ...(state.internalTeamMemberInfo || {}) };
    if (completeState.buyerType === 'pj') {
        completeState.companyInfo = { ...(initialStoredProcessState.companyInfo || { razaoSocial: '', nomeFantasia: '', cnpj: '' }), ...(state.companyInfo || {}) };
    } else {
        completeState.companyInfo = null;
    }
    const docKeys: (keyof StoredProcessState)[] = [
        "rgAntigoFrente", "rgAntigoVerso", "cnhAntigaFrente", "cnhAntigaVerso",
        "cartaoCnpjFile", "docSocioFrente", "docSocioVerso", "comprovanteEndereco"
    ];
    docKeys.forEach(key => {
        if (!(key in completeState) || completeState[key] === undefined) {
            (completeState as any)[key] = null;
        }
    });
    return completeState;
}


async function storeStateInFirestore(state: StoredProcessState): Promise<void> {
  if (!state.processId) {
    console.warn("[ProcessStore Firestore SAVE] Attempted to save state to Firestore without a processId. Skipping.");
    return;
  }
  try {
    const docRef = doc(db, "inProgressContracts", state.processId);
    const stateToStore = cleanUndefinedValues({ ...state, lastUpdated: Timestamp.now() });
    if (!stateToStore) {
        console.error("[ProcessStore Firestore SAVE] Cleaned state became null, aborting Firestore save for processId:", state.processId);
        return;
    }
    await setDoc(docRef, stateToStore, { merge: true });
    console.log(`[ProcessStore Firestore SAVE] Process state saved to Firestore: ${state.processId}. Includes extractedData: ${!!stateToStore.extractedData}, internalTeamMemberInfo: ${!!stateToStore.internalTeamMemberInfo}`);
  } catch (error) {
    console.error("[ProcessStore Firestore SAVE] Error saving state to Firestore for processId:", state.processId, error);
    toast({
      title: "Erro ao Salvar Progresso na Nuvem",
      description: "Seu progresso local foi salvo, mas não pudemos sincronizar com a nuvem. Verifique sua conexão.",
      variant: "destructive",
      duration: 7000,
    });
  }
}

export async function saveProcessState(state: StoredProcessState | undefined | null): Promise<void> {
  if (typeof window === 'undefined') return;

  if (state === undefined || state === null) {
    console.error("[ProcessStore SAVE] Attempted to save undefined or null state. Aborting save.");
    toast({
      title: "Erro Interno ao Salvar",
      description: "Tentativa de salvar um estado inválido. Por favor, recarregue a página.",
      variant: "destructive",
      duration: 10000,
    });
    return;
  }

  try {
    let stateToSave: StoredProcessState = { ...state };
    const activeIdFromStorage = getActiveProcessId();

    if (activeIdFromStorage && stateToSave.processId !== activeIdFromStorage) {
      stateToSave.processId = activeIdFromStorage;
    }
    if (!stateToSave.processId && activeIdFromStorage) {
      stateToSave.processId = activeIdFromStorage;
    }
    
    const cleanedStateForStorage = cleanUndefinedValues(ensureAllKeysPresent(stateToSave as Partial<StoredProcessState>)) as StoredProcessState | null;
    
    if (!cleanedStateForStorage) {
        console.error("[ProcessStore SAVE] Cleaned state for localStorage became null. Aborting save.");
        return;
    }
    
    // Log before stringify for localStorage
    console.log("[ProcessStore SAVE] State before localStorage.setItem:", {
      processId: cleanedStateForStorage.processId,
      currentStep: cleanedStateForStorage.currentStep,
      hasExtractedData: !!cleanedStateForStorage.extractedData,
      // extractedDataKeys: cleanedStateForStorage.extractedData ? Object.keys(cleanedStateForStorage.extractedData) : null,
      hasInternalTeamMemberInfo: !!cleanedStateForStorage.internalTeamMemberInfo,
      // internalTeamMemberInfoKeys: cleanedStateForStorage.internalTeamMemberInfo ? Object.keys(cleanedStateForStorage.internalTeamMemberInfo) : null,
      // rawExtractedData: cleanedStateForStorage.extractedData ? JSON.stringify(cleanedStateForStorage.extractedData) : 'null',
      // rawInternalTeamMemberInfo: cleanedStateForStorage.internalTeamMemberInfo ? JSON.stringify(cleanedStateForStorage.internalTeamMemberInfo) : 'null',
    });
    
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(cleanedStateForStorage));

    if (cleanedStateForStorage.processId) {
      if (cleanedStateForStorage.processId !== activeIdFromStorage) {
        setActiveProcessId(cleanedStateForStorage.processId);
      }
      await storeStateInFirestore(cleanedStateForStorage); 
    } else {
      if (activeIdFromStorage) {
        clearActiveProcessId();
      }
    }
  } catch (error: any) {
    console.error("[ProcessStore SAVE] Error saving process state:", error);
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

async function loadStateFromFirestore(processId: string): Promise<Partial<StoredProcessState> | null> {
  if (!processId) {
    console.warn("[ProcessStore Firestore LOAD] Attempted to load state from Firestore without a processId. Skipping.");
    return null;
  }
  try {
    const docRef = doc(db, "inProgressContracts", processId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const firestoreState = docSnap.data() as StoredProcessState;
      console.log(`[ProcessStore Firestore LOAD] State successfully loaded from Firestore for processId: ${processId}. Includes extractedData: ${!!firestoreState.extractedData}, internalTeamMemberInfo: ${!!firestoreState.internalTeamMemberInfo}`);
      return firestoreState;
    } else {
      console.log(`[ProcessStore Firestore LOAD] No document found in Firestore for processId: ${processId}.`);
      return null;
    }
  } catch (error) {
    console.error(`[ProcessStore Firestore LOAD] Error loading state from Firestore for processId: ${processId}`, error);
    toast({
      title: "Erro ao Carregar da Nuvem",
      description: "Não foi possível carregar seu progresso da nuvem. Tentando com dados locais.",
      variant: "destructive",
      duration: 7000,
    });
    return null;
  }
}


export async function loadProcessState(): Promise<StoredProcessState> {
  console.log("[ProcessStore LOAD] Attempting to load process state...");
  if (typeof window === 'undefined') {
    console.log("[ProcessStore LOAD] Window undefined, returning initial state.");
    return ensureAllKeysPresent(initialStoredProcessState);
  }

  let mergedState: Partial<StoredProcessState> = {};
  const activeId = getActiveProcessId();
  let sourceOfTruthLog = `ActiveID from getActiveProcessId(): ${activeId}. `;

  let firestoreData: Partial<StoredProcessState> | null = null;
  if (activeId) {
    firestoreData = await loadStateFromFirestore(activeId); // Corrected function call
    if (firestoreData) {
      sourceOfTruthLog += `Firestore (for activeId: ${activeId}) provided data. Merging. `;
      mergedState = { ...mergedState, ...firestoreData };
    } else {
      sourceOfTruthLog += `Firestore (for activeId: ${activeId}) provided NO data. `;
    }
  } else {
    sourceOfTruthLog += `No activeId from storage. Firestore load skipped. `;
  }


  let localStorageRaw: string | null = null;
  try {
    localStorageRaw = localStorage.getItem(PROCESS_STATE_KEY);
    console.log(`[ProcessStore LOAD] Raw data from localStorage '${PROCESS_STATE_KEY}':`, localStorageRaw ? `"${localStorageRaw.substring(0,100)}..."` : localStorageRaw);
  } catch (error) {
    console.error("[ProcessStore LOAD] Error reading localStorage:", error);
    sourceOfTruthLog += `Error reading LS. `;
  }

  if (localStorageRaw && localStorageRaw !== "undefined" && localStorageRaw !== "null") {
    try {
      const localStorageParsed = JSON.parse(localStorageRaw) as Partial<StoredProcessState>;
      console.log("[ProcessStore LOAD] Parsed localStorage data (first level keys):", Object.keys(localStorageParsed));

      const lsProcessId = localStorageParsed.processId;
      const lsLastUpdated = (localStorageParsed.lastUpdated as any)?.seconds;
      const fsLastUpdated = (firestoreData?.lastUpdated as any)?.seconds;
      sourceOfTruthLog += `LS processId: ${lsProcessId}, LS lastUpdated: ${lsLastUpdated}, FS lastUpdated: ${fsLastUpdated}. `;

      if (activeId && lsProcessId === activeId) {
        if (firestoreData && lsLastUpdated && fsLastUpdated && lsLastUpdated >= fsLastUpdated) {
          sourceOfTruthLog += `LocalStorage (for activeId: ${activeId}) is newer or same. Merging LS over FS. `;
          mergedState = { ...firestoreData, ...localStorageParsed };
        } else if (firestoreData) {
           sourceOfTruthLog += `Firestore (for activeId: ${activeId}) is newer or LS timestamp missing. FS was already merged. `;
        } else {
           sourceOfTruthLog += `No Firestore data, using LocalStorage for activeId ${activeId}. `;
           mergedState = { ...localStorageParsed };
        }
      } else if (!activeId && lsProcessId) {
        sourceOfTruthLog += `No activeId, but LocalStorage has process ${lsProcessId}. Resuming this LS process. `;
        mergedState = { ...localStorageParsed };
        setActiveProcessId(lsProcessId);
      } else if (activeId && lsProcessId && lsProcessId !== activeId) {
        sourceOfTruthLog += `LocalStorage has data for ${lsProcessId}, but active is ${activeId}. LS data ignored for this load. `;
      } else if (!lsProcessId && activeId) {
        sourceOfTruthLog += `LocalStorage data has no processId, but activeId ${activeId} exists. LS data ignored. Firestore (if loaded) remains. `;
      } else if (!lsProcessId && !activeId) {
        sourceOfTruthLog += `Neither LS nor activeId have a processId. LS data (empty processId) merged over initial. `;
        mergedState = { ...initialStoredProcessState, ...localStorageParsed };
      } else {
         sourceOfTruthLog += `LocalStorage data condition not met for explicit merging or resuming. Default merge logic (LS over FS). `;
         mergedState = { ...mergedState, ...localStorageParsed }; // Default to LS if timestamps are unclear or FS is missing
      }
    } catch (error) {
      console.error("[ProcessStore LOAD] Error parsing localStorage data, removing corrupted key:", error);
      localStorage.removeItem(PROCESS_STATE_KEY);
      sourceOfTruthLog += `Corrupted LocalStorage, removed. `;
    }
  } else {
    sourceOfTruthLog += `No valid LocalStorage data found (raw: ${localStorageRaw}). `;
    if (localStorageRaw === "undefined" || localStorageRaw === "null") {
        console.log("[ProcessStore LOAD] Removing 'undefined' or 'null' string from localStorage.");
        localStorage.removeItem(PROCESS_STATE_KEY);
    }
  }

  let finalState = ensureAllKeysPresent(cleanUndefinedValues(mergedState as StoredProcessState | null) || initialStoredProcessState);
  const currentActiveIdAfterMerge = getActiveProcessId();
  sourceOfTruthLog += `Current activeId after potential LS resume: ${currentActiveIdAfterMerge}. Final state processId: ${finalState.processId}. `;

  if (finalState.processId && currentActiveIdAfterMerge && finalState.processId !== currentActiveIdAfterMerge) {
    console.warn(`[ProcessStore LOAD] Mismatch: finalState.processId (${finalState.processId}) !== currentActiveIdAfterMerge (${currentActiveIdAfterMerge}). Overwriting finalState.processId with currentActiveId.`);
    finalState.processId = currentActiveIdAfterMerge;
    finalState = ensureAllKeysPresent(cleanUndefinedValues(finalState as StoredProcessState | null) || initialStoredProcessState);
    sourceOfTruthLog += `State processId updated to ${currentActiveIdAfterMerge}. `;
  } else if (!finalState.processId && currentActiveIdAfterMerge) {
    console.log(`[ProcessStore LOAD] finalState.processId is null, but currentActiveIdAfterMerge (${currentActiveIdAfterMerge}) exists. Setting finalState.processId.`);
    finalState.processId = currentActiveIdAfterMerge;
    finalState = ensureAllKeysPresent(cleanUndefinedValues(finalState as StoredProcessState | null) || initialStoredProcessState);
    sourceOfTruthLog += `State processId set to ${currentActiveIdAfterMerge}. `;
  }


  if (finalState.processId) {
    if (getActiveProcessId() !== finalState.processId) {
        console.log(`[ProcessStore LOAD] Updating activeProcessId in localStorage to match finalState.processId: ${finalState.processId}`);
        setActiveProcessId(finalState.processId);
    }
    console.log("[ProcessStore LOAD] Saving final merged state back to localStorage (PROCESS_STATE_KEY).");
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(finalState));
  } else {
     console.log("[ProcessStore LOAD] Final state has no processId. Clearing PROCESS_STATE_KEY and activeProcessId from localStorage. Resetting to initial state.");
     localStorage.removeItem(PROCESS_STATE_KEY);
     clearActiveProcessId();
     finalState = ensureAllKeysPresent(initialStoredProcessState);
     sourceOfTruthLog += `Final state had no processId, reset to initial. `;
  }
  
  console.log(`[ProcessStore LOAD] Source of Truth log: ${sourceOfTruthLog}`);
  console.log("[ProcessStore LOAD] Final loaded state being returned (processId, currentStep, extractedData, internalTeamMemberInfo):", 
    finalState ? {
        processId: finalState.processId,
        currentStep: finalState.currentStep,
        hasExtractedData: !!finalState.extractedData,
        // rawExtractedData: finalState.extractedData ? JSON.stringify(finalState.extractedData) : 'null',
        hasInternalTeamMemberInfo: !!finalState.internalTeamMemberInfo,
        // rawInternalTeamMemberInfo: finalState.internalTeamMemberInfo ? JSON.stringify(finalState.internalTeamMemberInfo) : 'null',
    } : String(finalState)
  );
  return finalState;
}


export function clearProcessState() {
  try {
    localStorage.removeItem(PROCESS_STATE_KEY);
    clearActiveProcessId();
    console.log("[ProcessStore ClearState] Local process state and activeProcessId cleared.");
  } catch (error) {
    console.error("[ProcessStore ClearState] Error clearing process state from localStorage:", error);
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
    

    
