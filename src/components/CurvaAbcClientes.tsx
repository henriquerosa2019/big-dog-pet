import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Filter,
  Heart,
  MessageCircle,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, digitsOnly, whatsappLinkTo } from "@/lib/format";
import { isServiceExecuted, hasTransportFee } from "@/lib/transport";
import {
  calculateClientAbc,
  exportClientAbcXLSX,
  resolveAbcRange,
  type AbcClass,
  type AbcPeriod,
  type ClientAbcItem,
  type ClientConsumptionProfile,
  type ClientRetentionStatus,
  type RawClientAppointment,
  type RawClientOrder,
  type RawClientProfile,
} from "@/lib/curvaAbc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CurvaAbcClientes() {
  const [period, setPeriod] = useState<AbcPeriod>("ano");
  const [fromISO, setFromISO] = useState("");
  const [toISO, setToISO] = useState("");
  const [classFilter, setClassFilter] = useState<"todas" | AbcClass>("todas");
  const [profileFilter, setProfileFilter] = useState<"todos" | ClientConsumptionProfile>("todos");
  const [retentionFilter, setRetentionFilter] = useState<"todos" | ClientRetentionStatus>("todos");
  const [statusFilter, setStatusFilter] = useState<"concluidos" | "todos">("concluidos");
  const [search, setSearch] = useState("");

  const range = useMemo(() => resolveAbcRange(period, fromISO, toISO), [period, fromISO, toISO]);

  // 1. Busca agendamentos do período
  const { data: rawAppointments, isLoading: loadingAppointments } = useQuery({
    queryKey: ["curva-abc-client-appointments", period, fromISO, toISO, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(
          "id, status, ops_status, scheduled_at, user_id, service_price_cents, transport_price_cents, logistics_type, pets(name), services(name)",
        )
        .neq("status", "cancelado");

      if (range.start) {
        query = query.gte("scheduled_at", range.start.toISOString());
      }
      query = query.lte("scheduled_at", range.end.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Busca pedidos da loja do período
  const { data: rawOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ["curva-abc-client-orders", period, fromISO, toISO, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, status, created_at, user_id, customer_name, phone, total_cents");

      if (statusFilter === "concluidos") {
        query = query.eq("status", "entregue");
      } else {
        query = query.neq("status", "cancelado");
      }

      if (range.start) {
        query = query.gte("created_at", range.start.toISOString());
      }
      query = query.lte("created_at", range.end.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Perfis cadastrados
  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["curva-abc-client-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Pets cadastrados por tutor
  const { data: allPets, isLoading: loadingPets } = useQuery({
    queryKey: ["curva-abc-client-pets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, owner_id, breed");
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = loadingAppointments || loadingOrders || loadingProfiles || loadingPets;

  // Processa itens e calcula Curva ABC
  const { items: allItems, summary } = useMemo(() => {
    const petsByOwner = new Map<string, string[]>();
    for (const p of allPets ?? []) {
      if (!p.owner_id) continue;
      const list = petsByOwner.get(p.owner_id) ?? [];
      list.push(p.name);
      petsByOwner.set(p.owner_id, list);
    }

    const profileMap = new Map<
      string,
      { fullName: string; phone?: string | null | undefined; email?: string | null | undefined }
    >();
    for (const pr of profiles ?? []) {
      profileMap.set(pr.id, {
        fullName: pr.full_name ?? "",
        phone: pr.phone,
        email: pr.email,
      });
    }

    const formattedAppointments: RawClientAppointment[] = [];
    for (const a of rawAppointments ?? []) {
      const executed = isServiceExecuted(a);
      if (statusFilter === "concluidos" && !executed) continue;

      const svcPrice = a.service_price_cents ?? 0;
      const transPrice = hasTransportFee(a.logistics_type) ? (a.transport_price_cents ?? 0) : 0;
      const totalCents = svcPrice + transPrice;

      const prof = profileMap.get(a.user_id);
      formattedAppointments.push({
        id: a.id,
        userId: a.user_id,
        clientName: prof?.fullName || "Cliente",
        scheduledAt: a.scheduled_at,
        totalCents,
        petName: a.pets?.name ?? undefined,
      });
    }

    const formattedOrders: RawClientOrder[] = [];
    for (const o of rawOrders ?? []) {
      formattedOrders.push({
        id: o.id,
        userId: o.user_id ?? undefined,
        customerName: o.customer_name ?? undefined,
        customerPhone: o.phone ?? undefined,
        createdAt: o.created_at,
        totalCents: o.total_cents ?? 0,
      });
    }

    const formattedProfiles: RawClientProfile[] = (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name,
      phone: p.phone,
      email: p.email,
      petNames: petsByOwner.get(p.id) ?? [],
    }));

    return calculateClientAbc(formattedAppointments, formattedOrders, formattedProfiles);
  }, [rawAppointments, rawOrders, profiles, allPets, statusFilter]);

  // Itens filtrados para a tabela
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesClass = classFilter === "todas" || item.abcClass === classFilter;
      const matchesProfile =
        profileFilter === "todos" || item.consumptionProfile === profileFilter;
      const matchesRetention =
        retentionFilter === "todos" || item.retentionStatus === retentionFilter;

      const term = search.trim().toLowerCase();
      const termDigits = digitsOnly(search);

      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.petNames.some((pet) => pet.toLowerCase().includes(term)) ||
        (termDigits.length >= 3 && item.phone && digitsOnly(item.phone).includes(termDigits));

      return matchesClass && matchesProfile && matchesRetention && matchesSearch;
    });
  }, [allItems, classFilter, profileFilter, retentionFilter, search]);

  // Top 5 VIPs (Classe A)
  const topVips = useMemo(() => {
    return allItems.filter((i) => i.abcClass === "A").slice(0, 5);
  }, [allItems]);

  return (
    <div className="space-y-4">
      {/* CABEÇALHO E FILTROS GERENCIAIS */}
      <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-primary" /> Filtros da Curva ABC de Clientes
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Período selecionado: <strong className="text-foreground">{range.label}</strong>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 text-xs gap-1.5"
            disabled={allItems.length === 0}
            onClick={() => exportClientAbcXLSX(allItems, summary, range.label)}
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            Exportar Excel (.xlsx)
          </Button>
        </div>

        {/* Botões de Período */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {(
            [
              ["hoje", "Hoje"],
              ["semana", "Semana"],
              ["mes", "Mês"],
              ["ano", "Ano"],
              ["todos", "Tudo"],
              ["personalizado", "Personal."],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPeriod(val)}
              className={cn(
                "rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors",
                period === val
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "personalizado" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label htmlFor="client-from" className="text-[11px]">De</Label>
              <Input
                id="client-from"
                type="date"
                value={fromISO}
                onChange={(e) => setFromISO(e.target.value)}
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="client-to" className="text-[11px]">Até</Label>
              <Input
                id="client-to"
                type="date"
                value={toISO}
                onChange={(e) => setToISO(e.target.value)}
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>
          </div>
        )}

        {/* Filtros secundários: Classe, Perfil de Consumo, Status e Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
          <div>
            <Label className="text-[11px] text-muted-foreground">Filtrar por Classe</Label>
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => setClassFilter("todas")}
                className={cn(
                  "flex-1 py-1 rounded-lg text-xs font-semibold transition-colors",
                  classFilter === "todas"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setClassFilter("A")}
                className={cn(
                  "flex-1 py-1 rounded-lg text-xs font-semibold transition-colors",
                  classFilter === "A"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setClassFilter("B")}
                className={cn(
                  "flex-1 py-1 rounded-lg text-xs font-semibold transition-colors",
                  classFilter === "B"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                B
              </button>
              <button
                type="button"
                onClick={() => setClassFilter("C")}
                className={cn(
                  "flex-1 py-1 rounded-lg text-xs font-semibold transition-colors",
                  classFilter === "C"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                C
              </button>
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Perfil de Consumo</Label>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value as "todos" | ClientConsumptionProfile)}
              className="mt-1 w-full h-8 px-2.5 rounded-lg border border-input bg-background text-xs"
            >
              <option value="todos">Todos os Perfis</option>
              <option value="hibrido">Híbrido (Serviço + Loja)</option>
              <option value="apenas_servicos">Apenas Serviços (Banho/Tosa)</option>
              <option value="apenas_produtos">Apenas Loja Virtual</option>
            </select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Radar de Retenção</Label>
            <select
              value={retentionFilter}
              onChange={(e) => setRetentionFilter(e.target.value as "todos" | ClientRetentionStatus)}
              className="mt-1 w-full h-8 px-2.5 rounded-lg border border-input bg-background text-xs"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">🟢 Ativos (&lt; 30 dias)</option>
              <option value="alerta">🟡 Em Alerta (30 a 60 dias)</option>
              <option value="em_risco">🔴 Em Risco (&gt; 60 dias)</option>
            </select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Buscar Tutor ou Pet</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Nome do cliente, pet ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-card p-12 text-center text-xs text-muted-foreground shadow-card">
          <Clock className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          Carregando dados consolidados de agendamentos e compras dos tutores...
        </div>
      ) : allItems.length === 0 ? (
        <div className="rounded-2xl bg-card p-12 text-center text-xs text-muted-foreground shadow-card">
          Nenhum faturamento de tutor encontrado para o período selecionado.
        </div>
      ) : (
        <>
          {/* DASHBOARD 1: DISTRIBUIÇÃO PARETO E GASTO MÉDIO DA BASE */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  DASHBOARD 1 · DISTRIBUIÇÃO PARETO E VALOR DA BASE DE CLIENTES
                </p>
                <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-bold text-foreground">
                    {formatBRL(summary.totalRevenueCents)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    em {summary.totalClientsCount} clientes ativos · Gasto Médio por Cliente:{" "}
                    <strong className="text-foreground">{formatBRL(summary.avgLtvCents)}</strong>
                  </span>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              >
                ⭐ {summary.paretoRatio}
              </Badge>
            </div>

            {/* Barra Visual de Pareto */}
            <div className="space-y-1">
              <div className="h-3.5 w-full rounded-full bg-secondary overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${summary.classA.revenueShare}%` }}
                  className="bg-emerald-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  title={`Classe A: ${summary.classA.revenueShare.toFixed(1)}%`}
                >
                  {summary.classA.revenueShare >= 15 && `A (${summary.classA.revenueShare.toFixed(0)}%)`}
                </div>
                <div
                  style={{ width: `${summary.classB.revenueShare}%` }}
                  className="bg-blue-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  title={`Classe B: ${summary.classB.revenueShare.toFixed(1)}%`}
                >
                  {summary.classB.revenueShare >= 10 && `B (${summary.classB.revenueShare.toFixed(0)}%)`}
                </div>
                <div
                  style={{ width: `${summary.classC.revenueShare}%` }}
                  className="bg-amber-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  title={`Classe C: ${summary.classC.revenueShare.toFixed(1)}%`}
                >
                  {summary.classC.revenueShare >= 5 && `C (${summary.classC.revenueShare.toFixed(0)}%)`}
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground px-1">
                <span>Classe A: {formatBRL(summary.classA.revenueCents)} ({summary.classA.revenueShare.toFixed(1)}%)</span>
                <span>Classe B: {formatBRL(summary.classB.revenueCents)} ({summary.classB.revenueShare.toFixed(1)}%)</span>
                <span>Classe C: {formatBRL(summary.classC.revenueCents)} ({summary.classC.revenueShare.toFixed(1)}%)</span>
              </div>
            </div>

            {/* 3 Cards de Classes A, B e C */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Card Classe A */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white">
                    Classe A · Tutores VIP
                  </span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.classA.revenueShare.toFixed(1)}% da Receita
                  </span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatBRL(summary.classA.revenueCents)}
                </p>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-emerald-500/20">
                  <span>
                    {summary.classA.clientsCount} tutores ({summary.classA.clientsShare.toFixed(1)}% da base)
                  </span>
                  <span className="font-semibold text-foreground">
                    Média por Tutor: {formatBRL(summary.classA.avgLtvCents)}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-200 bg-emerald-500/10 p-2 rounded-lg leading-relaxed">
                  💎 <strong>Ação de Gestão:</strong> Seus clientes mais valiosos! Garanta prioridade aos sábados, atendimento personalizado e mimos no aniversário do pet.
                </p>
              </div>

              {/* Card Classe B */}
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white">
                    Classe B · Regulares
                  </span>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {summary.classB.revenueShare.toFixed(1)}% da Receita
                  </span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatBRL(summary.classB.revenueCents)}
                </p>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-blue-500/20">
                  <span>
                    {summary.classB.clientsCount} tutores ({summary.classB.clientsShare.toFixed(1)}% da base)
                  </span>
                  <span className="font-semibold text-foreground">
                    Média por Tutor: {formatBRL(summary.classB.avgLtvCents)}
                  </span>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-200 bg-blue-500/10 p-2 rounded-lg leading-relaxed">
                  📈 <strong>Ação de Gestão:</strong> Clientes fiéis com alto potencial de crescimento. Ofereça pacotes mensais ou produtos recorrentes para promovê-los à Classe A.
                </p>
              </div>

              {/* Card Classe C */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-600 text-white">
                    Classe C · Esporádicos
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {summary.classC.revenueShare.toFixed(1)}% da Receita
                  </span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatBRL(summary.classC.revenueCents)}
                </p>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-amber-500/20">
                  <span>
                    {summary.classC.clientsCount} tutores ({summary.classC.clientsShare.toFixed(1)}% da base)
                  </span>
                  <span className="font-semibold text-foreground">
                    Média por Tutor: {formatBRL(summary.classC.avgLtvCents)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 p-2 rounded-lg leading-relaxed">
                  🎯 <strong>Ação de Gestão:</strong> Base volumosa de visitas raras. Use mensagens automáticas de retorno e vacina sem sobrecarregar a recepção.
                </p>
              </div>
            </div>
          </div>

          {/* DASHBOARDS 2 E 3 (LADO A LADO) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* DASHBOARD 2: TOP TUTORES VIPS (CLASSE A) */}
            <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  DASHBOARD 2 · TOP TUTORES VIPS (CLASSE A)
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded bg-secondary font-medium text-muted-foreground">
                  Maiores Compradores
                </span>
              </div>

              {topVips.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nenhum tutor Classe A no período selecionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {topVips.map((vip, idx) => {
                    const waLink = whatsappLinkTo(
                      vip.phone,
                      `Olá ${vip.name}! Tudo bem? Passando para agradecer pela parceria e carinho de sempre com o Big Dog Pet! Caso precise agendar o próximo banho ou repor algo para seu pet, conte conosco.`,
                    );

                    return (
                      <div
                        key={vip.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-secondary/20 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={cn(
                              "w-6 h-6 rounded-full font-bold flex items-center justify-center text-xs shrink-0",
                              idx === 0
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                : idx === 1
                                ? "bg-slate-500/20 text-slate-600 dark:text-slate-300"
                                : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {vip.rank}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold truncate text-foreground">{vip.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              🐾 {vip.petNames.length > 0 ? vip.petNames.join(", ") : "Sem pet cadastrado"} ·{" "}
                              {vip.servicesCount} serviços · {vip.ordersCount} compras
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-bold text-primary">{formatBRL(vip.totalRevenueCents)}</p>
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-0.5"
                            >
                              <MessageCircle className="h-2.5 w-2.5" />
                              WhatsApp VIP
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Sem telefone</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DASHBOARD 3: RADAR DE RETENÇÃO & RISCO DE ABANDONO */}
            <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  DASHBOARD 3 · RADAR DE FREQUÊNCIA & RETENÇÃO DE CLIENTES
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded bg-secondary font-medium text-muted-foreground">
                  Frequência & Fidelidade
                </span>
              </div>

              {summary.retention.atRiskVipsCount > 0 && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs flex items-center gap-2 text-rose-800 dark:text-rose-200 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>
                    Atenção: <strong>{summary.retention.atRiskVipsCount} tutores da Classe A (VIP)</strong> estão sem visita há mais de 30 dias!
                  </span>
                </div>
              )}

              <div className="space-y-2 text-xs">
                {/* Ativos */}
                <button
                  type="button"
                  onClick={() => setRetentionFilter(retentionFilter === "ativo" ? "todos" : "ativo")}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl border transition-all flex justify-between items-center",
                    retentionFilter === "ativo"
                      ? "border-emerald-500 bg-emerald-500/15"
                      : "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10",
                  )}
                >
                  <div>
                    <p className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Clientes Ativos (&lt; 30 dias)
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Frequência regular e em dia</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {summary.retention.activeCount} tutores (
                    {summary.totalClientsCount > 0
                      ? ((summary.retention.activeCount / summary.totalClientsCount) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </button>

                {/* Em Alerta */}
                <button
                  type="button"
                  onClick={() => setRetentionFilter(retentionFilter === "alerta" ? "todos" : "alerta")}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl border transition-all flex justify-between items-center",
                    retentionFilter === "alerta"
                      ? "border-blue-500 bg-blue-500/15"
                      : "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10",
                  )}
                >
                  <div>
                    <p className="font-bold text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-600" /> Em Alerta (30 a 60 dias sem visita)
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ponto de contato para convite de retorno</p>
                  </div>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {summary.retention.warningCount} tutores (
                    {summary.totalClientsCount > 0
                      ? ((summary.retention.warningCount / summary.totalClientsCount) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </button>

                {/* Em Risco */}
                <button
                  type="button"
                  onClick={() => setRetentionFilter(retentionFilter === "em_risco" ? "todos" : "em_risco")}
                  className={cn(
                    "w-full text-left p-2.5 rounded-xl border transition-all flex justify-between items-center",
                    retentionFilter === "em_risco"
                      ? "border-rose-500 bg-rose-500/15"
                      : "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10",
                  )}
                >
                  <div>
                    <p className="font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Em Risco de Abandono (&gt; 60 dias sem visitas)
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Clientes afastados com risco de perda</p>
                  </div>
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    {summary.retention.atRiskCount} tutores (
                    {summary.totalClientsCount > 0
                      ? ((summary.retention.atRiskCount / summary.totalClientsCount) * 100).toFixed(0)
                      : 0}
                    %)
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* DASHBOARD 4: PERFIL DE CONSUMO & VENDAS COMBINADAS */}
          <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                DASHBOARD 4 · PERFIL DE CONSUMO & VENDAS COMBINADAS (SERVIÇOS + LOJA)
              </p>
              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary font-medium text-muted-foreground">
                Comportamento de Compra
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Híbrido */}
              <div
                onClick={() => setProfileFilter(profileFilter === "hibrido" ? "todos" : "hibrido")}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all space-y-1",
                  profileFilter === "hibrido"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/40 bg-secondary/30 hover:bg-secondary/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">Híbridos (Serviço + Loja)</p>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    Maior Gasto Médio
                  </Badge>
                </div>
                <p className="text-base font-extrabold text-primary">
                  {formatBRL(summary.consumption.hybridRevenueCents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.consumption.hybridCount} tutores · Ticket médio:{" "}
                  {summary.consumption.hybridCount > 0
                    ? formatBRL(Math.round(summary.consumption.hybridRevenueCents / summary.consumption.hybridCount))
                    : "R$ 0"}
                </p>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-primary h-full"
                    style={{
                      width: `${summary.totalRevenueCents > 0 ? (summary.consumption.hybridRevenueCents / summary.totalRevenueCents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                  💎 Clientes com maior valor vitalício e retenção.
                </p>
              </div>

              {/* Apenas Serviços */}
              <div
                onClick={() => setProfileFilter(profileFilter === "apenas_servicos" ? "todos" : "apenas_servicos")}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all space-y-1",
                  profileFilter === "apenas_servicos"
                    ? "border-blue-500 bg-blue-500/10 shadow-sm"
                    : "border-border/40 bg-secondary/30 hover:bg-secondary/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">Apenas Serviços</p>
                  <span className="text-[10px] text-muted-foreground">Banho/Tosa</span>
                </div>
                <p className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                  {formatBRL(summary.consumption.servicesOnlyRevenueCents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.consumption.servicesOnlyCount} tutores · Só fazem banho/tosa
                </p>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-blue-500 h-full"
                    style={{
                      width: `${summary.totalRevenueCents > 0 ? (summary.consumption.servicesOnlyRevenueCents / summary.totalRevenueCents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium pt-1">
                  🎯 <strong>Oportunidade:</strong> Oferecer petiscos ou ração na entrega do pet!
                </p>
              </div>

              {/* Apenas Loja */}
              <div
                onClick={() => setProfileFilter(profileFilter === "apenas_produtos" ? "todos" : "apenas_produtos")}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all space-y-1",
                  profileFilter === "apenas_produtos"
                    ? "border-amber-500 bg-amber-500/10 shadow-sm"
                    : "border-border/40 bg-secondary/30 hover:bg-secondary/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-foreground">Apenas Loja Virtual</p>
                  <span className="text-[10px] text-muted-foreground">Produtos</span>
                </div>
                <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {formatBRL(summary.consumption.productsOnlyRevenueCents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {summary.consumption.productsOnlyCount} tutores · Compradores de produtos
                </p>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-amber-500 h-full"
                    style={{
                      width: `${summary.totalRevenueCents > 0 ? (summary.consumption.productsOnlyRevenueCents / summary.totalRevenueCents) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                  🎯 <strong>Oportunidade:</strong> Cupom de boas-vindas para 1º banho no petshop!
                </p>
              </div>
            </div>
          </div>

          {/* TABELA ANALÍTICA DETALHADA */}
          <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tabela Analítica da Curva ABC de Clientes
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Exibindo {filteredItems.length} de {allItems.length} tutores ranqueados
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/40 text-xs">
              <table className="w-full text-left">
                <thead className="bg-secondary/60 text-[11px] uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-2">Classe</th>
                    <th className="py-2.5 px-3">Tutor / Contato</th>
                    <th className="py-2.5 px-3">Pets</th>
                    <th className="py-2.5 px-2 text-right">Visitas</th>
                    <th className="py-2.5 px-3 text-right">Serviços</th>
                    <th className="py-2.5 px-3 text-right">Loja</th>
                    <th className="py-2.5 px-3 text-right font-bold text-primary">Total</th>
                    <th className="py-2.5 px-2 text-right">% Fat.</th>
                    <th className="py-2.5 px-3 text-right">% Acum.</th>
                    <th className="py-2.5 px-2.5 text-center">Retenção</th>
                    <th className="py-2.5 px-2.5 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredItems.map((item) => {
                    const waLink = whatsappLinkTo(
                      item.phone,
                      `Olá ${item.name}! Tudo bem? Passando para mandar um abraço da equipe do Big Dog Pet. Como estão os pets? Qualquer agendamento ou dúvida, estamos à disposição!`,
                    );

                    return (
                      <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-2 px-3 font-bold text-muted-foreground">{item.rank}</td>
                        <td className="py-2 px-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[11px] font-bold",
                              item.abcClass === "A" && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                              item.abcClass === "B" && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                              item.abcClass === "C" && "bg-amber-500/20 text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {item.abcClass}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-semibold text-foreground">{item.name}</p>
                          {item.phone && (
                            <p className="text-[10px] text-muted-foreground">{item.phone}</p>
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {item.petNames.length > 0 ? (
                            <span className="truncate block max-w-[150px]" title={item.petNames.join(", ")}>
                              🐾 {item.petNames.join(", ")}
                            </span>
                          ) : (
                            <span className="italic text-[10px]">Sem pet</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {item.servicesCount + item.ordersCount}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {formatBRL(item.servicesRevenueCents)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {formatBRL(item.productsRevenueCents)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-primary">
                          {formatBRL(item.totalRevenueCents)}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {item.revenueSharePercent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-muted-foreground">
                          {item.accumulatedSharePercent.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap",
                              item.retentionStatus === "ativo" &&
                                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                              item.retentionStatus === "alerta" &&
                                "bg-blue-500/10 text-blue-700 dark:text-blue-300",
                              item.retentionStatus === "em_risco" &&
                                "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                            )}
                          >
                            {item.daysSinceLastActivity !== undefined
                              ? `${item.daysSinceLastActivity}d atrás`
                              : "Ativo"}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
