import { AlertTriangle, Clock, Sparkles, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";

interface TrialBannerProps {
  onOpenPlans: () => void;
}

export function TrialBanner({ onOpenPlans }: TrialBannerProps) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id, user?.email);
  const {
    isTrialActive,
    isExpiringSoon,
    isExpired,
    isBlocked,
    isSubscriber,
    daysRemaining,
  } = useTrialStatus();

  // Apenas o Dono do Petshop / Administrador em teste vê a barra de degustação do software
  // Se for o Master (bigdog@gmail.com) ou assinante ativo ou tutor comum, não exibe
  if (!user || !isAdmin || isSubscriber || user?.email?.toLowerCase() === "bigdog@gmail.com") {
    return null;
  }

  return (
    <div className="w-full">
      {/* CASO BLOQUEADO */}
      {isBlocked && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2.5 text-center text-xs sm:text-sm text-destructive font-bold flex flex-wrap items-center justify-center gap-2">
          <Ban className="size-4 shrink-0" />
          <span>O acesso do seu Petshop está temporariamente suspenso. Para reativar o sistema, regularize sua mensalidade.</span>
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
            <span>O período de teste de 7 dias do software para o seu Petshop expirou!</span>
          </span>
          <Button
            size="sm"
            onClick={onOpenPlans}
            className="h-7 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            Assinar Software via Mercado Pago →
          </Button>
        </div>
      )}

      {/* CASO 2: EXPIRA AMANHÃ (1 DIA ANTES / D-1) */}
      {!isBlocked && !isExpired && isExpiringSoon && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-950 dark:text-amber-200 font-semibold flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
            <span>Atenção: O período de teste de 7 dias do sistema do seu Petshop expira amanhã!</span>
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
            <span>Período de Degustação do Sistema: Restam <strong>{daysRemaining} dias</strong> de teste grátis na sua loja.</span>
          </span>
          <button
            type="button"
            onClick={onOpenPlans}
            className="underline font-bold hover:text-primary/80 cursor-pointer ml-1"
          >
            Ver Planos do Software
          </button>
        </div>
      )}
    </div>
  );
}
