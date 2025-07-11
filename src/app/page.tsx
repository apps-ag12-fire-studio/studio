
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { clearProcessState, setActiveProcessId, saveProcessState, initialStoredProcessState } from "@/lib/process-store";
import { db } from "@/lib/firebase";
import { collection, doc } from "firebase/firestore";

export default function HomePage() {
  const router = useRouter();

  const handleStartProcess = () => {
    clearProcessState(); // Limpa qualquer estado de processo anterior, incluindo activeProcessId

    const newProcessId = doc(collection(db, 'processos')).id; // Gera um ID único
    setActiveProcessId(newProcessId);

    const initialState = { 
      ...initialStoredProcessState, 
      processId: newProcessId, 
      currentStep: '/processo/dados-iniciais' 
    };
    
    saveProcessState(initialState); // Salva no localStorage e inicia salvamento no Firestore
    
    router.push("/processo/dados-iniciais");
  };

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-background p-6 sm:p-12 text-center selection:bg-primary/20">
      <div className="mb-4 text-6xl font-headline text-primary text-glow-gold uppercase tracking-wider">
        Contrato Fácil
      </div>
      <p className="mt-2 text-2xl text-muted-foreground font-headline">
        “O Código é Você.”
      </p>
      <p className="mt-4 text-lg text-foreground/80 max-w-xl mx-auto">
        Simplifique a gestão de seus contratos. Capture, analise com IA e anexe documentos de forma eficiente e exclusiva.
      </p>
      <Button 
        onClick={handleStartProcess}
        className="mt-12 bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-xl py-8 px-10 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
      >
        <Sparkles className="mr-3 h-7 w-7" />
        Iniciar Jornada Contratual
        <ArrowRight className="ml-3 h-7 w-7" />
      </Button>
    </div>
  );
}
