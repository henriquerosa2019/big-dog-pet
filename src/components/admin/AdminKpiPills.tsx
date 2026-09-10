import { CalendarClock, MessageCircle, Truck, Scissors, AlertTriangle, ChevronRight, Check } from "lucide-react";
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
  const waitingCount = waitingServicesCount ?? 0;
  const completedCount = completedServicesCount ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
      {/* 1. Agendamentos - Sinaliza novos pedidos e leva para Confirmar Agendamento */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (onNavigateToAgenda) {
            onNavigateToAgenda();
          } else {
            onSelectTab("gestao");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onNavigateToAgenda) onNavigateToAgenda();
            else onSelectTab("gestao");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-2xl p-3 sm:p-3.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          currentTab === "gestao"
            ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 ring-2 ring-amber-400/40"
            : pendingCount > 0
            ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-400/30 hover:bg-amber-100/70 dark:hover:bg-amber-950/60"
            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-2.5">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors font-bold",
              pendingCount > 0
                ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 group-hover:bg-amber-500/20"
            )}
          >
            <CalendarClock className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>

          {pendingCount > 0 ? (
            <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 shrink-0 shadow-xs animate-pulse">
              Aprovar ({pendingCount})
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" /> Em dia
            </span>
          )}
        </div>

        <div className="space-y-0.5 min-w-0 w-full">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Agendamentos
          </p>
          <p className="text-sm sm:text-base font-extrabold font-display text-foreground leading-snug">
            {pendingCount > 0 ? (
              <span className="text-amber-950 dark:text-amber-200">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            ) : (
              <span>Tudo em dia</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {pendingCount > 0 ? "Requer confirmação" : "Nenhum pedido pendente"}
          </p>
        </div>
      </div>

      {/* 2. Chat & Comunicação - Alto contraste sem texto verde em fundo azul */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectTab("comunicacao")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectTab("comunicacao");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-2xl p-3 sm:p-3.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          currentTab === "comunicacao"
            ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-400/40"
            : unreadChatCount > 0
            ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 ring-2 ring-emerald-400/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60 animate-pulse"
            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-2.5">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors font-bold",
              unreadChatCount > 0
                ? "bg-emerald-600 text-white shadow-xs animate-pulse"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 group-hover:bg-emerald-500/20"
            )}
          >
            <MessageCircle className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>

          {unreadChatCount > 0 ? (
            <Badge className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 shrink-0 shadow-xs animate-pulse">
              ● {unreadChatCount} nova{unreadChatCount > 1 ? "s" : ""}
            </Badge>
          ) : totalChatConversations > 0 ? (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              {totalChatConversations} aberta{totalChatConversations > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" /> Lido
            </span>
          )}
        </div>

        <div className="space-y-0.5 min-w-0 w-full">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Chat Tutores
          </p>
          <p className="text-sm sm:text-base font-extrabold font-display text-foreground leading-snug">
            {unreadChatCount > 0 ? (
              <span className="text-emerald-950 dark:text-emerald-200">
                {unreadChatCount} nova{unreadChatCount > 1 ? "s" : ""}
              </span>
            ) : totalChatConversations > 0 ? (
              <span>{totalChatConversations} em aberto</span>
            ) : (
              <span>Sem novas mensagens</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {unreadChatCount > 0 ? "Resposta de tutor pendente" : "Atendimento aos tutores"}
          </p>
        </div>
      </div>

      {/* 3. Delivery & Táxi Pet */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectTab("hoje")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectTab("hoje");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-2xl p-3 sm:p-3.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          inRouteCount > 0
            ? "border-sky-500 bg-sky-50/70 dark:bg-sky-950/30 ring-2 ring-sky-400/40"
            : activeDeliveriesCount > 0
            ? "border-sky-300/80 dark:border-sky-800 bg-card hover:bg-sky-50/40 dark:hover:bg-sky-950/20"
            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-2.5">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              inRouteCount > 0
                ? "bg-sky-600 text-white shadow-xs animate-pulse"
                : "bg-sky-500/10 text-sky-700 dark:text-sky-300 group-hover:bg-sky-500/20"
            )}
          >
            <Truck className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>

          {inRouteCount > 0 ? (
            <Badge className="bg-sky-600 text-white font-black text-[10px] px-2 py-0.5 shrink-0 shadow-xs animate-pulse">
              ● Em rota ({inRouteCount})
            </Badge>
          ) : activeDeliveriesCount > 0 ? (
            <Badge variant="secondary" className="bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 font-bold text-[10px] px-2 py-0.5 shrink-0">
              {activeDeliveriesCount} hoje
            </Badge>
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              0 hoje
            </span>
          )}
        </div>

        <div className="space-y-0.5 min-w-0 w-full">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Transporte & Táxi
          </p>
          <p className="text-sm sm:text-base font-extrabold font-display text-foreground leading-snug">
            {inRouteCount > 0 ? (
              <span className="text-sky-950 dark:text-sky-200">{inRouteCount} em rota agora</span>
            ) : activeDeliveriesCount > 0 ? (
              <span>{activeDeliveriesCount} agendado{activeDeliveriesCount > 1 ? "s" : ""} hoje</span>
            ) : todayTaxiTotal > 0 ? (
              <span>{todayTaxiTotal} concluído{todayTaxiTotal > 1 ? "s" : ""}</span>
            ) : (
              <span>Sem corridas hoje</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {inRouteCount > 0
              ? "Motorista a caminho"
              : activeDeliveriesCount > 0
              ? "Leva e traz programado"
              : "Leva e traz do petshop"}
          </p>
        </div>
      </div>

      {/* 4. Atendimentos do Dia (Fila Operacional / Kanban) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectTab("hoje")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectTab("hoje");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-2xl p-3 sm:p-3.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          currentTab === "hoje"
            ? "border-violet-500 bg-violet-50/60 dark:bg-violet-950/30 ring-2 ring-violet-400/40"
            : inProgressServicesCount > 0
            ? "border-violet-500/60 bg-card hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-2.5">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              inProgressServicesCount > 0
                ? "bg-violet-600 text-white shadow-xs"
                : "bg-violet-500/10 text-violet-700 dark:text-violet-300 group-hover:bg-violet-500/20"
            )}
          >
            <Scissors className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>

          {inProgressServicesCount > 0 ? (
            <Badge className="bg-violet-600 text-white font-black text-[10px] px-2 py-0.5 shrink-0 shadow-xs">
              ● {inProgressServicesCount} no banho
            </Badge>
          ) : waitingCount > 0 ? (
            <Badge variant="outline" className="text-amber-800 dark:text-amber-200 border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/30 text-[10px] font-bold px-2 py-0.5 shrink-0">
              {waitingCount} aguardando
            </Badge>
          ) : todayServicesCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" /> Finalizados
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              Fila livre
            </span>
          )}
        </div>

        <div className="space-y-0.5 min-w-0 w-full">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Fila de Atendimento
          </p>
          <p className="text-sm sm:text-base font-extrabold font-display text-foreground leading-snug">
            {inProgressServicesCount > 0 ? (
              <span className="text-violet-950 dark:text-violet-200">
                {inProgressServicesCount} em andamento
              </span>
            ) : waitingCount > 0 ? (
              <span>{waitingCount} na espera</span>
            ) : todayServicesCount > 0 ? (
              <span>{todayServicesCount} agendado{todayServicesCount > 1 ? "s" : ""} hoje</span>
            ) : (
              <span>Fila vazia hoje</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {todayServicesCount > 0
              ? `${waitingCount} aguardando · ${completedCount} prontos`
              : "Banho, tosa e estética"}
          </p>
        </div>
      </div>

      {/* 5. Alertas de Saúde & Retornos Preventivos */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectTab("saude")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectTab("saude");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-2xl p-3 sm:p-3.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md col-span-2 sm:col-span-1 lg:col-span-1 select-none",
          currentTab === "saude"
            ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 ring-2 ring-rose-400/40"
            : urgentPets > 0
            ? "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-400/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/60"
            : totalPendingAlerts > 0
            ? "border-amber-500/60 bg-card hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-2.5">
          <div
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-xl transition-colors",
              urgentPets > 0
                ? "bg-rose-600 text-white font-black shadow-xs animate-pulse"
                : totalPendingAlerts > 0
                ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 group-hover:bg-rose-500/20"
            )}
          >
            <AlertTriangle className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>

          {urgentPets > 0 ? (
            <Badge className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 shrink-0 shadow-xs animate-pulse">
              ● {urgentPets} em atraso
            </Badge>
          ) : pendingHealthAlertsCount > 0 ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold text-[10px] px-2 py-0.5 shrink-0">
              {pendingHealthAlertsCount} previstos
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" /> Em dia
            </span>
          )}
        </div>

        <div className="space-y-0.5 min-w-0 w-full">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Saúde & Alertas
          </p>
          <p className="text-sm sm:text-base font-extrabold font-display text-foreground leading-snug">
            {urgentPets > 0 ? (
              <span className="text-rose-950 dark:text-rose-200">
                {urgentPets} pet{urgentPets > 1 ? "s" : ""} com atraso
              </span>
            ) : pendingHealthAlertsCount > 0 ? (
              <span>{pendingHealthAlertsCount} retorno{pendingHealthAlertsCount > 1 ? "s" : ""} previsto{pendingHealthAlertsCount > 1 ? "s" : ""}</span>
            ) : (
              <span>Vacinas e saúde em dia</span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {urgentPets > 0
              ? "Vacina ou retorno pendente"
              : criticalStockCount > 0
              ? `${criticalStockCount} item(ns) em estoque crítico`
              : "Controle preventivo"}
          </p>
        </div>
      </div>
    </div>
  );
}
