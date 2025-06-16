

"use client";

import { useState, useEffect } from 'react';

export function AppFooter() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="w-full py-6 text-center text-xs text-muted-foreground border-t border-border/30 print-hidden">
      {currentYear !== null ? (
        <p>© {currentYear} Financeiro Pablo Marçal - Todos os direitos reservados.</p>
      ) : (
        // Fallback or loading state, you can also use a skeleton loader here if preferred
        <p>© Financeiro Pablo Marçal - Todos os direitos reservados.</p>
      )}
      <p className="mt-1">Uma solução SAAS com Inteligência Artificial treinada por CFO - Antônio Fogaça.</p>
    </footer>
  );
}

