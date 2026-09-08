import { MessageCircle, Truck, Scissors, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdminKpiPillsProps {
  unreadChatCount: number;
  totalChatConversations: number;
  activeDeliveriesCount: number;
  todayServicesCount: number;
  inProgressServicesCount: number;
  pendingHealthAlertsCount: number;
  urgentHealthAlertsCount: number;
  criticalStockCount: number;
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export function AdminKpiPills({
  unreadChatCount,
  totalChatConversations,
  activeDeliveriesCount,
  todayServicesCount,
  inProgressServicesCount,
  pendingHealthAlertsCount,
  urgentHealthAlertsCount,
  criticalStockCount,
  currentTab,
  onSelectTab,
}: AdminKpiPillsProps) {
  const totalPendingAlerts = urgentHealthAlertsCount + criticalStockCount;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
      {/* 1. Chat & Comunicação */}
      <button
        type="button"
        onClick={() => onSelectTab("comunicacao")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "comunicacao"
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
            : unreadChatCount > 0
            ? "border-emerald-500/40 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              unreadChatCount > 0
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-primary/10 text-primary group-hover:bg-primary/20"
            )}
          >
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Chat Tutores
            </p>
            <p className="text-xs sm:text-sm font-bold font-display text-foreground truncate mt-0.5">
              {unreadChatCount > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {unreadChatCount} nova{unreadChatCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span>{totalChatConversations} chamados</span>
              )}
            </p>
          </div>
        </div>

        {unreadChatCount > 0 ? (
          <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0 shrink-0 animate-pulse">
            Novo
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>

      {/* 2. Delivery & Transportes */}
      <button
        type="button"
        onClick={() => onSelectTab("hoje")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "hoje"
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
            : activeDeliveriesCount > 0
            ? "border-sky-500/40 bg-sky-500/[0.04] hover:bg-sky-500/[0.08]"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              activeDeliveriesCount > 0
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500/20"
            )}
          >
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Delivery / Táxi
            </p>
            <p className="text-xs sm:text-sm font-bold font-display text-foreground truncate mt-0.5">
              {activeDeliveriesCount > 0 ? (
                <span className="text-sky-600 dark:text-sky-400 font-bold">
                  {activeDeliveriesCount} em rota
                </span>
              ) : (
                <span className="text-muted-foreground">Nenhum em rota</span>
              )}
            </p>
          </div>
        </div>

        {activeDeliveriesCount > 0 && (
          <Badge variant="outline" className="text-sky-600 dark:text-sky-400 border-sky-500/40 text-[9px] font-bold px-1.5 py-0 shrink-0">
            {activeDeliveriesCount}
          </Badge>
        )}
      </button>

      {/* 3. Atendimentos do Dia (Fila) */}
      <button
        type="button"
        onClick={() => onSelectTab("hoje")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "hoje"
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
            : inProgressServicesCount > 0
            ? "border-violet-500/40 bg-violet-500/[0.04] hover:bg-violet-500/[0.08]"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              inProgressServicesCount > 0
                ? "bg-violet-600 text-white shadow-xs"
                : "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20"
            )}
          >
            <Scissors className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Fila Hoje
            </p>
            <p className="text-xs sm:text-sm font-bold font-display text-foreground truncate mt-0.5">
              {todayServicesCount > 0 ? (
                <span>
                  {todayServicesCount} agendado{todayServicesCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Sem serviços</span>
              )}
            </p>
          </div>
        </div>

        {inProgressServicesCount > 0 && (
          <Badge className="bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0 shrink-0">
            {inProgressServicesCount} ativo{inProgressServicesCount > 1 ? "s" : ""}
          </Badge>
        )}
      </button>

      {/* 4. Alertas de Saúde & Estoque Pendentes */}
      <button
        type="button"
        onClick={() => onSelectTab("saude")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "saude"
            ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
            : totalPendingAlerts > 0
            ? "border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              totalPendingAlerts > 0
                ? "bg-amber-500 text-amber-950 font-black shadow-xs"
                : "bg-muted text-muted-foreground group-hover:bg-muted/80"
            )}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Saúde / Atrasos
            </p>
            <p className="text-xs sm:text-sm font-bold font-display text-foreground truncate mt-0.5">
              {totalPendingAlerts > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {totalPendingAlerts} pendente{totalPendingAlerts > 1 ? "s" : ""}
                </span>
              ) : pendingHealthAlertsCount > 0 ? (
                <span>{pendingHealthAlertsCount} previstos</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Em dia</span>
              )}
            </p>
          </div>
        </div>

        {totalPendingAlerts > 0 ? (
          <Badge className="bg-amber-500 text-amber-950 text-[9px] font-black px-1.5 py-0 shrink-0">
            Ação
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>
    </div>
  );
}
