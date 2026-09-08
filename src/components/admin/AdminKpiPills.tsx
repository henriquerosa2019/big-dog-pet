import { MessageCircle, Truck, Scissors, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdminKpiPillsProps {
  unreadChatCount: number;
  totalChatConversations: number;
  activeDeliveriesCount: number;
  todayServicesCount: number;
  inProgressServicesCount: number;
  waitingServicesCount?: number | undefined;
  completedServicesCount?: number | undefined;
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
  waitingServicesCount,
  completedServicesCount,
  pendingHealthAlertsCount,
  urgentHealthAlertsCount,
  criticalStockCount,
  currentTab,
  onSelectTab,
}: AdminKpiPillsProps) {
  const totalPendingAlerts = urgentHealthAlertsCount + criticalStockCount;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
      {/* 1. Chat & Comunicação - Alto contraste sem texto verde em fundo azul */}
      <button
        type="button"
        onClick={() => onSelectTab("comunicacao")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "comunicacao"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : unreadChatCount > 0
            ? "border-emerald-500/50 bg-card hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors font-bold",
              unreadChatCount > 0
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-primary/10 text-primary group-hover:bg-primary/20"
            )}
          >
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Chat Tutores
            </p>
            <p className="text-xs sm:text-sm font-extrabold font-display text-foreground truncate mt-0.5">
              {unreadChatCount > 0 ? (
                <span>
                  {unreadChatCount} nova{unreadChatCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground font-semibold">{totalChatConversations} conversas</span>
              )}
            </p>
          </div>
        </div>

        {unreadChatCount > 0 ? (
          <Badge className="bg-emerald-600 text-white font-extrabold text-[10px] px-2 py-0.5 shrink-0 shadow-xs animate-pulse">
            Nova
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
          currentTab === "hoje" && activeDeliveriesCount > 0
            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500/20"
            : currentTab === "hoje"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : activeDeliveriesCount > 0
            ? "border-sky-500/50 bg-card hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              activeDeliveriesCount > 0
                ? "bg-sky-600 text-white shadow-xs"
                : "bg-sky-500/10 text-sky-700 dark:text-sky-300 group-hover:bg-sky-500/20"
            )}
          >
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Delivery / Táxi
            </p>
            <p className="text-xs sm:text-sm font-extrabold font-display text-foreground truncate mt-0.5">
              {activeDeliveriesCount > 0 ? (
                <span>{activeDeliveriesCount} em rota</span>
              ) : (
                <span className="text-muted-foreground font-semibold">Sem rota ativa</span>
              )}
            </p>
          </div>
        </div>

        {activeDeliveriesCount > 0 ? (
          <Badge className="bg-sky-600 text-white border-0 text-[10px] font-extrabold px-1.5 py-0.5 shrink-0 shadow-xs">
            {activeDeliveriesCount}
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>

      {/* 3. Atendimentos do Dia (Fila Operacional) - Sincronizada com o Kanban */}
      <button
        type="button"
        onClick={() => onSelectTab("hoje")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "hoje"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : inProgressServicesCount > 0
            ? "border-violet-500/50 bg-card hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              inProgressServicesCount > 0
                ? "bg-violet-600 text-white shadow-xs"
                : "bg-violet-500/10 text-violet-700 dark:text-violet-300 group-hover:bg-violet-500/20"
            )}
          >
            <Scissors className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Fila Hoje
            </p>
            <p className="text-xs sm:text-sm font-extrabold font-display text-foreground truncate mt-0.5">
              {todayServicesCount > 0 ? (
                <span>
                  {todayServicesCount} atendimento{todayServicesCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground font-semibold">Sem atendimentos</span>
              )}
            </p>
          </div>
        </div>

        {inProgressServicesCount > 0 ? (
          <Badge className="bg-violet-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 shrink-0 shadow-xs">
            {inProgressServicesCount} ativo{inProgressServicesCount > 1 ? "s" : ""}
          </Badge>
        ) : todayServicesCount > 0 ? (
          <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0.5 shrink-0">
            {todayServicesCount}
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>

      {/* 4. Alertas de Saúde & Estoque Pendentes */}
      <button
        type="button"
        onClick={() => onSelectTab("saude")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "saude"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : totalPendingAlerts > 0
            ? "border-amber-500/50 bg-card hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              totalPendingAlerts > 0
                ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                : "bg-muted text-muted-foreground group-hover:bg-muted/80"
            )}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Saúde / Atrasos
            </p>
            <p className="text-xs sm:text-sm font-extrabold font-display text-foreground truncate mt-0.5">
              {totalPendingAlerts > 0 ? (
                <span>
                  {totalPendingAlerts} pendente{totalPendingAlerts > 1 ? "s" : ""}
                </span>
              ) : pendingHealthAlertsCount > 0 ? (
                <span className="text-muted-foreground font-semibold">{pendingHealthAlertsCount} previstos</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Em dia</span>
              )}
            </p>
          </div>
        </div>

        {totalPendingAlerts > 0 ? (
          <Badge className="bg-amber-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 shrink-0 shadow-xs">
            Ação
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>
    </div>
  );
}
