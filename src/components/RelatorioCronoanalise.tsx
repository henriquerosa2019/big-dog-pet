/**
 * Relatório de Cronoanálise & Eficiência dos Processos
 * Big Dog Pet - Franco da Rocha
 * 
 * Separado em dois módulos dedicados:
 * 1. ✂️ CRONOANÁLISE DO ATENDIMENTO (NO PET SHOP)
 *    - Tempo de espera no petshop (fila pré-atendimento)
 *    - Duração real de execução na bancada/consultório vs. tempo previsto
 *    - Tempo de pós-atendimento aguardando devolução/retirada
 *    - Atendimento do chat / suporte ao cliente
 * 
 * 2. 🚗 CRONOANÁLISE DO TÁXI PET (CORRIDAS & LOGÍSTICA)
 *    - Tempo de recebimento da corrida (pedido até atribuição do motorista)
 *    - Tempo para chegar ao cliente (deslocamento até a retirada do pet)
 *    - Tempo para voltar ao petshop (finalizando a corrida de ida até a loja)
 *    - Tempo para retorno ao cliente (finalizando a corrida de volta e entrega no lar)
 *    - Tempo de atendimento geral do pet (ciclo completo do pet fora de casa)
 *    - Agrupamento e detalhamento por cliente, com ordenação padrão DO MAIOR PARA O MENOR TEMPO.
 */

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  MessageCircle,
  Truck,
  Scissors,
  Download,
  Printer,
  Search,
  Filter,
  TrendingUp,
  Award,
  RefreshCw,
  Compass,
  Timer,
  Smile,
  ShieldCheck,
  ArrowUpDown,
  User,
  Users,
  MapPin,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Car,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { getAllChatMessages, type ChatMessage } from "@/lib/inAppChat";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CronoPeriod = "hoje" | "7dias" | "30dias" | "mes" | "todos";
export type MasterModule = "taxi" | "atendimento";
export type TaxiSortOption =
  | "maior_tempo_geral"
  | "maior_chegada_cliente"
  | "maior_volta_pet"
  | "maior_retorno_cliente"
  | "maior_recebimento_corrida"
  | "mais_recente";

export type AtendimentoSortOption =
  | "maior_duracao_real"
  | "maior_espera_loja"
  | "maior_desvio"
  | "mais_recente";

/** Formata minutos para texto claro e legível (ex: "18 min", "1h 25min", "< 1 min") */
function formatMinutesExplanatory(min: number | null | undefined): string {
  if (min === null || min === undefined || isNaN(min) || min < 0) return "—";
  if (min < 1) return "< 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Badge explicativo de agilidade para tempos */
function renderAgilityBadge(min: number | null | undefined, thresholds: { fast: number; moderate: number }) {
  if (min === null || min === undefined) {
    return <span className="text-muted-foreground text-[10px] font-medium">—</span>;
  }
  if (min <= thresholds.fast) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 whitespace-nowrap">
        🟢 Rápido ({Math.round(min)}m)
      </span>
    );
  }
  if (min <= thresholds.moderate) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 whitespace-nowrap">
        🟡 Moderado ({Math.round(min)}m)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 whitespace-nowrap">
      🔴 Demorado ({formatMinutesExplanatory(min)})
    </span>
  );
}

/** Badge explicativo para pontualidade de bancada vs tempo previsto */
function renderPaceBadge(diffMin: number | null | undefined) {
  if (diffMin === null || diffMin === undefined) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-[10px] px-1 py-0">
        Em andamento
      </Badge>
    );
  }
  if (diffMin <= 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 whitespace-nowrap">
        🟢 No Prazo {diffMin < 0 ? `(${Math.abs(Math.round(diffMin))}m antes)` : ""}
      </span>
    );
  }
  if (diffMin <= 15) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 whitespace-nowrap">
        🟡 +{Math.round(diffMin)}m
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 whitespace-nowrap">
      🔴 +{formatMinutesExplanatory(diffMin)}
    </span>
  );
}

export function RelatorioCronoanalise() {
  // Módulo Principal Selecionado: Táxi Pet vs Atendimento no Pet Shop
  const [masterModule, setMasterModule] = useState<MasterModule>("taxi");

  // Filtros Globais
  const [period, setPeriod] = useState<CronoPeriod>("30dias");
  const [search, setSearch] = useState("");

  // Filtros & Ordenação do Táxi Pet (Padrão: maior para o menor tempo)
  const [taxiSortBy, setTaxiSortBy] = useState<TaxiSortOption>("maior_tempo_geral");
  const [taxiViewMode, setTaxiViewMode] = useState<"corridas" | "consolidado_cliente">("corridas");

  // Filtros & Ordenação do Atendimento (Padrão: maior para o menor tempo)
  const [atendimentoSortBy, setAtendimentoSortBy] = useState<AtendimentoSortOption>("maior_duracao_real");
  const [atendimentoSubTab, setAtendimentoSubTab] = useState<"bancada" | "chat">("bancada");
  const [categoryFilter, setCategoryFilter] = useState<"todas" | "banho" | "veterinario" | "cirurgia">("todas");

  // Estado reativo do chat interno
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => getAllChatMessages());

  useEffect(() => {
    const handleUpdate = () => setChatMessages(getAllChatMessages());
    window.addEventListener("bigdog_chat_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bigdog_chat_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // 1. Ordens de Transporte com todos os marcos temporais da corrida
  const { data: rawOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["relatorio-crono-orders-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(`
          id,
          code,
          driver_id,
          assigned_at,
          en_route_pickup_at,
          picked_up_at,
          arrived_shop_at,
          en_route_return_at,
          delivered_at,
          tutor_confirmed_at,
          created_at,
          appointments (
            id,
            user_id,
            pet_id,
            scheduled_at,
            created_at,
            status,
            ops_status,
            logistics_type,
            service_price_cents,
            transport_price_cents,
            total_cents,
            services ( id, name, duration_min, category ),
            pets ( id, name, species, size )
          ),
          addresses (
            district,
            street,
            number,
            city
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Agendamentos Gerais (para cobrir atendimentos de balcão e loja)
  const { data: rawAppointments, refetch: refetchAppts } = useQuery({
    queryKey: ["relatorio-crono-appointments-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          user_id,
          pet_id,
          scheduled_at,
          created_at,
          status,
          ops_status,
          logistics_type,
          service_price_cents,
          transport_price_cents,
          total_cents,
          services ( id, name, duration_min, category ),
          pets ( id, name, species, size )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Histórico de Status dos Pets (início de atendimento, conclusão, etc.)
  const { data: statusHistory } = useQuery({
    queryKey: ["relatorio-crono-history-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_status_history")
        .select("id, appointment_id, status, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Perfis de Tutores e Motoristas
  const { data: profiles } = useQuery({
    queryKey: ["relatorio-crono-profiles-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone");

      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string | null }>();
    (profiles ?? []).forEach((p) => {
      map.set(p.id, { name: p.full_name || "Cliente", phone: p.phone });
    });
    return map;
  }, [profiles]);

  const historyByAppt = useMemo(() => {
    const map = new Map<string, Array<{ status: string; created_at: string }>>();
    (statusHistory ?? []).forEach((h) => {
      if (!h.appointment_id) return;
      const current = map.get(h.appointment_id) || [];
      current.push({ status: h.status, created_at: h.created_at });
      map.set(h.appointment_id, current);
    });
    return map;
  }, [statusHistory]);

  // Intervalo de Datas
  const dateRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start: Date;

    if (period === "hoje") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === "7dias") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
    } else if (period === "30dias") {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
    } else if (period === "mes") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else {
      start = new Date(2020, 0, 1);
    }

    return { start, end };
  }, [period]);

  // =========================================================================
  // MÓDULO 1: CRONOANÁLISE DO TÁXI PET (CORRIDAS, RETIRADA, VOLTA E RETORNO)
  // =========================================================================
  const taxiAnalysis = useMemo(() => {
    const rides: Array<{
      id: string;
      code: string;
      appointmentId?: string;
      userId: string;
      tutorName: string;
      tutorPhone?: string | null;
      petName: string;
      petSpecies?: string | null;
      district?: string | null;
      driverName: string;
      createdAt: Date;
      scheduledAt: Date;

      // 1. Tempo de recebimento da corrida (pedido criado -> motorista aceitou/designado)
      tempoRecebimentoCorridaMin: number | null;

      // 2. Tempo para chegar ao cliente (motorista saiu -> retirou o pet na casa)
      tempoChegarAoClienteMin: number | null;

      // 3. Tempo para voltar ao petshop (pet retirado -> chegada física ao petshop, finalizando corrida até o pet)
      tempoVoltarAoPetshopMin: number | null;

      // 4. Tempo para retorno ao cliente (saída do petshop -> entregue na casa do tutor, finalizando corrida)
      tempoRetornoAoClienteMin: number | null;

      // 5. Tempo de atendimento geral do pet (da retirada na casa até a devolução final com sucesso)
      tempoGeralDoPetMin: number | null;

      statusGeral: string;
      opsStatus: string;
    }> = [];

    (rawOrders ?? []).forEach((order) => {
      const appt = order.appointments as any;
      const orderDate = new Date(order.created_at || appt?.scheduled_at || appt?.created_at);
      if (orderDate < dateRange.start || orderDate > dateRange.end) return;

      const tutor = profileMap.get(appt?.user_id) || { name: "Cliente" };
      const driver = order.driver_id ? profileMap.get(order.driver_id) : null;

      const tOrderCreated = new Date(order.created_at).getTime();
      const tAssigned = order.assigned_at ? new Date(order.assigned_at).getTime() : null;
      const tEnRoutePickup = order.en_route_pickup_at ? new Date(order.en_route_pickup_at).getTime() : null;
      const tPickedUp = order.picked_up_at ? new Date(order.picked_up_at).getTime() : null;
      const tArrivedShop = order.arrived_shop_at ? new Date(order.arrived_shop_at).getTime() : null;
      const tEnRouteReturn = order.en_route_return_at ? new Date(order.en_route_return_at).getTime() : null;
      const tDelivered = order.delivered_at ? new Date(order.delivered_at).getTime() : null;

      // 1. Tempo de recebimento da corrida
      let tempoRecebimentoCorridaMin: number | null = null;
      if (tAssigned && tAssigned >= tOrderCreated) {
        tempoRecebimentoCorridaMin = (tAssigned - tOrderCreated) / 60000;
      } else if (tEnRoutePickup && tEnRoutePickup >= tOrderCreated) {
        tempoRecebimentoCorridaMin = (tEnRoutePickup - tOrderCreated) / 60000;
      }

      // 2. Tempo para chegar ao cliente
      let tempoChegarAoClienteMin: number | null = null;
      const tStartPickup = tEnRoutePickup || tAssigned;
      if (tStartPickup && tPickedUp && tPickedUp >= tStartPickup) {
        tempoChegarAoClienteMin = (tPickedUp - tStartPickup) / 60000;
      }

      // 3. Tempo para voltar ao petshop (finalizando a corrida até o pet)
      let tempoVoltarAoPetshopMin: number | null = null;
      if (tPickedUp && tArrivedShop && tArrivedShop >= tPickedUp) {
        tempoVoltarAoPetshopMin = (tArrivedShop - tPickedUp) / 60000;
      }

      // 4. Tempo para retorno ao cliente (finalizando a corrida de volta)
      let tempoRetornoAoClienteMin: number | null = null;
      if (tEnRouteReturn && tDelivered && tDelivered >= tEnRouteReturn) {
        tempoRetornoAoClienteMin = (tDelivered - tEnRouteReturn) / 60000;
      }

      // 5. Tempo de atendimento geral do pet (ciclo completo do pet sob responsabilidade do petshop)
      let tempoGeralDoPetMin: number | null = null;
      const tPetSaiuDeCasa = tPickedUp || tStartPickup;
      const tPetEntregue = tDelivered || (order.tutor_confirmed_at ? new Date(order.tutor_confirmed_at).getTime() : null);
      if (tPetSaiuDeCasa && tPetEntregue && tPetEntregue >= tPetSaiuDeCasa) {
        tempoGeralDoPetMin = (tPetEntregue - tPetSaiuDeCasa) / 60000;
      }

      rides.push({
        id: order.id,
        code: order.code ? `#${order.code}` : `#${order.id.slice(0, 6).toUpperCase()}`,
        appointmentId: appt?.id,
        userId: appt?.user_id || order.id,
        tutorName: tutor.name,
        tutorPhone: tutor.phone,
        petName: appt?.pets?.name || "Pet",
        petSpecies: appt?.pets?.species,
        district: order.addresses?.district || "Franco da Rocha",
        driverName: driver?.name || "Motorista Designado",
        createdAt: orderDate,
        scheduledAt: new Date(appt?.scheduled_at || orderDate),
        tempoRecebimentoCorridaMin,
        tempoChegarAoClienteMin,
        tempoVoltarAoPetshopMin,
        tempoRetornoAoClienteMin,
        tempoGeralDoPetMin,
        statusGeral: appt?.status || "pendente",
        opsStatus: appt?.ops_status || "agendado",
      });
    });

    // Filtro por termo de busca
    const filteredRides = rides.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.tutorName.toLowerCase().includes(q) ||
        r.petName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        (r.district && r.district.toLowerCase().includes(q))
      );
    });

    // ORDENAÇÃO: DO MAIOR PARA O MENOR TEMPO (conforme pedido pelo usuário)
    const sortedRides = [...filteredRides].sort((a, b) => {
      if (taxiSortBy === "maior_tempo_geral") {
        return (b.tempoGeralDoPetMin ?? -1) - (a.tempoGeralDoPetMin ?? -1);
      }
      if (taxiSortBy === "maior_chegada_cliente") {
        return (b.tempoChegarAoClienteMin ?? -1) - (a.tempoChegarAoClienteMin ?? -1);
      }
      if (taxiSortBy === "maior_volta_pet") {
        return (b.tempoVoltarAoPetshopMin ?? -1) - (a.tempoVoltarAoPetshopMin ?? -1);
      }
      if (taxiSortBy === "maior_retorno_cliente") {
        return (b.tempoRetornoAoClienteMin ?? -1) - (a.tempoRetornoAoClienteMin ?? -1);
      }
      if (taxiSortBy === "maior_recebimento_corrida") {
        return (b.tempoRecebimentoCorridaMin ?? -1) - (a.tempoRecebimentoCorridaMin ?? -1);
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // CONSOLIDAÇÃO POR CLIENTE (agrupamento por cliente, ordenado do maior para menor tempo geral)
    const clientMap = new Map<
      string,
      {
        userId: string;
        tutorName: string;
        tutorPhone?: string | null;
        totalCorridas: number;
        petNames: Set<string>;
        districts: Set<string>;
        somaTempoGeral: number;
        countGeral: number;
        somaChegarCliente: number;
        countChegar: number;
        somaVoltarPet: number;
        countVoltar: number;
        somaRetornoCliente: number;
        countRetorno: number;
      }
    >();

    filteredRides.forEach((r) => {
      const existing = clientMap.get(r.userId) || {
        userId: r.userId,
        tutorName: r.tutorName,
        tutorPhone: r.tutorPhone,
        totalCorridas: 0,
        petNames: new Set<string>(),
        districts: new Set<string>(),
        somaTempoGeral: 0,
        countGeral: 0,
        somaChegarCliente: 0,
        countChegar: 0,
        somaVoltarPet: 0,
        countVoltar: 0,
        somaRetornoCliente: 0,
        countRetorno: 0,
      };

      existing.totalCorridas += 1;
      if (r.petName) existing.petNames.add(r.petName);
      if (r.district) existing.districts.add(r.district);

      if (r.tempoGeralDoPetMin !== null) {
        existing.somaTempoGeral += r.tempoGeralDoPetMin;
        existing.countGeral += 1;
      }
      if (r.tempoChegarAoClienteMin !== null) {
        existing.somaChegarCliente += r.tempoChegarAoClienteMin;
        existing.countChegar += 1;
      }
      if (r.tempoVoltarAoPetshopMin !== null) {
        existing.somaVoltarPet += r.tempoVoltarAoPetshopMin;
        existing.countVoltar += 1;
      }
      if (r.tempoRetornoAoClienteMin !== null) {
        existing.somaRetornoCliente += r.tempoRetornoAoClienteMin;
        existing.countRetorno += 1;
      }

      clientMap.set(r.userId, existing);
    });

    const clientRows = Array.from(clientMap.values()).map((c) => ({
      userId: c.userId,
      tutorName: c.tutorName,
      tutorPhone: c.tutorPhone,
      totalCorridas: c.totalCorridas,
      petsList: Array.from(c.petNames).join(", "),
      districtsList: Array.from(c.districts).join(", "),
      mediaTempoGeralMin: c.countGeral > 0 ? c.somaTempoGeral / c.countGeral : null,
      mediaChegarClienteMin: c.countChegar > 0 ? c.somaChegarCliente / c.countChegar : null,
      mediaVoltarPetMin: c.countVoltar > 0 ? c.somaVoltarPet / c.countVoltar : null,
      mediaRetornoClienteMin: c.countRetorno > 0 ? c.somaRetornoCliente / c.countRetorno : null,
    }));

    // Ordena clientes do maior para o menor tempo geral
    const sortedClients = clientRows.sort(
      (a, b) => (b.mediaTempoGeralMin ?? -1) - (a.mediaTempoGeralMin ?? -1),
    );

    // Médias globais do Táxi Pet
    const calcAvg = (getter: (r: (typeof rides)[0]) => number | null) => {
      const vals = filteredRides.map(getter).filter((v): v is number => v !== null && !isNaN(v) && v >= 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const mediaRecebimentoMin = calcAvg((r) => r.tempoRecebimentoCorridaMin);
    const mediaChegarClienteMin = calcAvg((r) => r.tempoChegarAoClienteMin);
    const mediaVoltarPetMin = calcAvg((r) => r.tempoVoltarAoPetshopMin);
    const mediaRetornoClienteMin = calcAvg((r) => r.tempoRetornoAoClienteMin);
    const mediaGeralDoPetMin = calcAvg((r) => r.tempoGeralDoPetMin);

    return {
      rides: sortedRides,
      clients: sortedClients,
      totalCorridas: filteredRides.length,
      totalClientes: sortedClients.length,
      mediaRecebimentoMin,
      mediaChegarClienteMin,
      mediaVoltarPetMin,
      mediaRetornoClienteMin,
      mediaGeralDoPetMin,
    };
  }, [rawOrders, profileMap, dateRange, search, taxiSortBy]);

  // =========================================================================
  // MÓDULO 2: CRONOANÁLISE DO ATENDIMENTO NO PET SHOP (BANHO, TOSA, VET, FILA)
  // =========================================================================
  const atendimentoAnalysis = useMemo(() => {
    const items: Array<{
      id: string;
      code: string;
      tutorName: string;
      tutorPhone?: string | null;
      petName: string;
      serviceName: string;
      category: string;
      scheduledAt: Date;
      durationPrevistaMin: number;

      // 1. Tempo de espera no petshop (chegada na loja -> início real do atendimento)
      tempoEsperaLojaMin: number | null;

      // 2. Duração real do procedimento na bancada/consultório
      tempoDuracaoRealMin: number | null;

      // 3. Diferença Real vs Previsto
      desvioMin: number | null;

      // 4. Tempo de pós-atendimento (término do atendimento -> saída da loja)
      tempoAposAtendimentoMin: number | null;

      statusGeral: string;
      opsStatus: string;
    }> = [];

    (rawAppointments ?? []).forEach((appt) => {
      const apptDate = new Date(appt.scheduled_at || appt.created_at);
      if (apptDate < dateRange.start || apptDate > dateRange.end) return;

      const cat = ((appt.services as any)?.category || "").toLowerCase();
      const sName = ((appt.services as any)?.name || "").toLowerCase();
      const isCirurgia = cat.includes("cirurg") || sName.includes("cirurg") || sName.includes("castra");
      const isVet = cat.includes("vet") || cat.includes("clinic") || isCirurgia;
      const isBanho = !isVet;

      if (categoryFilter === "cirurgia" && !isCirurgia) return;
      if (categoryFilter === "veterinario" && (!isVet || isCirurgia)) return;
      if (categoryFilter === "banho" && !isBanho) return;

      const tutor = profileMap.get(appt.user_id) || { name: "Cliente" };
      const durationPrevistaMin = (appt.services as any)?.duration_min || 45;

      const hist = historyByAppt.get(appt.id) || [];
      const hChegouLoja = hist.find((h) => h.status === "pet_chegou_petshop");
      const hInicio = hist.find((h) => h.status === "em_atendimento");
      const hFim = hist.find((h) => h.status === "servico_concluido" || h.status === "pet_entregue" || h.status === "finalizado");
      const hSaida = hist.find((h) => h.status === "em_rota_devolucao" || h.status === "pet_entregue" || h.status === "finalizado");

      const tChegou = hChegouLoja ? new Date(hChegouLoja.created_at).getTime() : new Date(appt.scheduled_at || appt.created_at).getTime();
      const tInicio = hInicio ? new Date(hInicio.created_at).getTime() : null;
      const tFim = hFim ? new Date(hFim.created_at).getTime() : null;
      const tSaida = hSaida ? new Date(hSaida.created_at).getTime() : null;

      // 1. Tempo de espera na loja
      let tempoEsperaLojaMin: number | null = null;
      if (tChegou && tInicio && tInicio >= tChegou) {
        tempoEsperaLojaMin = (tInicio - tChegou) / 60000;
      }

      // 2. Duração real do atendimento
      let tempoDuracaoRealMin: number | null = null;
      if (tInicio && tFim && tFim >= tInicio) {
        tempoDuracaoRealMin = (tFim - tInicio) / 60000;
      } else if (tInicio && appt.ops_status === "em_atendimento") {
        tempoDuracaoRealMin = Math.max(0, (Date.now() - tInicio) / 60000);
      } else if (appt.status === "concluido") {
        tempoDuracaoRealMin = durationPrevistaMin;
      }

      // 3. Desvio vs previsto
      let desvioMin: number | null = null;
      if (tempoDuracaoRealMin !== null) {
        desvioMin = tempoDuracaoRealMin - durationPrevistaMin;
      }

      // 4. Tempo pós-atendimento
      let tempoAposAtendimentoMin: number | null = null;
      if (tFim && tSaida && tSaida >= tFim) {
        tempoAposAtendimentoMin = (tSaida - tFim) / 60000;
      }

      items.push({
        id: appt.id,
        code: `#${appt.id.slice(0, 6).toUpperCase()}`,
        tutorName: tutor.name,
        tutorPhone: tutor.phone,
        petName: (appt.pets as any)?.name || "Pet",
        serviceName: (appt.services as any)?.name || "Serviço",
        category: isCirurgia ? "Cirurgia" : isVet ? "Veterinário" : "Banho & Tosa",
        scheduledAt: apptDate,
        durationPrevistaMin,
        tempoEsperaLojaMin,
        tempoDuracaoRealMin,
        desvioMin,
        tempoAposAtendimentoMin,
        statusGeral: appt.status,
        opsStatus: appt.ops_status || "agendado",
      });
    });

    // Filtro por termo de busca
    const filteredItems = items.filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.tutorName.toLowerCase().includes(q) ||
        item.petName.toLowerCase().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    });

    // ORDENAÇÃO: DO MAIOR PARA O MENOR TEMPO
    const sortedItems = [...filteredItems].sort((a, b) => {
      if (atendimentoSortBy === "maior_duracao_real") {
        return (b.tempoDuracaoRealMin ?? -1) - (a.tempoDuracaoRealMin ?? -1);
      }
      if (atendimentoSortBy === "maior_espera_loja") {
        return (b.tempoEsperaLojaMin ?? -1) - (a.tempoEsperaLojaMin ?? -1);
      }
      if (atendimentoSortBy === "maior_desvio") {
        return (b.desvioMin ?? -999) - (a.desvioMin ?? -999);
      }
      return b.scheduledAt.getTime() - a.scheduledAt.getTime();
    });

    // Médias
    const calcAvg = (getter: (i: (typeof items)[0]) => number | null) => {
      const vals = filteredItems.map(getter).filter((v): v is number => v !== null && !isNaN(v) && v >= 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const mediaEsperaLojaMin = calcAvg((i) => i.tempoEsperaLojaMin);
    const mediaDuracaoRealMin = calcAvg((i) => i.tempoDuracaoRealMin);
    const mediaPrevistaMin = calcAvg((i) => i.durationPrevistaMin);
    const mediaAposAtendimentoMin = calcAvg((i) => i.tempoAposAtendimentoMin);

    const comDesvio = filteredItems.filter((i) => i.desvioMin !== null);
    const noPrazo = comDesvio.filter((i) => (i.desvioMin || 0) <= 0).length;
    const taxaPontualidade = comDesvio.length > 0 ? (noPrazo / comDesvio.length) * 100 : 0;

    return {
      items: sortedItems,
      totalCount: filteredItems.length,
      mediaEsperaLojaMin,
      mediaDuracaoRealMin,
      mediaPrevistaMin,
      mediaAposAtendimentoMin,
      taxaPontualidade,
    };
  }, [rawAppointments, historyByAppt, profileMap, dateRange, categoryFilter, search, atendimentoSortBy]);

  // =========================================================================
  // MÓDULO 3: CRONOANÁLISE DO CHAT (SUPORTE AO CLIENTE)
  // =========================================================================
  const chatAnalysis = useMemo(() => {
    const grouped = new Map<string, ChatMessage[]>();
    chatMessages.forEach((msg) => {
      const convId = msg.conversationId || "geral";
      const list = grouped.get(convId) || [];
      list.push(msg);
      grouped.set(convId, list);
    });

    const rows: Array<{
      conversationId: string;
      tutorName: string;
      tutorPhone?: string | null;
      petName?: string | null;
      contextTag?: string | null;
      startedAt: Date;
      tempoPrimeiraRespostaMin: number | null;
      tempoTotalConversaMin: number | null;
      status: "aberto" | "respondido" | "fechado";
      messageCount: number;
    }> = [];

    grouped.forEach((msgs, convId) => {
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      if (sorted.length === 0) return;

      const firstMsg = sorted[0];
      const startedAt = new Date(firstMsg.createdAt);
      if (startedAt < dateRange.start || startedAt > dateRange.end) return;

      const firstTutorMsg = sorted.find((m) => m.senderRole === "tutor") || firstMsg;
      const tutorTime = new Date(firstTutorMsg.createdAt).getTime();

      const firstStoreMsg = sorted.find(
        (m) =>
          (m.senderRole === "loja" || m.senderRole === "vet") &&
          new Date(m.createdAt).getTime() >= tutorTime,
      );

      let tempoPrimeiraRespostaMin: number | null = null;
      if (firstStoreMsg) {
        tempoPrimeiraRespostaMin = Math.max(
          0,
          (new Date(firstStoreMsg.createdAt).getTime() - tutorTime) / 60000,
        );
      }

      const lastMsg = sorted[sorted.length - 1];
      const isClosed = sorted.some((m) => m.status === "fechado") || lastMsg.status === "fechado";
      const closedMsg = sorted.find((m) => m.status === "fechado") || (isClosed ? lastMsg : null);
      const closedAt = closedMsg ? new Date(closedMsg.createdAt) : null;

      let tempoTotalConversaMin: number | null = null;
      if (isClosed && closedAt) {
        tempoTotalConversaMin = Math.max(0, (closedAt.getTime() - startedAt.getTime()) / 60000);
      } else {
        tempoTotalConversaMin = Math.max(0, (new Date(lastMsg.createdAt).getTime() - startedAt.getTime()) / 60000);
      }

      rows.push({
        conversationId: convId,
        tutorName: firstMsg.tutorName || "Tutor",
        tutorPhone: firstMsg.tutorPhone,
        petName: firstMsg.petName,
        contextTag: firstMsg.contextTag || "Geral",
        startedAt,
        tempoPrimeiraRespostaMin,
        tempoTotalConversaMin,
        status: isClosed ? "fechado" : firstStoreMsg ? "respondido" : "aberto",
        messageCount: sorted.length,
      });
    });

    const filtered = rows.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.tutorName.toLowerCase().includes(q) ||
        (r.petName && r.petName.toLowerCase().includes(q))
      );
    });

    // Ordena do maior para menor tempo de espera
    const sorted = [...filtered].sort(
      (a, b) => (b.tempoPrimeiraRespostaMin ?? -1) - (a.tempoPrimeiraRespostaMin ?? -1),
    );

    const withResp = sorted.filter((r) => r.tempoPrimeiraRespostaMin !== null);
    const mediaRespMin =
      withResp.length > 0
        ? withResp.reduce((acc, r) => acc + (r.tempoPrimeiraRespostaMin || 0), 0) / withResp.length
        : null;

    return {
      rows: sorted,
      totalConversas: sorted.length,
      mediaRespMin,
    };
  }, [chatMessages, dateRange, search]);

  // ==========================================
  // EXPORTAÇÃO EXCEL COMPLETA
  // ==========================================
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Táxi Pet
    const taxiData = taxiAnalysis.rides.map((r) => ({
      "Código Corrida": r.code,
      "Data": formatDate(r.scheduledAt),
      "Cliente": r.tutorName,
      "Telefone": r.tutorPhone || "",
      "Pet": r.petName,
      "Bairro": r.district || "",
      "Motorista": r.driverName,
      "1. Recebimento da Corrida (min)": r.tempoRecebimentoCorridaMin !== null ? Math.round(r.tempoRecebimentoCorridaMin) : "—",
      "2. Chegar ao Cliente (min)": r.tempoChegarAoClienteMin !== null ? Math.round(r.tempoChegarAoClienteMin) : "—",
      "3. Voltar ao Petshop (min)": r.tempoVoltarAoPetshopMin !== null ? Math.round(r.tempoVoltarAoPetshopMin) : "—",
      "4. Retorno ao Cliente (min)": r.tempoRetornoAoClienteMin !== null ? Math.round(r.tempoRetornoAoClienteMin) : "—",
      "Tempo Geral do Pet Fora de Casa (min)": r.tempoGeralDoPetMin !== null ? Math.round(r.tempoGeralDoPetMin) : "—",
      "Status": r.opsStatus,
    }));
    const wsTaxi = XLSX.utils.json_to_sheet(taxiData);
    XLSX.utils.book_append_sheet(wb, wsTaxi, "Cronoanálise Táxi Pet");

    // 2. Clientes Táxi Pet Consolidado
    const clientData = taxiAnalysis.clients.map((c) => ({
      "Cliente": c.tutorName,
      "Telefone": c.tutorPhone || "",
      "Total de Corridas": c.totalCorridas,
      "Pets": c.petsList,
      "Bairros": c.districtsList,
      "Média Chegar ao Cliente (min)": c.mediaChegarClienteMin !== null ? Math.round(c.mediaChegarClienteMin) : "—",
      "Média Voltar ao Petshop (min)": c.mediaVoltarPetMin !== null ? Math.round(c.mediaVoltarPetMin) : "—",
      "Média Retorno ao Cliente (min)": c.mediaRetornoClienteMin !== null ? Math.round(c.mediaRetornoClienteMin) : "—",
      "Média Tempo Geral do Pet (min)": c.mediaTempoGeralMin !== null ? Math.round(c.mediaTempoGeralMin) : "—",
    }));
    const wsClients = XLSX.utils.json_to_sheet(clientData);
    XLSX.utils.book_append_sheet(wb, wsClients, "Táxi Pet - Por Cliente");

    // 3. Atendimento no Petshop
    const apptData = atendimentoAnalysis.items.map((i) => ({
      "Código": i.code,
      "Data": formatDate(i.scheduledAt),
      "Cliente": i.tutorName,
      "Telefone": i.tutorPhone || "",
      "Pet": i.petName,
      "Serviço": i.serviceName,
      "Categoria": i.category,
      "Tempo Espera no Petshop (min)": i.tempoEsperaLojaMin !== null ? Math.round(i.tempoEsperaLojaMin) : "—",
      "Duração Real Atendimento (min)": i.tempoDuracaoRealMin !== null ? Math.round(i.tempoDuracaoRealMin) : "—",
      "Duração Prevista (min)": i.durationPrevistaMin,
      "Diferença Real vs Previsto (min)": i.desvioMin !== null ? Math.round(i.desvioMin) : "—",
      "Tempo Pós-Atendimento (min)": i.tempoAposAtendimentoMin !== null ? Math.round(i.tempoAposAtendimentoMin) : "—",
    }));
    const wsAppt = XLSX.utils.json_to_sheet(apptData);
    XLSX.utils.book_append_sheet(wb, wsAppt, "Atendimento no Pet Shop");

    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Cronoanalise_BigDog_${masterModule.toUpperCase()}_${todayStr}.xlsx`);
  };

  const handleRefresh = () => {
    refetchOrders();
    refetchAppts();
    setChatMessages(getAllChatMessages());
  };

  return (
    <div className="space-y-6">
      {/* ========================================================
          CABEÇALHO COM TÍTULO CENTRALIZADO, SOMBRA AZUL E DIVISÓRIA
          ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50/90 via-blue-100/60 to-blue-50/90 p-6 text-center shadow-sm dark:border-blue-800 dark:from-blue-950/40 dark:via-blue-900/30 dark:to-blue-950/40">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600/10 px-3.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
            <Timer className="h-4 w-4" />
            Auditoria Gerencial de Cronoanálise
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-900 dark:text-blue-100 tracking-tight drop-shadow-[0_2px_4px_rgba(37,99,235,0.35)]">
            ⏱️ Cronoanálise: Atendimento vs. Táxi Pet
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-blue-800/90 dark:text-blue-200/90">
            Acompanhamento detalhado das etapas cronometradas, ordenadas por padrão do maior para o menor tempo
          </p>
        </div>

        {/* Linha divisória em azul suave */}
        <div className="mx-auto my-4 h-0.5 w-3/4 max-w-xl bg-gradient-to-r from-transparent via-blue-300 to-transparent dark:via-blue-700" />

        {/* Botões de Ação do Cabeçalho */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-blue-200 bg-white/80 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar Cronometragens
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="border-blue-300 bg-white/80 font-semibold text-blue-900 hover:bg-blue-50 dark:border-blue-700 dark:bg-card dark:text-blue-100"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            Exportar Planilha (.xlsx)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-blue-200 bg-white/80 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* ========================================================
          ABAS MESTRAS: SEPARAÇÃO ATENDIMENTO VS TÁXI PET
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Aba Atendimento */}
        <button
          type="button"
          onClick={() => setMasterModule("atendimento")}
          className={cn(
            "flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden",
            masterModule === "atendimento"
              ? "border-blue-600 bg-blue-600/10 shadow-md ring-2 ring-blue-500/20"
              : "border-blue-200 bg-white/70 hover:bg-blue-50/50 dark:border-blue-800 dark:bg-card",
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2 text-base font-extrabold text-blue-950 dark:text-blue-100">
              <Scissors className="h-5 w-5 text-blue-600" />
              1. Atendimento (no Pet Shop)
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-2 py-0.5",
                masterModule === "atendimento"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-blue-200 text-blue-800",
              )}
            >
              {atendimentoAnalysis.totalCount} Atendimentos
            </Badge>
          </div>
          <p className="mt-1 text-xs font-medium text-blue-900/80 dark:text-blue-200/80">
            Fila de espera na loja, duração real na bancada/consultório vs. previsto e suporte no chat.
          </p>
        </button>

        {/* Aba Táxi Pet */}
        <button
          type="button"
          onClick={() => setMasterModule("taxi")}
          className={cn(
            "flex flex-col items-start p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden",
            masterModule === "taxi"
              ? "border-blue-600 bg-blue-600/10 shadow-md ring-2 ring-blue-500/20"
              : "border-blue-200 bg-white/70 hover:bg-blue-50/50 dark:border-blue-800 dark:bg-card",
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-2 text-base font-extrabold text-blue-950 dark:text-blue-100">
              <Truck className="h-5 w-5 text-blue-600" />
              2. Táxi Pet (Transporte & Corridas)
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-2 py-0.5",
                masterModule === "taxi"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-blue-200 text-blue-800",
              )}
            >
              {taxiAnalysis.totalCorridas} Corridas · {taxiAnalysis.totalClientes} Clientes
            </Badge>
          </div>
          <p className="mt-1 text-xs font-medium text-blue-900/80 dark:text-blue-200/80">
            Recebimento da corrida, tempo até o cliente, volta ao petshop, retorno e tempo geral do pet por cliente.
          </p>
        </button>
      </div>

      {/* ========================================================
          BARRA DE FILTROS COMUNS (PERÍODO E BUSCA)
          ======================================================== */}
      <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-sm dark:border-blue-800/60 dark:bg-blue-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Período */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
              📅 Período:
            </span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { key: "hoje", label: "Hoje" },
                  { key: "7dias", label: "7 dias" },
                  { key: "30dias", label: "30 dias" },
                  { key: "mes", label: "Mês atual" },
                  { key: "todos", label: "Histórico Completo" },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-bold transition-colors",
                    period === p.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "border border-blue-200 bg-white/80 text-blue-800 hover:bg-blue-100/60 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Busca Rápida */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-blue-400" />
            <Input
              placeholder="Buscar por cliente, pet, bairro ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-xl border-blue-200 bg-white pl-8 text-xs font-medium text-blue-900 placeholder:text-blue-400/80 dark:border-blue-800 dark:bg-card dark:text-blue-100"
            />
          </div>
        </div>
      </div>

      {/* ========================================================
          CONTEÚDO DO MÓDULO 1: TÁXI PET (CORRIDAS & LOGÍSTICA)
          ======================================================== */}
      {masterModule === "taxi" && (
        <div className="space-y-6">
          {/* CARDS COM AS 5 CRONOMETRAGENS SOLICITADAS PELO USUÁRIO */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* 1. Recebimento da Corrida */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                1. Recebimento da Corrida
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(taxiAnalysis.mediaRecebimentoMin)}
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo desde o agendamento até a corrida ser atribuída ao motorista.
              </p>
            </div>

            {/* 2. Chegar ao Cliente */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                2. Chegar ao Cliente
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(taxiAnalysis.mediaChegarClienteMin)}
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Deslocamento do motorista até chegar e retirar o pet na casa do tutor.
              </p>
            </div>

            {/* 3. Voltar ao Petshop */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                3. Voltar ao Petshop
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(taxiAnalysis.mediaVoltarPetMin)}
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo do pet no veículo até a chegada na loja (finalizando a corrida até o pet).
              </p>
            </div>

            {/* 4. Retorno ao Cliente */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                4. Retorno ao Cliente
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(taxiAnalysis.mediaRetornoClienteMin)}
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Saída do petshop até a entrega no lar (finalizando a corrida de volta).
              </p>
            </div>

            {/* 5. Tempo Geral do Pet */}
            <div className="rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-100/70 via-white to-blue-100/50 p-4 shadow-sm dark:border-blue-700 dark:from-blue-950/50 dark:via-card dark:to-blue-900/30">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-200 block">
                5. Tempo Geral do Pet
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(taxiAnalysis.mediaGeralDoPetMin)}
              </div>
              <p className="mt-2 text-xs font-semibold text-blue-900/90 dark:text-blue-200/90 leading-relaxed border-t border-blue-200 pt-2 dark:border-blue-800">
                💡 Ciclo completo: da retirada até a entrega final na casa do cliente.
              </p>
            </div>
          </div>

          {/* BARRA DE CONTROLE: ORDENAÇÃO E VISÃO (POR CORRIDA VS CONSOLIDADO POR CLIENTE) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200/80 pb-3 dark:border-blue-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTaxiViewMode("corridas")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  taxiViewMode === "corridas"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
                )}
              >
                📋 Detalhado por Corrida ({taxiAnalysis.rides.length})
              </button>

              <button
                type="button"
                onClick={() => setTaxiViewMode("consolidado_cliente")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  taxiViewMode === "consolidado_cliente"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
                )}
              >
                👥 Consolidado por Cliente ({taxiAnalysis.clients.length})
              </button>
            </div>

            {/* SELETOR DE ORDENAÇÃO (PADRÃO: DO MAIOR PARA O MENOR TEMPO) */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Ordenar por:
              </span>
              <select
                value={taxiSortBy}
                onChange={(e) => setTaxiSortBy(e.target.value as TaxiSortOption)}
                className="rounded-xl border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-blue-800 dark:bg-card dark:text-blue-100"
              >
                <option value="maior_tempo_geral">⏳ Maior Tempo Geral do Pet (Maior p/ Menor)</option>
                <option value="maior_chegada_cliente">🚗 Maior Tempo p/ Chegar ao Cliente</option>
                <option value="maior_volta_pet">🐾 Maior Tempo p/ Voltar ao Petshop</option>
                <option value="maior_retorno_cliente">🏠 Maior Tempo p/ Retorno ao Cliente</option>
                <option value="maior_recebimento_corrida">⚡ Maior Tempo de Recebimento da Corrida</option>
                <option value="mais_recente">📅 Mais Recente Primeiro</option>
              </select>
            </div>
          </div>

          {/* TABELA 1: DETALHADO POR CORRIDA (COM AS 5 ETAPAS E ORDENAÇÃO) */}
          {taxiViewMode === "corridas" && (
            <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm overflow-hidden dark:border-blue-800 dark:bg-card">
              <div className="overflow-auto max-h-[560px] relative">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="border-b-2 border-blue-300 dark:border-blue-700">
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Cliente</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Tutor</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Pet</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Nome</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Bairro</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Região</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Motorista</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Escalado</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">1. Recebimento</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">da Corrida</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">2. Chegada</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">ao Cliente</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">3. Volta</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">ao Petshop</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">4. Retorno</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">ao Cliente</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 text-center bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-black leading-tight">5. Tempo Geral</div>
                        <div className="text-[10px] font-extrabold text-blue-800 dark:text-blue-200 leading-tight">(Total Pet)</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Ações</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Chat</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                    {taxiAnalysis.rides.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-foreground font-medium">
                          Nenhuma corrida encontrada para o período selecionado.
                        </td>
                      </tr>
                    ) : (
                      taxiAnalysis.rides.map((ride) => (
                        <tr
                          key={ride.id}
                          className="hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-950/30"
                        >
                          {/* Cliente */}
                          <td className="py-2 px-2">
                            <span className="font-bold text-blue-950 dark:text-blue-100 block leading-tight">
                              {ride.tutorName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {ride.code} · {formatDate(ride.scheduledAt)}
                            </span>
                          </td>

                          {/* Pet */}
                          <td className="py-2 px-2">
                            <span className="font-semibold text-blue-900 dark:text-blue-200 block leading-tight">
                              🐾 {ride.petName}
                            </span>
                            {ride.petSpecies && (
                              <span className="text-[10px] text-muted-foreground">
                                {ride.petSpecies}
                              </span>
                            )}
                          </td>

                          {/* Bairro */}
                          <td className="py-2 px-2">
                            <span className="font-medium text-foreground flex items-center gap-1 text-[11px] leading-tight">
                              <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                              <span className="truncate max-w-[110px]">{ride.district}</span>
                            </span>
                          </td>

                          {/* Motorista */}
                          <td className="py-2 px-2">
                            <span className="font-medium text-muted-foreground text-[11px] leading-tight block truncate max-w-[100px]">
                              {ride.driverName}
                            </span>
                          </td>

                          {/* 1. Recebimento da corrida */}
                          <td className="py-2 px-1.5 text-center">
                            {renderAgilityBadge(ride.tempoRecebimentoCorridaMin, { fast: 10, moderate: 30 })}
                          </td>

                          {/* 2. Chegar ao cliente */}
                          <td className="py-2 px-1.5 text-center">
                            {renderAgilityBadge(ride.tempoChegarAoClienteMin, { fast: 15, moderate: 25 })}
                          </td>

                          {/* 3. Voltar ao petshop */}
                          <td className="py-2 px-1.5 text-center">
                            {renderAgilityBadge(ride.tempoVoltarAoPetshopMin, { fast: 15, moderate: 25 })}
                          </td>

                          {/* 4. Retorno ao cliente */}
                          <td className="py-2 px-1.5 text-center">
                            {renderAgilityBadge(ride.tempoRetornoAoClienteMin, { fast: 15, moderate: 25 })}
                          </td>

                          {/* 5. Tempo Geral do Pet (Maior destaque e ordenação) */}
                          <td className="py-2 px-2 text-center bg-blue-50/80 dark:bg-blue-950/40">
                            <span className="text-xs font-black text-blue-950 dark:text-blue-100 block leading-tight">
                              {formatMinutesExplanatory(ride.tempoGeralDoPetMin)}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="py-2 px-1.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                openInAppChat({
                                  tutorName: ride.tutorName,
                                  tutorPhone: ride.tutorPhone || undefined,
                                  petName: ride.petName,
                                  contextTag: `Táxi Pet ${ride.code}`,
                                });
                              }}
                              className="h-6 px-2 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA 2: CONSOLIDADO POR CLIENTE (ORDENADO DO MAIOR PARA O MENOR TEMPO) */}
          {taxiViewMode === "consolidado_cliente" && (
            <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm overflow-hidden dark:border-blue-800 dark:bg-card">
              <div className="border-b border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    Tempo Médio das Corridas por Cliente (Ordenado do Maior p/ Menor Tempo)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permite identificar clientes cujos pets passaram mais tempo em trânsito
                  </p>
                </div>
              </div>

              <div className="overflow-auto max-h-[560px] relative">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="border-b-2 border-blue-300 dark:border-blue-700">
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Cliente</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Tutor</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Contato</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Telefone</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Total</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Corridas</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Pets</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Atendidos</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Bairros</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Região</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Média Chegar</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">ao Cliente</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Média Voltar</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">ao Petshop</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Média Retorno</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">ao Lar</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 text-center bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-black leading-tight">Média Geral</div>
                        <div className="text-[10px] font-extrabold text-blue-800 dark:text-blue-200 leading-tight">(Tempo Pet)</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Ações</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Chat</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                    {taxiAnalysis.clients.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-foreground font-medium">
                          Nenhum cliente registrado no período.
                        </td>
                      </tr>
                    ) : (
                      taxiAnalysis.clients.map((client) => (
                        <tr
                          key={client.userId}
                          className="hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-950/30"
                        >
                          <td className="py-2 px-2 font-bold text-blue-950 dark:text-blue-100">
                            {client.tutorName}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground text-[11px]">
                            {client.tutorPhone || "—"}
                          </td>
                          <td className="py-2 px-1.5 text-center font-bold">
                            {client.totalCorridas}
                          </td>
                          <td className="py-2 px-2 font-medium text-blue-900 dark:text-blue-200 text-[11px]">
                            🐾 {client.petsList || "—"}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground text-[11px]">
                            {client.districtsList || "—"}
                          </td>
                          <td className="py-2 px-1.5 text-center font-semibold text-[11px]">
                            {formatMinutesExplanatory(client.mediaChegarClienteMin)}
                          </td>
                          <td className="py-2 px-1.5 text-center font-semibold text-[11px]">
                            {formatMinutesExplanatory(client.mediaVoltarPetMin)}
                          </td>
                          <td className="py-2 px-1.5 text-center font-semibold text-[11px]">
                            {formatMinutesExplanatory(client.mediaRetornoClienteMin)}
                          </td>
                          <td className="py-2 px-2 text-center bg-blue-50/80 dark:bg-blue-950/40 font-black text-blue-950 dark:text-blue-100 text-[11px]">
                            {formatMinutesExplanatory(client.mediaTempoGeralMin)}
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                openInAppChat({
                                  tutorName: client.tutorName,
                                  tutorPhone: client.tutorPhone || undefined,
                                  contextTag: "Táxi Pet - Histórico",
                                });
                              }}
                              className="h-6 px-2 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1" />
                              Chat
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          CONTEÚDO DO MÓDULO 2: ATENDIMENTO NO PET SHOP
          ======================================================== */}
      {masterModule === "atendimento" && (
        <div className="space-y-6">
          {/* CARDS COM AS CRONOMETRAGENS DE ATENDIMENTO */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Espera no Petshop */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                Espera no Petshop (Fila)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-950 dark:text-blue-50">
                  {formatMinutesExplanatory(atendimentoAnalysis.mediaEsperaLojaMin)}
                </span>
                <span className="text-xs font-bold text-blue-700">Meta: ≤ 15 min</span>
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo em que o pet aguardou na loja antes de iniciar o banho, tosa ou consulta.
              </p>
            </div>

            {/* 2. Duração Real do Procedimento */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                Duração Real na Bancada
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-950 dark:text-blue-50">
                  {formatMinutesExplanatory(atendimentoAnalysis.mediaDuracaoRealMin)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  (Previsto: {formatMinutesExplanatory(atendimentoAnalysis.mediaPrevistaMin)})
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo efetivo de execução do procedimento por profissional.
              </p>
            </div>

            {/* 3. Pontualidade do Atendimento */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                Pontualidade da Execução
              </span>
              <div className="mt-1 text-2xl font-black text-emerald-600">
                {Math.round(atendimentoAnalysis.taxaPontualidade)}% no prazo
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Porcentagem de atendimentos concluídos dentro ou antes do tempo estimado.
              </p>
            </div>

            {/* 4. Resposta no Chat */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                1ª Resposta no Chat
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(chatAnalysis.mediaRespMin)}
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo para acolher o tutor quando envia mensagem de dúvida ou suporte.
              </p>
            </div>
          </div>

          {/* BARRA DE FILTROS & ORDENAÇÃO DO ATENDIMENTO (PADRÃO: MAIOR PARA O MENOR TEMPO) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200/80 pb-3 dark:border-blue-800">
            {/* Sub-abas do Atendimento */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAtendimentoSubTab("bancada")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  atendimentoSubTab === "bancada"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
                )}
              >
                ✂️ Atendimentos na Loja ({atendimentoAnalysis.items.length})
              </button>

              <button
                type="button"
                onClick={() => setAtendimentoSubTab("chat")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  atendimentoSubTab === "chat"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
                )}
              >
                💬 Suporte no Chat ({chatAnalysis.rows.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro de Categoria */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Categoria:
                </span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="rounded-xl border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 shadow-sm dark:border-blue-800 dark:bg-card dark:text-blue-100"
                >
                  <option value="todas">Todas as Categorias</option>
                  <option value="banho">🛁 Banho & Tosa</option>
                  <option value="veterinario">🩺 Veterinário Geral</option>
                  <option value="cirurgia">🏥 Cirurgias</option>
                </select>
              </div>

              {/* SELETOR DE ORDENAÇÃO (PADRÃO: DO MAIOR PARA O MENOR TEMPO) */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  Ordenar por:
                </span>
                <select
                  value={atendimentoSortBy}
                  onChange={(e) => setAtendimentoSortBy(e.target.value as AtendimentoSortOption)}
                  className="rounded-xl border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-blue-800 dark:bg-card dark:text-blue-100"
                >
                  <option value="maior_duracao_real">⏳ Maior Duração do Atendimento (Maior p/ Menor)</option>
                  <option value="maior_espera_loja">🛑 Maior Tempo de Espera no Petshop</option>
                  <option value="maior_desvio">⚠️ Maior Atraso em Relação ao Previsto</option>
                  <option value="mais_recente">📅 Mais Recente Primeiro</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABELA DE ATENDIMENTOS NA LOJA */}
          {atendimentoSubTab === "bancada" && (
            <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm overflow-hidden dark:border-blue-800 dark:bg-card">
              <div className="overflow-auto max-h-[560px] relative">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="border-b-2 border-blue-300 dark:border-blue-700">
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Cliente</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Tutor</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Pet</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Nome</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Serviço</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Categoria</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Data</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Horário</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Espera Loja</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">(Fila)</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 text-center bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-black leading-tight">Duração Real</div>
                        <div className="text-[10px] font-extrabold text-blue-800 dark:text-blue-200 leading-tight">(Bancada)</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Tempo</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Previsto</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Pontualidade</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">(Real vs Prev.)</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Ações</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Chat</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                    {atendimentoAnalysis.items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground font-medium">
                          Nenhum atendimento encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      atendimentoAnalysis.items.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-950/30"
                        >
                          <td className="py-2 px-2">
                            <span className="font-bold text-blue-950 dark:text-blue-100 block leading-tight">
                              {item.tutorName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {item.code}
                            </span>
                          </td>

                          <td className="py-2 px-2 font-semibold text-blue-900 dark:text-blue-200">
                            🐾 {item.petName}
                          </td>

                          <td className="py-2 px-2">
                            <span className="font-semibold text-foreground block leading-tight">
                              {item.serviceName}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1 py-0 mt-0.5",
                                item.category === "Cirurgia"
                                  ? "border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-800 dark:text-purple-300"
                                  : item.category === "Veterinário"
                                  ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                                  : "border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-300",
                              )}
                            >
                              {item.category}
                            </Badge>
                          </td>

                          <td className="py-2 px-2 text-[11px] text-muted-foreground leading-tight">
                            {formatDateTime(item.scheduledAt)}
                          </td>

                          {/* Tempo de espera na loja */}
                          <td className="py-2 px-1.5 text-center">
                            {renderAgilityBadge(item.tempoEsperaLojaMin, { fast: 15, moderate: 25 })}
                          </td>

                          {/* Duração real na bancada */}
                          <td className="py-2 px-2 text-center bg-blue-50/80 dark:bg-blue-950/40">
                            <span className="font-black text-blue-950 dark:text-blue-100 text-xs block">
                              {formatMinutesExplanatory(item.tempoDuracaoRealMin)}
                            </span>
                          </td>

                          {/* Tempo previsto */}
                          <td className="py-2 px-1.5 text-center font-semibold text-muted-foreground text-[11px]">
                            {formatMinutesExplanatory(item.durationPrevistaMin)}
                          </td>

                          {/* Pontualidade */}
                          <td className="py-2 px-2 text-center">
                            {renderPaceBadge(item.desvioMin)}
                          </td>

                          {/* Ações */}
                          <td className="py-2 px-1.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                openInAppChat({
                                  tutorName: item.tutorName,
                                  tutorPhone: item.tutorPhone || undefined,
                                  petName: item.petName,
                                  contextTag: item.serviceName,
                                });
                              }}
                              className="h-6 px-2 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA DE SUPORTE NO CHAT (ORDENADA DO MAIOR TEMPO DE RESPOSTA P/ MENOR) */}
          {atendimentoSubTab === "chat" && (
            <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm overflow-hidden dark:border-blue-800 dark:bg-card">
              <div className="border-b border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-600" />
                    Tempo de Resposta do Atendimento no Chat (Ordenado do Maior Tempo p/ Menor)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chamados ordenados pelos tutores que mais aguardaram por atendimento
                  </p>
                </div>
              </div>

              <div className="overflow-auto max-h-[560px] relative">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr className="border-b-2 border-blue-300 dark:border-blue-700">
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Cliente</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Tutor</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Pet</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Nome</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Assunto</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Contexto</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Início</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">do Chamado</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-2 text-center bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-black leading-tight">1ª Resposta</div>
                        <div className="text-[10px] font-extrabold text-blue-800 dark:text-blue-200 leading-tight">(Tempo Espera)</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Avaliação</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Rapidez</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Status</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Chamado</div>
                      </th>
                      <th className="sticky top-0 z-20 py-2 px-1.5 text-center bg-blue-100 dark:bg-blue-950 text-blue-950 dark:text-blue-100 border-b-2 border-blue-300 dark:border-blue-700">
                        <div className="font-bold leading-tight">Ações</div>
                        <div className="text-[10px] font-semibold text-blue-700/80 dark:text-blue-300/80 leading-tight">Chat</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                    {chatAnalysis.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground font-medium">
                          Nenhum chamado de chat no período.
                        </td>
                      </tr>
                    ) : (
                      chatAnalysis.rows.map((chat) => (
                        <tr
                          key={chat.conversationId}
                          className="hover:bg-blue-50/50 transition-colors dark:hover:bg-blue-950/30"
                        >
                          <td className="py-2 px-2 font-bold text-blue-950 dark:text-blue-100">
                            {chat.tutorName}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground text-[11px]">
                            {chat.petName ? `🐾 ${chat.petName}` : "—"}
                          </td>
                          <td className="py-2 px-2 font-medium text-foreground text-[11px]">
                            {chat.contextTag}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground text-[11px]">
                            {formatDateTime(chat.startedAt)}
                          </td>
                          <td className="py-2 px-2 text-center bg-blue-50/80 dark:bg-blue-950/40 font-black text-blue-950 dark:text-blue-100 text-[11px]">
                            {formatMinutesExplanatory(chat.tempoPrimeiraRespostaMin)}
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            {renderAgilityBadge(chat.tempoPrimeiraRespostaMin, { fast: 5, moderate: 15 })}
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1.5 py-0",
                                chat.status === "fechado"
                                  ? "border-muted text-muted-foreground bg-muted/30"
                                  : chat.status === "respondido"
                                  ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                  : "border-rose-300 text-rose-700 bg-rose-50 font-bold animate-pulse",
                              )}
                            >
                              {chat.status === "fechado"
                                ? "Fechado"
                                : chat.status === "respondido"
                                ? "Respondido"
                                : "Aguardando"}
                            </Badge>
                          </td>
                          <td className="py-2 px-1.5 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                openInAppChat({
                                  conversationId: chat.conversationId,
                                  tutorName: chat.tutorName,
                                  tutorPhone: chat.tutorPhone || undefined,
                                  petName: chat.petName || undefined,
                                  contextTag: chat.contextTag || undefined,
                                });
                              }}
                              className="h-6 px-2 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                            >
                              <MessageCircle className="h-3.5 w-3.5 mr-1" />
                              Chat
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default RelatorioCronoanalise;
