import React from "react";
import {
  CalendarClock,
  MessageCircle,
  Truck,
  Scissors,
  Check,
  ShoppingBag,
  Clock,
  Car,
} from "lucide-react";
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
  pendingHealthAlertsCount?: number | undefined;
  urgentHealthAlertsCount?: number | undefined;
  urgentHealthPetsCount?: number | undefined;
  criticalStockCount: number;
  pendingOrdersCount?: number | undefined;
  todayOrdersCount?: number | undefined;
  onNavigateToOrders?: (() => void) | undefined;
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
  pendingOrdersCount,
  todayOrdersCount,
  onNavigateToOrders,
  currentTab,
  onSelectTab,
}: AdminKpiPillsProps) {
  const inRouteCount = inRouteDeliveriesCount ?? 0;
  const todayTaxiTotal = todayTaxiCount ?? activeDeliveriesCount;
  const pendingCount = pendingAppointmentsCount ?? 0;
  const waitingCount = waitingServicesCount ?? 0;
  const completedCount = completedServicesCount ?? 0;
  const pendingOrders = pendingOrdersCount ?? 0;
  const todayOrders = todayOrdersCount ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
      {/* 1. AGENDAMENTOS - Destaque em Verde Escuro Nobre (Fiel à Imagem 1) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (onNavigateToAgenda) onNavigateToAgenda();
          else onSelectTab("gestao");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onNavigateToAgenda) onNavigateToAgenda();
            else onSelectTab("gestao");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-3xl p-4 sm:p-4.5 text-left transition-all duration-200 shadow-md cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg select-none relative overflow-hidden",
          "bg-[#0c4a34] text-white border border-emerald-700/50"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-3">
          <div className="h-10 w-10 shrink-0 place-items-center grid rounded-2xl bg-white/15 text-white shadow-xs backdrop-blur-xs">
            <CalendarClock className="h-5 w-5" />
          </div>

          {pendingCount > 0 ? (
            <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
              Aprovar ({pendingCount})
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
              <Check className="h-3 w-3 stroke-[3]" /> Em dia
            </span>
          )}
        </div>

        <div className="space-y-1 min-w-0 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100/70">
            AGENDAMENTOS
          </p>
          <p className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
            {pendingCount > 0 ? `${pendingCount} pendente(s)` : "Tudo em dia"}
          </p>
          <p className="text-[11px] text-emerald-100/80 font-medium leading-none pt-0.5 truncate">
            {pendingCount > 0 ? "Requer confirmação" : "Nenhum pedido pendente"}
          </p>
        </div>
      </div>

      {/* 2. CHAT TUTORES - Card Branco Clean com Ícone Verde Menta */}
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
          "flex flex-col justify-between rounded-3xl p-4 sm:p-4.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          "bg-white dark:bg-card border-border/80 text-foreground"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-3">
          <div className="h-10 w-10 shrink-0 place-items-center grid rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
            <MessageCircle className="h-5 w-5" />
          </div>

          {unreadChatCount > 0 ? (
            <Badge className="bg-rose-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
              ● {unreadChatCount} nova(s)
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
              <Check className="h-3 w-3 stroke-[3]" /> Lido
            </span>
          )}
        </div>

        <div className="space-y-1 min-w-0 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            CHAT TUTORES
          </p>
          <p className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">
            {unreadChatCount > 0 ? `${unreadChatCount} nova(s)` : "Sem novas mensagens"}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {unreadChatCount > 0 ? "Resposta de tutor pendente" : "Atendimento aos tutores"}
          </p>
        </div>
      </div>

      {/* 3. TRANSPORTE & TÁXI - Card Branco Clean com Ícone Azul */}
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
          "flex flex-col justify-between rounded-3xl p-4 sm:p-4.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          "bg-white dark:bg-card border-border/80 text-foreground"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-3">
          <div className="h-10 w-10 shrink-0 place-items-center grid rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40">
            <Truck className="h-5 w-5" />
          </div>

          {inRouteCount > 0 ? (
            <Badge className="bg-sky-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
              ● Em rota ({inRouteCount})
            </Badge>
          ) : (
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-0.5 rounded-full border border-sky-200/50">
              {activeDeliveriesCount} hoje
            </span>
          )}
        </div>

        <div className="space-y-1 min-w-0 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            TRANSPORTE & TÁXI
          </p>
          <p className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">
            {inRouteCount > 0
              ? `${inRouteCount} em rota agora`
              : activeDeliveriesCount > 0
              ? `${activeDeliveriesCount} agendado(s) hoje`
              : "Sem corridas hoje"}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {inRouteCount > 0 ? "Motorista a caminho" : "Leva e traz do petshop"}
          </p>
        </div>
      </div>

      {/* 4. FILA DE ATENDIMENTO - Card Bege Suave com Ícone Verde Água (Fiel à Imagem 1) */}
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
          "flex flex-col justify-between rounded-3xl p-4 sm:p-4.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          "bg-[#fef8eb] dark:bg-[#251d10] border-amber-200/80 dark:border-amber-900/50 text-amber-950 dark:text-amber-100"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-3">
          <div className="h-10 w-10 shrink-0 place-items-center grid rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/40">
            <Scissors className="h-5 w-5" />
          </div>

          {inProgressServicesCount > 0 ? (
            <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs">
              ● {inProgressServicesCount} no banho
            </Badge>
          ) : waitingCount > 0 ? (
            <Badge className="bg-amber-200 text-amber-900 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
              {waitingCount} aguardando
            </Badge>
          ) : (
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 bg-sky-100/70 dark:bg-sky-950/40 px-2.5 py-0.5 rounded-full border border-sky-200/60">
              Fila livre
            </span>
          )}
        </div>

        <div className="space-y-1 min-w-0 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900/70 dark:text-amber-300/70">
            FILA DE ATENDIMENTO
          </p>
          <p className="text-base sm:text-lg font-black tracking-tight text-amber-950 dark:text-amber-100 leading-tight">
            {inProgressServicesCount > 0
              ? `${inProgressServicesCount} em andamento`
              : waitingCount > 0
              ? `${waitingCount} na espera`
              : todayServicesCount > 0
              ? `${todayServicesCount} agendado(s) hoje`
              : "Fila vazia hoje"}
          </p>
          <p className="text-[11px] text-amber-900/70 dark:text-amber-300/70 font-medium leading-none pt-0.5 truncate">
            Banho, tosa e estética
          </p>
        </div>
      </div>

      {/* 5. PEDIDOS NA LOJA (PRODUTOS) - Card Branco Clean com Ícone Azul */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (onNavigateToOrders) onNavigateToOrders();
          else onSelectTab("pedidos");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onNavigateToOrders) onNavigateToOrders();
            else onSelectTab("pedidos");
          }
        }}
        className={cn(
          "flex flex-col justify-between rounded-3xl p-4 sm:p-4.5 text-left transition-all duration-200 border shadow-xs cursor-pointer group hover:-translate-y-0.5 hover:shadow-md select-none",
          "bg-white dark:bg-card border-border/80 text-foreground"
        )}
      >
        <div className="flex items-center justify-between w-full gap-2 mb-3">
          <div className="h-10 w-10 shrink-0 place-items-center grid rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
            <ShoppingBag className="h-5 w-5" />
          </div>

          {pendingOrders > 0 ? (
            <Badge className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
              ● {pendingOrders} em preparo
            </Badge>
          ) : criticalStockCount > 0 ? (
            <Badge className="bg-amber-100 text-amber-900 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
              ⚠️ {criticalStockCount} baixo
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
              <Check className="h-3 w-3 stroke-[3]" /> Em dia
            </span>
          )}
        </div>

        <div className="space-y-1 min-w-0 w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            PEDIDOS NA LOJA (PRODUTOS)
          </p>
          <p className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">
            {pendingOrders > 0
              ? `${pendingOrders} pedido(s) em aberto`
              : todayOrders > 0
              ? `${todayOrders} pedido(s) hoje`
              : "Tudo em dia"}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium leading-none pt-0.5 truncate">
            {criticalStockCount > 0
              ? `${criticalStockCount} item(ns) em estoque crítico`
              : "Nenhum pedido pendente"}
          </p>
        </div>
      </div>
    </div>
  );
}
