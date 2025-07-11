
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, Timestamp, updateDoc, arrayUnion } from 'firebase/firestore';

export interface BuyerInfo {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cargo?: string;
  dataHora?: string; 
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
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
  buyerInfo: { nome: '', cpf: '', telefone: '', email: '', cargo: '', logradouro: '', bairro: '', cidade: '', estado: '', cep: '' },
  companyInfo: null,
  internalTeamMemberInfo: { nome: '', cpf: '', telefone: '', email: '', cargo: '' },

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

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v14_robust_parse';
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
    window.dispatchEvent(new CustomEvent('activeProcessIdChanged', { detail: id }));
  }
}

function clearActiveProcessId() {
  if (typeof window !== 'undefined') {
    console.log("[ProcessStore] Clearing active process ID.");
    localStorage.removeItem(ACTIVE_PROCESS_ID_KEY);
    window.dispatchEvent(new CustomEvent('activeProcessIdChanged', { detail: null }));
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
    const docRef = doc(db, "processos", state.processId);
    const cleanedClientState = cleanUndefinedValues(state);
    
    if (!cleanedClientState) {
        console.error("[ProcessStore Firestore SAVE] Cleaned client state for Firestore became null. Aborting save for processId:", state.processId);
        return;
    }

    const dataToStore: {
        clientState: StoredProcessState;
        lastUpdated: Timestamp;
        responsavelInterno?: BuyerInfo;
        status?: string;
        criadoEm?: Timestamp;
    } = {
      clientState: cleanedClientState,
      lastUpdated: Timestamp.now(),
    };

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      dataToStore.responsavelInterno = {
        nome: state.internalTeamMemberInfo.nome || '',
        cpf: state.internalTeamMemberInfo.cpf || '',
        email: state.internalTeamMemberInfo.email || '',
        telefone: state.internalTeamMemberInfo.telefone || '',
        cargo: state.internalTeamMemberInfo.cargo || '',
        dataHora: new Date().toISOString(),
      };
      dataToStore.status = "em_progresso";
      dataToStore.criadoEm = Timestamp.now();
      await setDoc(docRef, { ...dataToStore, arquivos: [] });
      console.log(`[ProcessStore Firestore SAVE] New process document created and state saved to Firestore 'processos/${state.processId}'.`);
    } else {
      await setDoc(docRef, dataToStore, { merge: true });
      console.log(`[ProcessStore Firestore SAVE] Process state updated in Firestore 'processos/${state.processId}'.`);
    }
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

export async function addUploadedFileToFirestore(processId: string, file: File, downloadURL: string, storagePath: string): Promise<void> {
  if (!processId) {
    console.warn("[ProcessStore Firestore ADD_FILE] No processId provided. Skipping Firestore update.");
    return;
  }
  try {
    const docRef = doc(db, "processos", processId);
    const fileData = {
      nome: file.name,
      url: downloadURL,
      storagePath: storagePath,
      enviadoEm: new Date().toISOString(),
    };
    await updateDoc(docRef, {
      arquivos: arrayUnion(fileData)
    });
    console.log(`[ProcessStore Firestore ADD_FILE] File ${file.name} added to 'arquivos' for process ${processId}`);
  } catch (error) {
    console.error(`[ProcessStore Firestore ADD_FILE] Error adding file to Firestore for process ${processId}:`, error);
    toast({
      title: "Erro ao Registrar Arquivo",
      description: `Não foi possível registrar o arquivo ${file.name} na nuvem. O upload pode ter funcionado, mas o registro falhou.`,
      variant: "destructive",
    });
  }
}

export async function saveProcessState(state: StoredProcessState | undefined | null): Promise<void> {
  if (typeof window === 'undefined') return;

  if (state === undefined || state === null) {
    console.error("[ProcessStore SAVE] Attempted to save undefined or null state. Aborting save.");
    return;
  }

  try {
    let stateToSave: StoredProcessState = { ...state };
    const activeIdFromStorage = getActiveProcessId();

    if (activeIdFromStorage && stateToSave.processId !== activeIdFromStorage) {
      console.warn(`[ProcessStore SAVE] Mismatch between state.processId (${stateToSave.processId}) and activeIdFromStorage (${activeIdFromStorage}). Using activeIdFromStorage.`);
      stateToSave.processId = activeIdFromStorage;
    }
    if (!stateToSave.processId && activeIdFromStorage) {
      stateToSave.processId = activeIdFromStorage;
    }
    
    const cleanedStateForLocalStorage = cleanUndefinedValues(ensureAllKeysPresent(stateToSave as Partial<StoredProcessState>)) as StoredProcessState | null;
    
    if (!cleanedStateForLocalStorage) {
        console.error("[ProcessStore SAVE] Cleaned state for localStorage became null. Removing from localStorage and clearing active ID.");
        localStorage.removeItem(PROCESS_STATE_KEY);
        if (stateToSave.processId) { 
            clearActiveProcessId();
        }
        return;
    }
    
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(cleanedStateForLocalStorage));

    if (cleanedStateForLocalStorage.processId) {
      if (cleanedStateForLocalStorage.processId !== activeIdFromStorage) {
        setActiveProcessId(cleanedStateForLocalStorage.processId); 
      }
      await storeStateInFirestore(cleanedStateForLocalStorage); 
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
    const docRef = doc(db, "processos", processId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const firestoreDocData = docSnap.data();
      const loadedClientState = (firestoreDocData.clientState || {}) as Partial<StoredProcessState>;
      
      const stateFromClientState: Partial<StoredProcessState> = {
          ...initialStoredProcessState, 
          ...loadedClientState,         
          processId: processId,         
      };
      
      if (firestoreDocData.lastUpdated) {
        stateFromClientState.lastUpdated = firestoreDocData.lastUpdated;
      }

      console.log(`[ProcessStore Firestore LOAD] State loaded from Firestore 'processos/${processId}'.`);
      return stateFromClientState;
    } else {
      console.log(`[ProcessStore Firestore LOAD] No document found in Firestore for 'processos/${processId}'.`);
      return null;
    }
  } catch (error) {
    console.error(`[ProcessStore Firestore LOAD] Error loading state from Firestore for 'processos/${processId}'`, error);
    return null;
  }
}

export async function loadProcessState(): Promise<StoredProcessState> {
  console.log("[ProcessStore LOAD] Attempting to load process state...");
  if (typeof window === 'undefined') {
    console.log("[ProcessStore LOAD] Window undefined, returning initial state.");
    return ensureAllKeysPresent(initialStoredProcessState);
  }

  let mergedStatePartial: Partial<StoredProcessState> = {};
  const activeId = getActiveProcessId();

  let firestoreData: Partial<StoredProcessState> | null = null;
  if (activeId) {
    firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      mergedStatePartial = { ...mergedStatePartial, ...firestoreData };
    }
  }

  let localStorageRaw: string | null = null;
  try {
    localStorageRaw = localStorage.getItem(PROCESS_STATE_KEY);
  } catch (error) {
    console.error("[ProcessStore LOAD] Error reading localStorage:", error);
  }

  if (localStorageRaw) {
    try {
      const localStorageParsed = JSON.parse(localStorageRaw) as Partial<StoredProcessState>;
      const lsProcessId = localStorageParsed.processId;
      const lsLastUpdated = (localStorageParsed.lastUpdated as any)?.seconds;
      const fsLastUpdated = (firestoreData?.lastUpdated as any)?.seconds;

      if (activeId && lsProcessId === activeId) {
        if (!firestoreData || (lsLastUpdated && fsLastUpdated && lsLastUpdated >= fsLastUpdated)) {
          mergedStatePartial = { ...firestoreData, ...localStorageParsed };
        }
      } else if (!activeId && lsProcessId) {
        mergedStatePartial = { ...localStorageParsed };
        setActiveProcessId(lsProcessId);
      }
    } catch (error) {
      console.error(`[ProcessStore LOAD] Error parsing localStorage data, removing corrupted key:`, error);
      localStorage.removeItem(PROCESS_STATE_KEY);
    }
  }
  
  let finalState = ensureAllKeysPresent(cleanUndefinedValues(mergedStatePartial as StoredProcessState | null) || initialStoredProcessState);
  
  const currentActiveIdAfterLoad = getActiveProcessId();
  if (currentActiveIdAfterLoad) {
    finalState.processId = currentActiveIdAfterLoad;
  } else if (finalState.processId) {
    setActiveProcessId(finalState.processId);
  }

  if (!finalState.processId) {
     finalState = ensureAllKeysPresent(initialStoredProcessState);
  }
  
  console.log("[ProcessStore LOAD] Final loaded state:", finalState);
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
