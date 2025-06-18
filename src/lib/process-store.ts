
"use client";

import type { VerifyContractPhotoOutput } from "@/ai/flows/verify-contract-photo";
import type { ExtractContractDataOutput } from "@/ai/flows/extract-contract-data-flow";
import type { ExtractBuyerDocumentDataOutput } from "@/ai/flows/extract-buyer-document-data-flow";
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase'; // Import db
import { doc, setDoc, getDoc, Timestamp, deleteDoc } from 'firebase/firestore'; // Firestore imports, added deleteDoc

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

async function storeStateInFirestore(state: StoredProcessState) {
  if (!state.processId) {
    console.warn("Attempted to save state to Firestore without a processId.");
    return;
  }
  try {
    const docRef = doc(db, "inProgressContracts", state.processId);
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
    const activeId = getActiveProcessId();
    if (activeId && stateToSave.processId !== activeId) {
      console.warn("Mismatch between active processId and state's processId during save. Using activeId from localStorage.");
      stateToSave.processId = activeId;
    }
     if (!stateToSave.processId && activeId) { // If state somehow lost processId, but we have an active one
      stateToSave.processId = activeId;
    }


    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(stateToSave));
    if (stateToSave.processId) {
      storeStateInFirestore(stateToSave); 
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
  let resolvedState: StoredProcessState;
  const activeId = getActiveProcessId();
  let localStorageData: StoredProcessState | null = null;

  try {
    const storedStateString = localStorage.getItem(PROCESS_STATE_KEY);
    if (storedStateString && storedStateString !== "undefined" && storedStateString !== "null") {
      const parsed = JSON.parse(storedStateString) as StoredProcessState;
      if (parsed.processId && parsed.processId === activeId) {
        localStorageData = parsed; // Valid localStorage data for the current active session
      } else if (parsed.processId && !activeId) {
        // localStorage has a processId, but no activeId. This implies a resumed session without going through HomePage.
        // Set this as the activeId and use this localStorageData.
        setActiveProcessId(parsed.processId); // Make this the active session
        localStorageData = parsed;
        console.log(`Resumed session with processId ${parsed.processId} from localStorage.`);
      } else if (parsed.processId && parsed.processId !== activeId) {
        // localStorage has data for a *different* processId than the active one. This is stale.
        console.warn(`Stale localStorage data found for processId ${parsed.processId}, but activeId is ${activeId}. Clearing stale data.`);
        localStorageData = null;
        localStorage.removeItem(PROCESS_STATE_KEY); // Remove only the main state key
      } else {
        localStorageData = null; // Covers cases like no processId in localStorage or other mismatches
      }
    }
  } catch (error) {
    console.error("Error loading/parsing process state from localStorage:", error);
    localStorage.removeItem(PROCESS_STATE_KEY);
  }

  if (localStorageData) {
    // Prioritize localStorage if it's valid for the (now potentially updated) activeId
    resolvedState = { ...initialStoredProcessState, ...localStorageData };
    console.log("Using localStorage state as primary source for processId:", resolvedState.processId);
    // Optionally, one could merge with Firestore here if needed, e.g., to get latest server updates
    // For this app, localStorage being most recent for current device session is likely desired.
  } else if (activeId) {
    // No valid/current localStorage, but we have an activeId (e.g., from HomePage start or resumed session from URL param if implemented)
    console.log("No valid localStorage state for activeId. Attempting to load from Firestore for processId:", activeId);
    const firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      resolvedState = { ...initialStoredProcessState, ...firestoreData, processId: activeId };
    } else {
      // No data in Firestore for this activeId. Start fresh for this activeId.
      resolvedState = { ...initialStoredProcessState, processId: activeId };
       console.log("No data in Firestore. Starting fresh for processId:", activeId);
    }
  } else {
    // No activeId and no suitable localStorage data. Completely fresh start.
    // A new processId will be generated by HomePage if the user starts a new process.
    resolvedState = { ...initialStoredProcessState, processId: null };
    console.log("No activeId or suitable localStorage. Starting with initial state.");
  }

  // Ensure essential nested objects are initialized if they are somehow null
  if (resolvedState.buyerType === 'pf') {
    resolvedState.companyInfo = null;
  } else if (resolvedState.buyerType === 'pj' && !resolvedState.companyInfo) {
    resolvedState.companyInfo = { ...(initialStoredProcessState.companyInfo!) };
  }
  if (!resolvedState.buyerInfo) {
    resolvedState.buyerInfo = { ...(initialStoredProcessState.buyerInfo) };
  }
  if (!resolvedState.internalTeamMemberInfo) {
    resolvedState.internalTeamMemberInfo = { ...(initialStoredProcessState.internalTeamMemberInfo) };
  }
  
  // Ensure all top-level keys from initial state are present
  resolvedState = { ...initialStoredProcessState, ...resolvedState };


  // Save the resolved/merged state back to localStorage to ensure consistency for the current session
  if (typeof window !== 'undefined') {
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(resolvedState));
  }

  return resolvedState;
}


export function clearProcessState() {
  try {
    const activeId = getActiveProcessId();
    if (activeId) {
      // No need to delete from Firestore "inProgressContracts" here,
      // as it might be useful for audit or if the user intentionally wants to abandon and restart.
      // The final submission to "submittedContracts" is the key "completed" record.
    }
    localStorage.removeItem(PROCESS_STATE_KEY);
    localStorage.removeItem(PRINT_DATA_KEY); // Though this is deprecated by current flow
    clearActiveProcessId();
    console.log("Local process state and activeProcessId cleared.");
  } catch (error) {
    console.error("Error clearing process state from localStorage:", error);
  }
}

// --- Print Data (kept for reference, but not primary for print page anymore) ---
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
