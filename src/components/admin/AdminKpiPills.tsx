import { CalendarClock, MessageCircle, Truck, Scissors, AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdminKpiPillsProps {
  pendingAppointmentsCount?: number | undefined;
  onNavigateToAgenda?: (() => void) | undefined;
  unreadChatCount: number;
  totalChatConversations: number;
  activeDeliveriesCount: number;
  todayTaxiCount?: number | undefined;
  inRouteDeliveriesCount?: number | undefined;
  todayServicesCount: number;
  inProgressServicesCount: number;
  waitingServicesCount?: number | undefined;
  completedServicesCount?: number | undefined;
  pendingHealthAlertsCount: number;
  urgentHealthAlertsCount: number;
  urgentHealthPetsCount?: number | undefined;
  criticalStockCount: number;
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export function AdminKpiPills({
  pendingAppointmentsCount,
  onNavigateToAgenda,
  unreadChatCount,
  totalChatConversations,
  activeDeliveriesCount,
  todayTaxiCount,
  inRouteDeliveriesCount,
  todayServicesCount,
  inProgressServicesCount,
  waitingServicesCount,
  completedServicesCount,
  pendingHealthAlertsCount,
  urgentHealthAlertsCount,
  urgentHealthPetsCount,
  criticalStockCount,
  currentTab,
  onSelectTab,
}: AdminKpiPillsProps) {
  const inRouteCount = inRouteDeliveriesCount ?? 0;
  const todayTaxiTotal = todayTaxiCount ?? activeDeliveriesCount;
  const urgentPets = urgentHealthPetsCount ?? (urgentHealthAlertsCount > 0 ? urgentHealthAlertsCount : 0);
  const totalPendingAlerts = urgentPets + criticalStockCount;
  const pendingCount = pendingAppointmentsCount ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
      {/* 1. Agendamentos - Sinaliza novos pedidos e leva para Confirmar Agendamento */}
      <button
        type="button"
        onClick={() => {
          if (onNavigateToAgenda) {
            onNavigateToAgenda();
          } else {
            onSelectTab("gestao");
          }
        }}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "gestao"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : pendingCount > 0
            ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 ring-2 ring-amber-400/30 hover:bg-amber-100/60 dark:hover:bg-amber-950/45"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors font-bold",
              pendingCount > 0
                ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                : "bg-primary/10 text-primary group-hover:bg-primary/20"
            )}
          >
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              Agendamentos
            </p>
            <p className="text-xs sm:text-sm font-extrabold font-display text-foreground truncate mt-0.5">
              {pendingCount > 0 ? (
                <span className="text-amber-950 dark:text-amber-200">
                  {pendingCount} novo{pendingCount > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground font-semibold">Em dia</span>
              )}
            </p>
          </div>
        </div>

        {pendingCount > 0 ? (
          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 shrink-0 shadow-xs animate-pulse">
            Confirmar ({pendingCount})
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>

      {/* 2. Chat & Comunicação - Alto contraste sem texto verde em fundo azul */}
      <button
        type="button"
        onClick={() => onSelectTab("comunicacao")}
        className={cn(
          "flex items-center justify-between gap-2 rounded-2xl p-2.5 sm:p-3 text-left transition-all border shadow-xs cursor-pointer group",
          currentTab === "comunicacao"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : unreadChatCount > 0
            ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-400/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60 animate-pulse"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors font-bold",
              unreadChatCount > 0
                ? "bg-emerald-600 text-white shadow-xs animate-pulse"
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
                <span className="text-emerald-950 dark:text-emerald-200">
                  {unreadChatCount} nova{unreadChatCount > 1 ? "s" : ""}
                </span>
              ) : totalChatConversations > 0 ? (
                <span className="text-muted-foreground font-semibold">
                  {totalChatConversations} aberta{totalChatConversations > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground font-semibold">Sem novos</span>
              )}
            </p>
          </div>
        </div>

        {unreadChatCount > 0 ? (
          <Badge className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 shrink-0 shadow-xs animate-pulse">
            {unreadChatCount} nova{unreadChatCount > 1 ? "s" : ""}
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
          currentTab === "hoje" && inRouteCount > 0
            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 ring-2 ring-sky-500/20"
            : currentTab === "hoje"
            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
            : inRouteCount > 0
            ? "border-sky-500/50 bg-card hover:bg-sky-50/50 dark:hover:bg-sky-950/20"
            : "border-border/70 bg-card hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              inRouteCount > 0
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
              {inRouteCount > 0 ? (
                <span>{inRouteCount} em rota</span>
              ) : activeDeliveriesCount > 0 ? (
                <span>{activeDeliveriesCount} agendado{activeDeliveriesCount > 1 ? "s" : ""} hoje</span>
              ) : todayTaxiTotal > 0 ? (
                <span>{todayTaxiTotal} concluído{todayTaxiTotal > 1 ? "s" : ""}</span>
              ) : (
                <span className="text-muted-foreground font-semibold">Sem táxi hoje</span>
              )}
            </p>
          </div>
        </div>

        {inRouteCount > 0 ? (
          <Badge className="bg-sky-600 text-white border-0 text-[10px] font-extrabold px-1.5 py-0.5 shrink-0 shadow-xs animate-pulse">
            {inRouteCount} em rota
          </Badge>
        ) : activeDeliveriesCount > 0 ? (
          <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-0 text-[10px] font-bold px-1.5 py-0.5 shrink-0">
            {activeDeliveriesCount} hoje
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
            {todayServicesCount > 0 && (
              <p className="text-[10px] text-muted-foreground truncate font-medium">
                {waitingServicesCount ?? 0} aguardando · {completedServicesCount ?? 0} prontos
              </p>
            )}
          </div>
        </div>

        {inProgressServicesCount > 0 ? (
          <Badge className="bg-violet-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 shrink-0 shadow-xs">
            {inProgressServicesCount} em andamento
          </Badge>
        ) : waitingServicesCount && waitingServicesCount > 0 ? (
          <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 shrink-0 text-amber-600 border-amber-500/40">
            {waitingServicesCount} aguardando
          </Badge>
        ) : todayServicesCount > 0 ? (
          <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0.5 shrink-0 text-emerald-600">
            Concluído
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
              {urgentPets > 0 ? (
                <span>
                  {urgentPets} pet{urgentPets > 1 ? "s" : ""} em atraso
                </span>
              ) : pendingHealthAlertsCount > 0 ? (
                <span className="text-muted-foreground font-semibold">{pendingHealthAlertsCount} previstos</span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Em dia</span>
              )}
            </p>
          </div>
        </div>

        {urgentHealthAlertsCount > 0 ? (
          <Badge className="bg-amber-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 shrink-0 shadow-xs">
            {urgentHealthAlertsCount} {urgentHealthAlertsCount > 1 ? "avisos" : "aviso"}
          </Badge>
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>
    </div>
  );
}
