
"use client";

interface AppFooterProps {
  processId?: string | null;
}

export function AppFooter({ processId }: AppFooterProps) {
  return (
    <footer className="w-full py-6 text-center text-xs text-muted-foreground border-t border-border/30 print-hidden">
      <p>© 2025 International Platform Financial - All rights reserved.</p>
      <p className="mt-1">A SAAS Solution with Artificial Intelligence in Excellence training by Pablo Marçal and Antônio Fogaça.</p>
      {processId && (
        <p className="mt-2 text-primary/80">Current Process ID: {processId}</p>
      )}
    </footer>
  );
}
