
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, Timestamp, updateDoc, arrayUnion, FieldValue } from 'firebase/firestore'; // Added updateDoc, arrayUnion

export interface BuyerInfo {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cargo?: string; // Added cargo
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
  internalTeamMemberInfo: BuyerInfo; // Will include cargo

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
  lastUpdated?: Timestamp; // From Firestore
  // Not storing 'arquivos' array from Firestore directly in client state,
  // as individual file slots are still used for UI.
  // Firestore 'arquivos' becomes the canonical list.
}

export const initialStoredProcessState: StoredProcessState = {
  processId: null,
  currentStep: '/processo/dados-iniciais',
  contractSourceType: 'new',
  selectedPlayer: null,
  selectedContractTemplateName: null,

  buyerType: 'pf',
  buyerInfo: { nome: '', cpf: '', telefone: '', email: '', cargo: '' },
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

const PROCESS_STATE_KEY = 'contratoFacilProcessState_v13_processos_collection'; // Updated key
const ACTIVE_PROCESS_ID_KEY = 'contratoFacilActiveProcessId_v1'; // Remains same

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
    const docRef = doc(db, "processos", state.processId); // Use 'processos' collection
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
        arquivos?: FieldValue; // For arrayUnion, not set here directly
    } = {
      clientState: cleanedClientState,
      lastUpdated: Timestamp.now(),
    };

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // This is the first time we are saving this document
      dataToStore.responsavelInterno = {
        nome: state.internalTeamMemberInfo.nome || '',
        email: state.internalTeamMemberInfo.email || '',
        telefone: state.internalTeamMemberInfo.telefone || '',
        cargo: state.internalTeamMemberInfo.cargo || '',
        dataHora: new Date().toISOString(), // User wanted ISO string here
      };
      dataToStore.status = "em_progresso";
      dataToStore.criadoEm = Timestamp.now(); // Firestore Timestamp for createdEm
      dataToStore.arquivos = []; // Initialize 'arquivos' as an empty array
    }

    await setDoc(docRef, dataToStore, { merge: true });
    console.log(`[ProcessStore Firestore SAVE] Process state saved to Firestore 'processos/${state.processId}'.`);
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
      storagePath: storagePath, // Storing storage path as well, can be useful
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
    // toast already handled by caller or earlier checks
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
        console.error("[ProcessStore SAVE] Cleaned state for localStorage became null. Aborting save.");
        return;
    }
    
    console.log("[ProcessStore SAVE] State before localStorage.setItem:", {
      processId: cleanedStateForLocalStorage.processId,
      currentStep: cleanedStateForLocalStorage.currentStep,
      hasExtractedData: !!cleanedStateForLocalStorage.extractedData,
      hasInternalTeamMemberInfo: !!cleanedStateForLocalStorage.internalTeamMemberInfo.nome, // Check for name as a proxy
    });
    
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
    const docRef = doc(db, "processos", processId); // Use 'processos' collection
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const firestoreDocData = docSnap.data();
      // The primary source of client state is the 'clientState' field.
      const loadedClientState = (firestoreDocData.clientState || {}) as Partial<StoredProcessState>;
      
      // Ensure critical IDs and timestamps from the root of the Firestore doc are honored
      // and merged into the client state object that will be used by the app.
      const mergedForClient: Partial<StoredProcessState> = {
          ...initialStoredProcessState, // Start with a base
          ...loadedClientState, // Overlay with whatever was in clientState field
          processId: processId, // Crucial: processId is the doc's ID
      };

      if (firestoreDocData.lastUpdated) {
        mergedForClient.lastUpdated = firestoreDocData.lastUpdated;
      }
      // If `responsavelInterno` at the root is considered more authoritative or for initial setup:
      if (firestoreDocData.responsavelInterno) {
        mergedForClient.internalTeamMemberInfo = {
            ...initialStoredProcessState.internalTeamMemberInfo,
            ...(loadedClientState.internalTeamMemberInfo || {}), // Prefer data from clientState if more recent/detailed
            ...firestoreDocData.responsavelInterno, // Then overlay with root `responsavelInterno`
        };
      }


      console.log(`[ProcessStore Firestore LOAD] State loaded from Firestore 'processos/${processId}'.`);
      return mergedForClient;
    } else {
      console.log(`[ProcessStore Firestore LOAD] No document found in Firestore for 'processos/${processId}'.`);
      return null;
    }
  } catch (error) {
    console.error(`[ProcessStore Firestore LOAD] Error loading state from Firestore for 'processos/${processId}'`, error);
    // toast appropriate error
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
  let sourceOfTruthLog = `ActiveID from getActiveProcessId(): ${activeId}. `;

  let firestoreData: Partial<StoredProcessState> | null = null;
  if (activeId) {
    firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      sourceOfTruthLog += `Firestore (for activeId: ${activeId}) provided data. Merging. `;
      mergedStatePartial = { ...mergedStatePartial, ...firestoreData };
    } else {
      sourceOfTruthLog += `Firestore (for activeId: ${activeId}) provided NO data. `;
    }
  } else {
    sourceOfTruthLog += `No activeId from storage. Firestore load skipped. `;
  }

  let localStorageRaw: string | null = null;
  try {
    localStorageRaw = localStorage.getItem(PROCESS_STATE_KEY);
    if (localStorageRaw) localStorageRaw = localStorageRaw.trim();
  } catch (error) {
    console.error("[ProcessStore LOAD] Error reading localStorage:", error);
    sourceOfTruthLog += `Error reading LS. `;
  }

  if (localStorageRaw && localStorageRaw !== "undefined" && localStorageRaw !== "null") {
    try {
      const localStorageParsed = JSON.parse(localStorageRaw) as Partial<StoredProcessState>;
      const lsProcessId = localStorageParsed.processId;
      const lsLastUpdated = (localStorageParsed.lastUpdated as any)?.seconds; // Assuming it's a Firestore Timestamp from LS
      const fsLastUpdated = (firestoreData?.lastUpdated as any)?.seconds;
      sourceOfTruthLog += `LS processId: ${lsProcessId}, LS lastUpdated: ${lsLastUpdated}, FS lastUpdated: ${fsLastUpdated}. `;

      if (activeId && lsProcessId === activeId) {
        // Both LS and FS agree on the active process. Decide which is newer.
        if (firestoreData && lsLastUpdated && fsLastUpdated && lsLastUpdated >= fsLastUpdated) {
          sourceOfTruthLog += `LocalStorage (for activeId ${activeId}) is newer or same. Merging LS over FS. `;
          mergedStatePartial = { ...firestoreData, ...localStorageParsed }; // LS data takes precedence
        } else if (firestoreData) {
           sourceOfTruthLog += `Firestore (for activeId ${activeId}) is newer or LS timestamp missing. FS was already merged. `;
           // mergedStatePartial already has firestoreData
        } else {
           sourceOfTruthLog += `No Firestore data, using LocalStorage for activeId ${activeId}. `;
           mergedStatePartial = { ...localStorageParsed };
        }
      } else if (!activeId && lsProcessId) {
        sourceOfTruthLog += `No activeId, but LocalStorage has process ${lsProcessId}. Resuming this LS process. `;
        mergedStatePartial = { ...localStorageParsed };
        setActiveProcessId(lsProcessId);
      } else if (activeId && lsProcessId && lsProcessId !== activeId) {
        sourceOfTruthLog += `LocalStorage has data for ${lsProcessId}, but active is ${activeId}. LS data ignored for this load. FS data (if any) for activeId is used.`;
      } else if (!lsProcessId && activeId) {
         sourceOfTruthLog += `LocalStorage data has no processId, but activeId ${activeId} exists. LS data ignored. FS data (if any) for activeId is used.`;
      } else if (!lsProcessId && !activeId) {
        sourceOfTruthLog += `Neither LS nor activeId have a processId. LS data (empty processId) merged over initial. `;
        mergedStatePartial = { ...initialStoredProcessState, ...localStorageParsed };
      } else {
         sourceOfTruthLog += `Fallback: LocalStorage data condition not met for explicit merging. Merging LS over current mergedState. `;
         mergedStatePartial = { ...mergedStatePartial, ...localStorageParsed };
      }
    } catch (error) {
      console.error(`[ProcessStore LOAD] Error parsing localStorage data, removing corrupted key:`, error);
      localStorage.removeItem(PROCESS_STATE_KEY);
      sourceOfTruthLog += `Corrupted LocalStorage (parse failed), removed. `;
    }
  } else {
    sourceOfTruthLog += `No valid LocalStorage data found. `;
    if (localStorageRaw === "undefined" || localStorageRaw === "null") {
        localStorage.removeItem(PROCESS_STATE_KEY);
    }
  }
  
  let finalState = ensureAllKeysPresent(cleanUndefinedValues(mergedStatePartial as StoredProcessState | null) || initialStoredProcessState);
  const currentActiveIdAfterPotentialResume = getActiveProcessId();
  sourceOfTruthLog += `Current activeId after potential LS resume: ${currentActiveIdAfterPotentialResume}. Final state processId before override: ${finalState.processId}. `;

  // Ensure final state's processId matches the definitive activeId if one exists.
  if (currentActiveIdAfterPotentialResume) {
      if(finalState.processId !== currentActiveIdAfterPotentialResume) {
          console.warn(`[ProcessStore LOAD] Overriding finalState.processId (${finalState.processId}) with currentActiveId (${currentActiveIdAfterPotentialResume}).`);
          finalState.processId = currentActiveIdAfterPotentialResume;
          sourceOfTruthLog += `State processId updated to ${currentActiveIdAfterPotentialResume}. `;
      }
  } else if (finalState.processId) {
      // If final state has a processId but there's no activeId, make the final state's ID active.
      setActiveProcessId(finalState.processId);
      sourceOfTruthLog += `Set activeId to finalState.processId ${finalState.processId}. `;
  }


  if (finalState.processId) {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(finalState)); // Save the potentially corrected/merged state back to LS
  } else {
     localStorage.removeItem(PROCESS_STATE_KEY);
     clearActiveProcessId();
     finalState = ensureAllKeysPresent(initialStoredProcessState); // Reset to initial if no ID could be established
     sourceOfTruthLog += `Final state had no processId, reset to initial. `;
  }
  
  console.log(`[ProcessStore LOAD] Source of Truth log: ${sourceOfTruthLog}`);
  console.log("[ProcessStore LOAD] Final loaded state being returned (processId, currentStep):", 
    finalState ? { processId: finalState.processId, currentStep: finalState.currentStep } : String(finalState)
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

// PrintData related functions remain largely unchanged, unless they also need to interact with the 'processos' collection.
// For now, assuming they are self-contained for print page needs based on StoredProcessState.
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
    localStorage.setItem('contractPrintData_v13_processos_collection', JSON.stringify(cleanedData));
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
    let dataString = localStorage.getItem('contractPrintData_v13_processos_collection');
    if (dataString) dataString = dataString.trim();

    if (dataString && dataString !== "undefined" && dataString !== "null") {
      const parsedData = JSON.parse(dataString) as PrintData;
       parsedData.buyerType = parsedData.buyerType || 'pf';
       parsedData.companyInfo = parsedData.companyInfo || null;
      return cleanUndefinedValues(parsedData);
    } else if (dataString === "undefined" || dataString === "null") {
      localStorage.removeItem('contractPrintData_v13_processos_collection');
    }
  } catch (error) {
    console.error("Error loading print data from localStorage:", error);
    if (typeof window !== 'undefined') localStorage.removeItem('contractPrintData_v13_processos_collection');
  }
  return null;
}
    
