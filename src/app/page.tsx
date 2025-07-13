
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
    // Forcefully clear any previous state to ensure a clean start
    clearProcessState(); 

    const newProcessId = doc(collection(db, 'processos')).id; 
    setActiveProcessId(newProcessId);

    const initialState = { 
      ...initialStoredProcessState, 
      processId: newProcessId, 
      currentStep: '/processo/dados-iniciais' 
    };
    
    // Save the very initial clean state
    saveProcessState(initialState); 
    
    router.push("/processo/dados-iniciais");
  };

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-center bg-background p-6 sm:p-12 text-center selection:bg-primary/20">
      <div className="mb-4 text-6xl font-headline text-primary text-glow-gold uppercase tracking-wider">
        Easy Contract
      </div>
      <p className="mt-2 text-2xl text-muted-foreground font-headline">
        "The Code is You."
      </p>
      <p className="mt-4 text-lg text-foreground/80 max-w-xl mx-auto">
        Simplify your contract management. Capture, analyze with AI, and attach documents efficiently and exclusively.
      </p>
      <Button 
        onClick={handleStartProcess}
        className="mt-12 bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-xl py-8 px-10 rounded-lg text-primary-foreground shadow-glow-gold transition-all duration-300 ease-in-out transform hover:scale-105"
      >
        <Sparkles className="mr-3 h-7 w-7" />
        Start Contract Journey
        <ArrowRight className="ml-3 h-7 w-7" />
      </Button>
    </div>
  );
}
