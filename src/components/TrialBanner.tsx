import { AlertTriangle, Clock, PackageCheck, Sparkles, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrialStatus } from "@/hooks/useTrialStatus";

interface TrialBannerProps {
  onOpenPlans: () => void;
}

export function TrialBanner({ onOpenPlans }: TrialBannerProps) {
  const {
    isTrialActive,
    isExpiringSoon,
    isExpired,
    isBlocked,
    isSubscriber,
    daysRemaining,
    isAdmin,
  } = useTrialStatus();

  if (isAdmin || isSubscriber) {
    return null;
  }

  return (
    <div className="w-full">
      {/* CASO BLOQUEADO */}
      {isBlocked && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2.5 text-center text-xs sm:text-sm text-destructive font-bold flex flex-wrap items-center justify-center gap-2">
          <Ban className="size-4 shrink-0" />
          <span>Sua conta está temporariamente suspensa. Para reativar o acesso aos serviços, regularize seu plano.</span>
          <Button
            size="sm"
            onClick={onOpenPlans}
            variant="destructive"
            className="h-7 rounded-lg text-xs font-bold cursor-pointer"
          >
            Ver Planos Mercado Pago
          </Button>
        </div>
      )}

      {/* CASO 1: EXPIRADO (DIA 7+) */}
      {!isBlocked && isExpired && (
        <div className="bg-red-500/15 border-b border-red-500/30 px-4 py-2.5 text-center text-xs sm:text-sm text-red-950 dark:text-red-200 font-semibold flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>Seu período de teste grátis de 7 dias expirou!</span>
          </span>
          <Button
            size="sm"
            onClick={onOpenPlans}
            className="h-7 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            Pagar com Mercado Pago →
          </Button>
        </div>
      )}

      {/* CASO 2: EXPIRA AMANHÃ (1 DIA ANTES / D-1) */}
      {!isBlocked && !isExpired && isExpiringSoon && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-950 dark:text-amber-200 font-semibold flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
            <span>Atenção: Seu período de teste grátis de 7 dias expira amanhã!</span>
          </span>
          <Button
            size="sm"
            onClick={onOpenPlans}
            className="h-7 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            Assinar via Mercado Pago →
          </Button>
        </div>
      )}

      {/* CASO 3: TESTE ATIVO COM DIAS RESTANTES */}
      {!isBlocked && !isExpired && !isExpiringSoon && isTrialActive && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-xs text-primary font-semibold flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Degustação Ativa: Restam <strong>{daysRemaining} dias</strong> de teste grátis no app.</span>
          </span>
          <button
            type="button"
            onClick={onOpenPlans}
            className="underline font-bold hover:text-primary/80 cursor-pointer ml-1"
          >
            Ver Planos Mercado Pago
          </button>
        </div>
      )}
    </div>
  );
}
