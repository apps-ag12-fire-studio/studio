
"use client";

import { Button } from "@/components/ui/button";
import { Users, Banknote, Scale, FileText, LifeBuoy, Laptop } from "lucide-react"; // Added Laptop

export default function ProcessoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const suporteItems = [
    {label: "Time de Vendas", icon: Users},
    {label: "Financeiro", icon: Banknote},
    {label: "Jurídico", icon: Scale},
    {label: "Contratual", icon: FileText},
    {label: "Setor de Tecnologia", icon: Laptop}, // Added Setor de Tecnologia
    {label: "Suporte Geral", icon: LifeBuoy}
  ];

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col items-center justify-start bg-background p-6 sm:p-12 selection:bg-primary/20">
      <div className="w-full max-w-3xl space-y-10">
        {children}
        <footer className="text-center py-12 mt-10 border-t border-border/30 print-hidden">
            <div className="mb-8">
                <h3 className="text-lg font-headline text-primary mb-4 uppercase tracking-wider">Precisa de Ajuda?</h3>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                    {suporteItems.map(item => (
                        <Button 
                          key={item.label} 
                          variant="outline" 
                          asChild 
                          className="text-foreground/80 hover:text-primary hover:border-primary/70 bg-card/70 border-border/50 hover:bg-card text-xs sm:text-sm rounded-lg py-2 px-3 sm:py-3 sm:px-4 transition-all hover:shadow-md"
                        >
                            <a href="#" className="flex items-center justify-center"> 
                              <item.icon className="mr-1 sm:mr-2 h-4 w-4 flex-shrink-0" /> 
                              <span className="whitespace-normal text-center leading-tight">{item.label}</span>
                            </a>
                        </Button>
                    ))}
                </div>
            </div>
        </footer>
      </div>
    </div>
  );
}
