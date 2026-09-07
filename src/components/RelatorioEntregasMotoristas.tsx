/**
 * Relatório Financeiro de Entregas & Histórico dos Motoristas
 * Big Dog Pet - Franco da Rocha
 * 
 * Painel analítico completo de corridas, quilometragem, custos de combustível,
 * frete cobrado, repasses e formas de pagamento recebidas pelos motoristas na entrega.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Filter,
  Fuel,
  MapPin,
  Printer,
  Route,
  Search,
  Truck,
  UserCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DeliveryPeriod = "hoje" | "semana" | "mes" | "ano" | "todos";

export function RelatorioEntregasMotoristas() {
  const [period, setPeriod] = useState<DeliveryPeriod>("mes");
  const [selectedDriver, setSelectedDriver] = useState<string>("todos");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<"todos" | "pago" | "pendente">("todos");
  const [search, setSearch] = useState("");

  // Busca dados de ordens de transporte e motoristas
  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["relatorio-entregas-motoristas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(`
          id,
          code,
          created_at,
          price_cents,
          fee_breakdown,
          driver_id,
          delivered_at,
          arrived_shop_at,
          picked_up_at,
          pickup_notes,
          return_notes,
          appointments (
            id,
            scheduled_at,
            status,
            ops_status,
            logistics_type,
            service_price_cents,
            transport_price_cents,
            total_cents,
            payment_status,
            payment_method,
            paid_at,
            user_id,
            pets (name, size),
            services (name)
          ),
          addresses (
            district,
            street,
            number,
            city,
            cep
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Busca perfis para mapear nomes dos motoristas e tutores
  const { data: profiles } = useQuery({
    queryKey: ["profiles-all-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profilesMap = useMemo(() => {
    const map = new Map<string, { full_name: string | null; phone: string | null }>();
    for (const p of profiles ?? []) {
      map.set(p.id, { full_name: p.full_name, phone: p.phone });
    }
    return map;
  }, [profiles]);

  // Lista de motoristas únicos com corridas
  const driversList = useMemo(() => {
    const set = new Set<string>();
    for (const o of rawOrders ?? []) {
      if (o.driver_id) set.add(o.driver_id);
    }
    return Array.from(set).map((id) => ({
      id,
      name: profilesMap.get(id)?.full_name || `Motorista ${id.slice(0, 5)}`,
    }));
  }, [rawOrders, profilesMap]);

  // Filtro de data
  const filteredOrders = useMemo(() => {
    if (!rawOrders) return [];
    const now = new Date();

    return rawOrders.filter((item) => {
      const createdAt = new Date(item.created_at);

      if (period === "hoje") {
        const isToday =
          createdAt.getDate() === now.getDate() &&
          createdAt.getMonth() === now.getMonth() &&
          createdAt.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (period === "semana") {
        const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (period === "mes") {
        const isThisMonth =
          createdAt.getMonth() === now.getMonth() &&
          createdAt.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      } else if (period === "ano") {
        if (createdAt.getFullYear() !== now.getFullYear()) return false;
      }

      if (selectedDriver !== "todos" && item.driver_id !== selectedDriver) {
        return false;
      }

      const pStatus = item.appointments?.payment_status || "pendente";
      if (selectedPaymentStatus !== "todos" && pStatus !== selectedPaymentStatus) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const driverName = (item.driver_id ? profilesMap.get(item.driver_id)?.full_name : "")?.toLowerCase() || "";
        const petName = (item.appointments?.pets?.name || "").toLowerCase();
        const tutorName = (item.appointments?.user_id ? profilesMap.get(item.appointments.user_id)?.full_name : "")?.toLowerCase() || "";
        const district = (item.addresses?.district || "").toLowerCase();
        const code = String(item.code);

        if (
          !driverName.includes(q) &&
          !petName.includes(q) &&
          !tutorName.includes(q) &&
          !district.includes(q) &&
          !code.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rawOrders, period, selectedDriver, selectedPaymentStatus, search, profilesMap]);

  // Cálculos de Indicadores Financeiros
  const kpis = useMemo(() => {
    let totalRides = filteredOrders.length;
    let completedRides = 0;
    let totalFreightCents = 0;
    let totalServiceCents = 0;
    let totalRevenueCents = 0;
    let totalEstimatedFuelCents = 0;
    let totalKm = 0;
    let totalPaidCents = 0;
    let totalPendingCents = 0;

    interface PaymentMethodsReport {
      pix: { count: number; cents: number };
      dinheiro: { count: number; cents: number };
      debito: { count: number; cents: number };
      credito: { count: number; cents: number };
      outros: { count: number; cents: number };
    }

    const paymentMethodsSummary: PaymentMethodsReport = {
      pix: { count: 0, cents: 0 },
      dinheiro: { count: 0, cents: 0 },
      debito: { count: 0, cents: 0 },
      credito: { count: 0, cents: 0 },
      outros: { count: 0, cents: 0 },
    };

    const driverStatsMap = new Map<
      string,
      {
        name: string;
        ridesCount: number;
        totalKm: number;
        freightCents: number;
        estimatedFuelCents: number;
        collectedCents: number;
      }
    >();

    for (const item of filteredOrders) {
      const appt = item.appointments;
      const freight = item.price_cents ?? appt?.transport_price_cents ?? 0;
      const service = appt?.service_price_cents ?? 0;
      const total = appt?.total_cents ?? (freight + service);
      const isPaid = appt?.payment_status === "pago";

      totalFreightCents += freight;
      totalServiceCents += service;
      totalRevenueCents += total;

      if (isPaid) {
        totalPaidCents += total;
        const rawMethod = appt?.payment_method?.toLowerCase() || "outros";
        if (rawMethod === "pix") {
          paymentMethodsSummary.pix.count += 1;
          paymentMethodsSummary.pix.cents += total;
        } else if (rawMethod === "dinheiro") {
          paymentMethodsSummary.dinheiro.count += 1;
          paymentMethodsSummary.dinheiro.cents += total;
        } else if (rawMethod === "debito") {
          paymentMethodsSummary.debito.count += 1;
          paymentMethodsSummary.debito.cents += total;
        } else if (rawMethod === "credito") {
          paymentMethodsSummary.credito.count += 1;
          paymentMethodsSummary.credito.cents += total;
        } else {
          paymentMethodsSummary.outros.count += 1;
          paymentMethodsSummary.outros.cents += total;
        }
      } else {
        totalPendingCents += total;
      }

      // Extrai dados de combustível e km do fee_breakdown
      const breakdown = item.fee_breakdown as {
        distance_km?: number;
        fuel_cost_estimate_cents?: number;
      } | null;

      const km = breakdown?.distance_km ?? 0;
      const fuelCost = breakdown?.fuel_cost_estimate_cents ?? Math.round((km / 8.5) * 589);

      totalKm += km;
      totalEstimatedFuelCents += fuelCost;

      if (item.delivered_at || appt?.status === "concluido" || appt?.ops_status === "pet_entregue") {
        completedRides += 1;
      }

      // Agrupa por motorista
      const driverId = item.driver_id || "sem_motorista";
      const driverName = item.driver_id
        ? profilesMap.get(item.driver_id)?.full_name || "Motorista Atribuído"
        : "Aguardando Motorista";

      const existingDriver = driverStatsMap.get(driverId) || {
        name: driverName,
        ridesCount: 0,
        totalKm: 0,
        freightCents: 0,
        estimatedFuelCents: 0,
        collectedCents: 0,
      };

      existingDriver.ridesCount += 1;
      existingDriver.totalKm += km;
      existingDriver.freightCents += freight;
      existingDriver.estimatedFuelCents += fuelCost;
      if (isPaid) existingDriver.collectedCents += total;

      driverStatsMap.set(driverId, existingDriver);
    }

    const netFreightMarginCents = totalFreightCents - totalEstimatedFuelCents;

    return {
      totalRides,
      completedRides,
      totalKm: Number(totalKm.toFixed(1)),
      totalFreightCents,
      totalServiceCents,
      totalRevenueCents,
      totalEstimatedFuelCents,
      netFreightMarginCents,
      totalPaidCents,
      totalPendingCents,
      paymentMethodsSummary,
      driverStats: Array.from(driverStatsMap.values()).sort(
        (a, b) => b.freightCents - a.freightCents
      ),
    };
  }, [filteredOrders, profilesMap]);

  // Exportar para Excel
  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();

    // 1. Resumo
    const resumoData = [
      ["RELATÓRIO FINANCEIRO DAS ENTREGAS & MOTORISTAS - BIG DOG PET"],
      ["Período:", period.toUpperCase()],
      ["Gerado em:", new Date().toLocaleString("pt-BR")],
      [],
      ["Métrica", "Valor"],
      ["Total de Corridas Realizadas", kpis.totalRides],
      ["Quilometragem Total Percorrida (km)", `${kpis.totalKm} km`],
      ["Faturamento Bruto de Frete", kpis.totalFreightCents / 100],
      ["Custo Total Estimado de Combustível", kpis.totalEstimatedFuelCents / 100],
      ["Saldo Líquido de Transporte (Frete - Combustível)", kpis.netFreightMarginCents / 100],
      ["Total Recebido na Entrega / Loja", kpis.totalPaidCents / 100],
      ["Total Pendente de Recebimento", kpis.totalPendingCents / 100],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // 2. Histórico das Corridas
    const rows = filteredOrders.map((o) => {
      const breakdown = o.fee_breakdown as { distance_km?: number; fuel_cost_estimate_cents?: number } | null;
      return {
        "Cód.": `#${o.code}`,
        Data: formatDateTime(o.created_at),
        Motorista: o.driver_id ? profilesMap.get(o.driver_id)?.full_name || "Motorista" : "Sem motorista",
        Tutor: o.appointments?.user_id ? profilesMap.get(o.appointments.user_id)?.full_name || "Tutor" : "",
        Pet: o.appointments?.pets?.name || "",
        Bairro: o.addresses?.district || "",
        "Distância (km)": breakdown?.distance_km ?? 0,
        "Combustível Estimado (R$)": (breakdown?.fuel_cost_estimate_cents ?? 0) / 100,
        "Frete Cobrado (R$)": (o.price_cents ?? 0) / 100,
        "Valor Serviço (R$)": (o.appointments?.service_price_cents ?? 0) / 100,
        "Total (R$)": (o.appointments?.total_cents ?? 0) / 100,
        "Status Pagto": o.appointments?.payment_status || "pendente",
        "Forma Pagto": o.appointments?.payment_method?.toUpperCase() || "N/A",
      };
    });

    const wsDetalhes = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsDetalhes, "Corridas Detalhadas");

    XLSX.writeFile(wb, `Relatorio_Entregas_Motoristas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Topo e Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold flex items-center gap-1.5">
            <Truck className="h-5 w-5 text-primary" />
            Relatório Financeiro das Entregas & Histórico dos Motoristas
          </h2>
          <p className="text-xs text-muted-foreground">
            Quilometragem percorrida, despesas estimadas de combustível, frete cobrado e recebimentos na entrega.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportXLSX}
            className="h-9 gap-1.5 rounded-xl text-xs"
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-9 gap-1.5 rounded-xl text-xs print:hidden"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Seletor de Período */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/80 pb-2">
        {(
          [
            ["hoje", "Hoje"],
            ["semana", "Últimos 7 dias"],
            ["mes", "Este Mês"],
            ["ano", "Ano Atual"],
            ["todos", "Todo o Histórico"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setPeriod(val)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
              period === val
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros Secundários: Motorista e Pagamento */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Filtrar por Motorista:</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
          >
            <option value="todos">Todos os motoristas</option>
            {driversList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Status do Pagamento:</label>
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value as any)}
            className="mt-1 h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
          >
            <option value="todos">Todos os status</option>
            <option value="pago">✓ Pagos na entrega / loja</option>
            <option value="pendente">⏳ Pendentes de pagamento</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">Buscar corrida:</label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por pet, tutor, bairro ou código..."
              className="h-9 rounded-xl pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-card">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Truck className="h-3.5 w-3.5 text-primary" />
            Total de Corridas
          </p>
          <p className="mt-1 text-lg font-bold">{kpis.totalRides}</p>
          <span className="text-[10px] text-muted-foreground">{kpis.completedRides} concluídas</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-card">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Route className="h-3.5 w-3.5 text-sky-500" />
            Quilometragem Total
          </p>
          <p className="mt-1 text-lg font-bold text-sky-600 dark:text-sky-400">{kpis.totalKm} km</p>
          <span className="text-[10px] text-muted-foreground">com dobro em ida e volta</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-card">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Faturamento de Frete
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatBRL(kpis.totalFreightCents)}
          </p>
          <span className="text-[10px] text-muted-foreground">taxas de transporte</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-card">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Fuel className="h-3.5 w-3.5 text-amber-500" />
            Despesa Combustível
          </p>
          <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
            {formatBRL(kpis.totalEstimatedFuelCents)}
          </p>
          <span className="text-[10px] text-muted-foreground">estimado a R$ 5,89/l</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-card">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            Saldo Líquido Frete
          </p>
          <p className={cn("mt-1 text-lg font-bold", kpis.netFreightMarginCents >= 0 ? "text-primary" : "text-destructive")}>
            {formatBRL(kpis.netFreightMarginCents)}
          </p>
          <span className="text-[10px] text-muted-foreground">Frete menos Combustível</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-card">
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-teal-600" />
            Recebido na Entrega
          </p>
          <p className="mt-1 text-lg font-bold text-teal-600 dark:text-teal-400">
            {formatBRL(kpis.totalPaidCents)}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {kpis.totalPendingCents > 0 ? `${formatBRL(kpis.totalPendingCents)} a receber` : "100% recebido"}
          </span>
        </div>
      </div>

      {/* Gráfico Visual de Despesas e Repasses dos Motoristas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Gráfico 1: Despesas de Combustível vs Frete por Motorista */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Fuel className="h-4 w-4 text-amber-500" />
            Gráfico de Despesas de Combustível e Frete por Motorista
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Comparativo entre o frete cobrado e o consumo de combustível estimado por motorista.
          </p>

          <div className="mt-4 space-y-3">
            {kpis.driverStats.map((driver, idx) => {
              const maxFreight = Math.max(...kpis.driverStats.map((d) => d.freightCents), 1);
              const freightPercent = Math.min(100, Math.round((driver.freightCents / maxFreight) * 100));
              const fuelPercent = Math.min(100, Math.round((driver.estimatedFuelCents / maxFreight) * 100));

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{driver.name} ({driver.ridesCount} corridas · {driver.totalKm.toFixed(1)} km)</span>
                    <span className="font-bold text-primary">{formatBRL(driver.freightCents)}</span>
                  </div>
                  {/* Barra de Frete */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${freightPercent}%` }}
                    />
                  </div>
                  {/* Barra de Combustível */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Despesa Combustível: {formatBRL(driver.estimatedFuelCents)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Recebido na Entrega: {formatBRL(driver.collectedCents)}
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${fuelPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {kpis.driverStats.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhuma corrida registrada para o período selecionado.
              </p>
            )}
          </div>
        </div>

        {/* Gráfico 2: Formas de Pagamento Recebidas na Entrega */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Formas de Pagamento Recebidas na Entrega
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Distribuição dos valores pagos pelos tutores no momento da entrega (Pix, Dinheiro, Cartões).
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-2.5">
              <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">📱 Pix</p>
              <p className="mt-1 text-base font-bold text-foreground">
                {formatBRL(kpis.paymentMethodsSummary.pix.cents)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {kpis.paymentMethodsSummary.pix.count} transações
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">💵 Dinheiro</p>
              <p className="mt-1 text-base font-bold text-foreground">
                {formatBRL(kpis.paymentMethodsSummary.dinheiro.cents)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {kpis.paymentMethodsSummary.dinheiro.count} transações
              </span>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5">
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">💳 Débito</p>
              <p className="mt-1 text-base font-bold text-foreground">
                {formatBRL(kpis.paymentMethodsSummary.debito.cents)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {kpis.paymentMethodsSummary.debito.count} transações
              </span>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5">
              <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">💳 Crédito</p>
              <p className="mt-1 text-base font-bold text-foreground">
                {formatBRL(kpis.paymentMethodsSummary.credito.cents)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {kpis.paymentMethodsSummary.credito.count} transações
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-xs flex items-center justify-between">
            <span className="font-semibold text-muted-foreground">Total Recebido no Período:</span>
            <span className="text-sm font-bold text-primary">{formatBRL(kpis.totalPaidCents)}</span>
          </div>
        </div>
      </div>

      {/* Tabela Analítica de Corridas */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-card overflow-hidden">
        <div className="border-b border-border/80 p-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Histórico Analítico de Corridas ({filteredOrders.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3">Cód.</th>
                <th className="py-2.5 px-3">Data/Hora</th>
                <th className="py-2.5 px-3">Motorista</th>
                <th className="py-2.5 px-3">Tutor & Pet</th>
                <th className="py-2.5 px-3">Bairro</th>
                <th className="py-2.5 px-3 text-center">Distância</th>
                <th className="py-2.5 px-3 text-right">Combustível</th>
                <th className="py-2.5 px-3 text-right">Frete</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th className="py-2.5 px-3 text-center">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredOrders.map((item) => {
                const appt = item.appointments;
                const breakdown = item.fee_breakdown as {
                  distance_km?: number;
                  fuel_cost_estimate_cents?: number;
                  round_trip?: boolean;
                } | null;

                const distanceKm = breakdown?.distance_km ?? 0;
                const fuelCents = breakdown?.fuel_cost_estimate_cents ?? Math.round((distanceKm / 8.5) * 589);
                const freight = item.price_cents ?? appt?.transport_price_cents ?? 0;
                const total = appt?.total_cents ?? (freight + (appt?.service_price_cents ?? 0));
                const isPaid = appt?.payment_status === "pago";

                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-primary">#{item.code}</td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {item.driver_id ? profilesMap.get(item.driver_id)?.full_name || "Motorista" : (
                        <span className="text-muted-foreground italic">Não atribuído</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold">{appt?.pets?.name || "Pet"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {appt?.user_id ? profilesMap.get(appt.user_id)?.full_name || "Tutor" : ""}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {item.addresses?.district || "Franco da Rocha"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium">
                      {distanceKm > 0 ? (
                        <span>
                          {distanceKm} km
                          {breakdown?.round_trip && (
                            <span className="block text-[9px] text-primary">Ida e Volta</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-amber-600 dark:text-amber-400">
                      {fuelCents > 0 ? formatBRL(fuelCents) : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      {formatBRL(freight)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-primary">
                      {formatBRL(total)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isPaid ? (
                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">
                          ✓ {appt?.payment_method?.toUpperCase() || "PAGO"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[10px]">
                          Pendente
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    Nenhuma corrida encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
