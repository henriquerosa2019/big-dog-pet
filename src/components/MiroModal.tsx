import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function openMiroModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bigdog_open_miro"));
}

export function MiroModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleOpen() {
      setIsOpen(true);
    }
    window.addEventListener("bigdog_open_miro", handleOpen);
    return () => window.removeEventListener("bigdog_open_miro", handleOpen);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] p-0 flex flex-col bg-background overflow-hidden border border-border shadow-2xl rounded-2xl sm:rounded-3xl">
        <DialogHeader className="px-4 py-3 border-b border-border/80 flex flex-row items-center justify-between space-y-0 shrink-0 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Quadro Miro de Testes · Homologação Ágil
              </DialogTitle>
              <p className="text-[11px] text-slate-400 font-medium">
                18 Casos de Teste (TC-01 a TC-18) · Ciclo Fechado Tutor ⇄ Loja ⇄ Motorista
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold gap-1.5 bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
            >
              <a href="/matriz_testes_miro.html" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Abrir em</span> Nova Aba
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 w-full h-full bg-slate-100 overflow-hidden relative">
          {isOpen && (
            <iframe
              src="/matriz_testes_miro.html"
              title="Quadro Miro de Testes da Big Dog Pet"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
