
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from '@/components/ui/scroll-area';

export interface FieldConfig {
  id: string;
  label: string;
  value: string; // Current value to prefill
  type?: string; // e.g., 'text', 'email', 'tel', 'number'
  placeholder?: string;
  required?: boolean;
}

interface EditInfoDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  dialogTitle: string;
  dialogDescription?: string;
  fieldsConfig: FieldConfig[];
  onSaveHandler: (updatedData: Record<string, string>) => void;
  initialData: Record<string, any> | null; // To prefill form on open
}

export function EditInfoDialog({
  isOpen,
  setIsOpen,
  dialogTitle,
  dialogDescription,
  fieldsConfig,
  onSaveHandler,
  initialData,
}: EditInfoDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && initialData) {
      const initialFormValues: Record<string, string> = {};
      fieldsConfig.forEach(field => {
        initialFormValues[field.id] = initialData[field.id]?.toString() || '';
      });
      setFormData(initialFormValues);
    } else if (!isOpen) {
      // Reset form data when dialog closes to avoid stale data on reopen
      setFormData({});
    }
  }, [isOpen, initialData, fieldsConfig]);

  const handleInputChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = () => {
    onSaveHandler(formData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[525px] bg-card border-border/70 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-2xl font-headline text-primary">{dialogTitle}</DialogTitle>
          {dialogDescription && <DialogDescription className="text-foreground/70">{dialogDescription}</DialogDescription>}
        </DialogHeader>
        
        <ScrollArea className="flex-grow overflow-y-auto p-6 pr-3"> {/* Adjusted padding for scrollbar */}
          <div className="space-y-6">
            {fieldsConfig.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-foreground/90 text-sm uppercase tracking-wider">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id={field.id}
                  type={field.type || 'text'}
                  value={formData[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder={field.placeholder || field.label}
                  className="bg-input border-border/70 focus:border-primary focus:ring-primary placeholder:text-muted-foreground/70 text-lg py-3"
                  required={field.required}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 pt-4 border-t border-border/50 flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="border-primary/80 text-primary hover:bg-primary/10">
              Cancelar
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            onClick={handleSave}
            className="bg-gradient-to-br from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-primary-foreground shadow-glow-gold"
          >
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
