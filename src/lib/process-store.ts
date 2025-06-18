
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
  name?: string | null; // Allow null
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
  contractPhotoName?: string | null; // Changed from undefined
  contractPhotoStoragePath?: string | null;
  photoVerificationResult: VerifyContractPhotoOutput | null;
  photoVerified: boolean;
  extractedData: ExtractContractDataOutput | null;

  signedContractPhotoPreview: string | null;
  signedContractPhotoName?: string | null; // Changed from undefined
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
  contractPhotoName: null, // Changed from undefined
  contractPhotoStoragePath: null,
  photoVerificationResult: null,
  photoVerified: false,
  extractedData: null,

  signedContractPhotoPreview: null,
  signedContractPhotoName: null, // Changed from undefined
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

    // Ensure no undefined values are being sent to Firestore
    const cleanedStateToStore = JSON.parse(JSON.stringify(stateToStore, (key, value) => {
        return (value === undefined ? null : value);
    }));


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
     if (!stateToSave.processId && activeId) { 
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
        localStorageData = parsed;
      } else if (parsed.processId && !activeId) {
        setActiveProcessId(parsed.processId); 
        localStorageData = parsed;
        console.log(`Resumed session with processId ${parsed.processId} from localStorage.`);
      } else if (parsed.processId && parsed.processId !== activeId) {
        console.warn(`Stale localStorage data found for processId ${parsed.processId}, but activeId is ${activeId}. Clearing stale data.`);
        localStorageData = null;
        localStorage.removeItem(PROCESS_STATE_KEY); 
      } else {
        localStorageData = null; 
      }
    }
  } catch (error) {
    console.error("Error loading/parsing process state from localStorage:", error);
    if (typeof window !== 'undefined') localStorage.removeItem(PROCESS_STATE_KEY);
  }

  if (localStorageData) {
    resolvedState = { ...initialStoredProcessState, ...localStorageData };
    console.log("Using localStorage state as primary source for processId:", resolvedState.processId);
  } else if (activeId) {
    console.log("No valid localStorage state for activeId. Attempting to load from Firestore for processId:", activeId);
    const firestoreData = await loadStateFromFirestore(activeId);
    if (firestoreData) {
      resolvedState = { ...initialStoredProcessState, ...firestoreData, processId: activeId };
    } else {
      resolvedState = { ...initialStoredProcessState, processId: activeId };
       console.log("No data in Firestore. Starting fresh for processId:", activeId);
    }
  } else {
    resolvedState = { ...initialStoredProcessState, processId: null };
    console.log("No activeId or suitable localStorage. Starting with initial state.");
  }

  
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
  
  
  resolvedState = { ...initialStoredProcessState, ...resolvedState };


  if (typeof window !== 'undefined') {
    // Ensure no undefined values are written back to localStorage if they are problematic for Firestore
     const cleanedResolvedState = JSON.parse(JSON.stringify(resolvedState, (key, value) => {
        return (value === undefined ? null : value);
    }));
    localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(cleanedResolvedState));
  }

  return resolvedState;
}


export function clearProcessState() {
  try {
    const activeId = getActiveProcessId();
    if (activeId) {
      // Optionally, you could delete the inProgressContracts document from Firestore here
      // const docRef = doc(db, "inProgressContracts", activeId);
      // deleteDoc(docRef).then(() => console.log("In-progress Firestore doc deleted for", activeId))
      //   .catch(err => console.error("Error deleting in-progress Firestore doc:", err));
    }
    localStorage.removeItem(PROCESS_STATE_KEY);
    localStorage.removeItem(PRINT_DATA_KEY); 
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
    if (typeof window !== 'undefined') localStorage.removeItem(PRINT_DATA_KEY);
  }
  return null;
}

