
"use client";

import { useState, useEffect } from 'react';
import { AppFooter } from './app-footer';

const getActiveProcessIdFromLocalStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('contratoFacilActiveProcessId_v1');
  }
  return null;
};

export function FooterWrapper() {
  const [processId, setProcessId] = useState<string | null>(null);

  useEffect(() => {
    const activeId = getActiveProcessIdFromLocalStorage();
    if (activeId) {
      setProcessId(activeId);
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'contratoFacilActiveProcessId_v1') {
        setProcessId(event.newValue);
      }
    };

    const handleProcessIdChange = (event: Event) => {
        const customEvent = event as CustomEvent<string | null>;
        setProcessId(customEvent.detail);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('activeProcessIdChanged', handleProcessIdChange);


    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('activeProcessIdChanged', handleProcessIdChange);
    };

  }, []);

  return <AppFooter processId={processId} />;
}
