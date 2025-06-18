
"use client";

import { useState, useEffect } from 'react';
import { AppFooter } from './app-footer';
import { loadProcessState } from '@/lib/process-store'; // To get active processId indirectly or directly

// Helper function to get active process ID from localStorage directly
// This avoids loading the entire state if only the ID is needed for the footer.
const getActiveProcessIdFromLocalStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('contratoFacilActiveProcessId_v1');
  }
  return null;
};

export function FooterWrapper() {
  const [processId, setProcessId] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to get the processId directly from its dedicated localStorage key first
    const activeId = getActiveProcessIdFromLocalStorage();
    if (activeId) {
      setProcessId(activeId);
    } else {
      // Fallback: if the direct key is not set, try loading the full state
      // This might happen if a process was started but the activeId key wasn't set,
      // or if we want to ensure consistency with the full state's processId.
      // However, for just the footer, the direct key is more efficient.
      // For now, we'll stick to the direct key for simplicity in the footer.
      // If more complex logic is needed, `loadProcessState` could be used carefully.
      // Example using loadProcessState (more resource-intensive for just ID):
      /*
      loadProcessState().then(state => {
        if (state && state.processId) {
          setProcessId(state.processId);
        }
      });
      */
    }

    // Optional: Listen for changes to the activeProcessId if needed,
    // though for a footer, a one-time load is usually sufficient.
    const handleStorageChange = () => {
        const updatedActiveId = getActiveProcessIdFromLocalStorage();
        setProcessId(updatedActiveId);
    };

    window.addEventListener('storage', handleStorageChange); // For changes in other tabs
    
    // Custom event listener if setActiveProcessId dispatches one
    const handleProcessIdChange = (event: Event) => {
        const customEvent = event as CustomEvent<string | null>;
        setProcessId(customEvent.detail);
    };
    window.addEventListener('activeProcessIdChanged', handleProcessIdChange);


    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('activeProcessIdChanged', handleProcessIdChange);
    };

  }, []);

  return <AppFooter processId={processId} />;
}
