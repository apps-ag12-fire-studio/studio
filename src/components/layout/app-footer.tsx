
"use client";

// import { useState, useEffect } from 'react'; // No longer needed as year is hardcoded

export function AppFooter() {
  // const [currentYear, setCurrentYear] = useState<number | null>(null); // Removed

  // useEffect(() => { // Removed
  //   setCurrentYear(new Date().getFullYear());
  // }, []);

  return (
    <footer className="w-full py-6 text-center text-xs text-muted-foreground border-t border-border/30 print-hidden">
      <p>© 2025 Financeiro Plataforma Internacional - Todos os direitos reservados.</p>
      <p className="mt-1">Uma solução SAAS com Inteligência Artificial em treinamento por CFO - Antônio Fogaça e Pablo Marçal.</p>
    </footer>
  );
}
