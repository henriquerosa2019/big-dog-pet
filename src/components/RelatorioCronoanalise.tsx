/**
 * Relatório de Cronoanálise & Eficiência dos Processos (KPIs de Atendimento e Logística)
 * Big Dog Pet - Franco da Rocha
 * 
 * Painel analítico com terminologia clara e explicativa (sem jargões industriais complexos):
 * - Tempo de 1ª Resposta no Chat (SLA e rapidez de acolhimento do tutor)
 * - Tempo de Conclusão da Conversa no Chat
 * - Tempo de Coleta pelo Táxi Pet (Deslocamento até o petshop e tempo do pet no veículo)
 * - Tempo de Espera no Petshop Antes do Atendimento (Fila de espera)
 * - Duração Real do Atendimento vs. Tempo Previsto (Pontualidade na execução)
 * - Tempo da Rota de Devolução e Tempo Total do Pet Fora de Casa
 * - Índice de Aproveitamento do Tempo do Pet (% de tempo em cuidado direto)
 */

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  MessageCircle,
  Truck,
  Scissors,
  HeartPulse,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  Award,
  RefreshCw,
  Eye,
  Info,
  ChevronRight,
  Compass,
  Timer,
  Smile,
  ShieldCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { getAllChatMessages, type ChatMessage } from "@/lib/inAppChat";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CronoPeriod = "hoje" | "7dias" | "30dias" | "mes" | "todos";
export type LogisticsFilter = "todas" | "transporte" | "balcao";
export type CategoryFilter = "todas" | "banho" | "veterinario" | "cirurgia";
export type ProcessStatusFilter = "todos" | "concluidos" | "em_andamento";

/** Converte minutos para texto amigável e legível (ex: "18 min", "1h 25min", "Menos de 1 min") */
function formatMinutesExplanatory(min: number | null | undefined): string {
  if (min === null || min === undefined || isNaN(min) || min < 0) return "—";
  if (min < 1) return "< 1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Retorna badge amigável para o tempo de resposta no chat */
function renderChatSlaBadge(min: number | null | undefined) {
  if (min === null || min === undefined) {
    return (
      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50/50">
        Em espera
      </Badge>
    );
  }
  if (min <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
        🟢 Rápido (até 5 min)
      </span>
    );
  }
  if (min <= 15) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
        🟡 Moderado (5 a 15 min)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
      🔴 Demorado (&gt; 15 min)
    </span>
  );
}

/** Retorna badge amigável para a pontualidade do atendimento vs tempo previsto */
function renderAtendimentoPaceBadge(diffMin: number | null | undefined) {
  if (diffMin === null || diffMin === undefined) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Em andamento
      </Badge>
    );
  }
  if (diffMin <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
        🟢 No Prazo ({diffMin === 0 ? "Exato" : `${Math.abs(Math.round(diffMin))} min antes`})
      </span>
    );
  }
  if (diffMin <= 15) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
        🟡 Variação Leve (+{Math.round(diffMin)} min)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
      🔴 Acima do Previsto (+{Math.round(diffMin)} min)
    </span>
  );
}

export function RelatorioCronoanalise() {
  // Filtros de controle
  const [period, setPeriod] = useState<CronoPeriod>("30dias");
  const [logisticsFilter, setLogisticsFilter] = useState<LogisticsFilter>("todas");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todas");
  const [statusFilter, setStatusFilter] = useState<ProcessStatusFilter>("todos");
  const [search, setSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"geral" | "atendimentos" | "chat">("geral");

  // Estado reativo das mensagens de chat interno
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => getAllChatMessages());

  // Escuta novas mensagens no app
  useEffect(() => {
    const handleUpdate = () => {
      setChatMessages(getAllChatMessages());
    };
    window.addEventListener("bigdog_chat_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bigdog_chat_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // 1. Busca ordens de transporte completas com timestamps
  const { data: rawOrders, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["relatorio-crono-orders"],
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

  // 2. Busca todos os agendamentos (incluindo balcão / sem motorista)
  const { data: rawAppointments, isLoading: loadingAppts, refetch: refetchAppts } = useQuery({
    queryKey: ["relatorio-crono-appointments"],
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

  // 3. Busca o histórico de transição de status para cronometrar bancada/atendimento
  const { data: statusHistory } = useQuery({
    queryKey: ["relatorio-crono-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_status_history")
        .select("id, appointment_id, status, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Busca perfis para mapear nomes de tutores e motoristas
  const { data: profiles } = useQuery({
    queryKey: ["relatorio-crono-profiles"],
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

  // Mapa de histórico por agendamento
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

  // Intervalo de datas calculado conforme filtro selecionado
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

  // ==========================================
  // PROCESSAMENTO: CRONOANÁLISE DO CHAT
  // ==========================================
  const chatAnalysis = useMemo(() => {
    // Agrupa mensagens por conversa
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
      firstResponseAt?: Date | null;
      closedAt?: Date | null;
      tempoPrimeiraRespostaMin: number | null;
      tempoTotalConversaMin: number | null;
      status: "aberto" | "respondido" | "fechado";
      messageCount: number;
    }> = [];

    grouped.forEach((msgs, convId) => {
      // Ordena mensagens por timestamp
      const sorted = [...msgs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      if (sorted.length === 0) return;

      const firstMsg = sorted[0];
      const startedAt = new Date(firstMsg.createdAt);

      // Filtro de data
      if (startedAt < dateRange.start || startedAt > dateRange.end) return;

      // Acha a primeira mensagem do tutor
      const firstTutorMsg = sorted.find((m) => m.senderRole === "tutor") || firstMsg;
      const tutorSendTime = new Date(firstTutorMsg.createdAt).getTime();

      // Acha a primeira resposta subsequente da loja/vet
      const firstStoreMsg = sorted.find(
        (m) =>
          (m.senderRole === "loja" || m.senderRole === "vet") &&
          new Date(m.createdAt).getTime() >= tutorSendTime,
      );

      let tempoPrimeiraRespostaMin: number | null = null;
      let firstResponseAt: Date | null = null;
      if (firstStoreMsg) {
        firstResponseAt = new Date(firstStoreMsg.createdAt);
        tempoPrimeiraRespostaMin = Math.max(
          0,
          (firstResponseAt.getTime() - tutorSendTime) / 60000,
        );
      }

      // Status e fechamento
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

      const status: "aberto" | "respondido" | "fechado" = isClosed
        ? "fechado"
        : firstStoreMsg
        ? "respondido"
        : "aberto";

      rows.push({
        conversationId: convId,
        tutorName: firstMsg.tutorName || "Tutor",
        tutorPhone: firstMsg.tutorPhone,
        petName: firstMsg.petName,
        contextTag: firstMsg.contextTag || "Atendimento Geral",
        startedAt,
        firstResponseAt,
        closedAt,
        tempoPrimeiraRespostaMin,
        tempoTotalConversaMin,
        status,
        messageCount: sorted.length,
      });
    });

    // Filtro por termo de busca
    const filteredRows = rows.filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.tutorName.toLowerCase().includes(q) ||
        (r.petName && r.petName.toLowerCase().includes(q)) ||
        (r.contextTag && r.contextTag.toLowerCase().includes(q))
      );
    });

    // Estatísticas agregadas de chat
    const withResponse = filteredRows.filter((r) => r.tempoPrimeiraRespostaMin !== null);
    const totalRespMin = withResponse.reduce((acc, r) => acc + (r.tempoPrimeiraRespostaMin || 0), 0);
    const mediaRespostaMin = withResponse.length > 0 ? totalRespMin / withResponse.length : null;

    const noPrazoAte5Min = withResponse.filter((r) => (r.tempoPrimeiraRespostaMin || 0) <= 5).length;
    const moderado5a15Min = withResponse.filter(
      (r) => (r.tempoPrimeiraRespostaMin || 0) > 5 && (r.tempoPrimeiraRespostaMin || 0) <= 15,
    ).length;
    const atrasadoMais15Min = withResponse.filter((r) => (r.tempoPrimeiraRespostaMin || 0) > 15).length;
    const percentualExcelente = withResponse.length > 0 ? (noPrazoAte5Min / withResponse.length) * 100 : 0;

    const fechados = filteredRows.filter((r) => r.status === "fechado" && r.tempoTotalConversaMin !== null);
    const totalFechadoMin = fechados.reduce((acc, r) => acc + (r.tempoTotalConversaMin || 0), 0);
    const mediaFechamentoMin = fechados.length > 0 ? totalFechadoMin / fechados.length : null;

    return {
      rows: filteredRows,
      totalConversas: filteredRows.length,
      comResposta: withResponse.length,
      mediaRespostaMin,
      noPrazoAte5Min,
      moderado5a15Min,
      atrasadoMais15Min,
      percentualExcelente,
      mediaFechamentoMin,
      totalFechados: fechados.length,
      totalAbertos: filteredRows.filter((r) => r.status === "aberto").length,
    };
  }, [chatMessages, dateRange, search]);

  // ==========================================
  // PROCESSAMENTO: CRONOANÁLISE DE ATENDIMENTOS E TRANSPORTE
  // ==========================================
  const appointmentsAnalysis = useMemo(() => {
    // Cria mapa de ordens de transporte por appointment_id
    const transportByAppt = new Map<string, any>();
    (rawOrders ?? []).forEach((order) => {
      const appt = order.appointments as any;
      if (appt?.id) {
        transportByAppt.set(appt.id, order);
      }
    });

    const items: Array<{
      id: string;
      code: string;
      appointmentId: string;
      scheduledAt: Date;
      createdAt: Date;
      tutorName: string;
      tutorPhone?: string | null;
      petName: string;
      petSpecies?: string | null;
      serviceName: string;
      category: string;
      durationPrevistaMin: number;
      logisticsType: "buscar_devolver" | "levar_balcao" | string;
      driverName?: string | null;
      status: string;
      opsStatus: string;
      district?: string | null;

      // Tempos Cronoanalíticos (em minutos)
      tempoIdaMotoristaMin: number | null; // Saída da loja até casa do tutor
      tempoPetNoVeiculoMin: number | null; // Embarque na casa até entrada na loja (bem-estar)
      tempoTotalColetaMin: number | null;  // Saída da loja até chegada com o pet na loja
      tempoEsperaLojaMin: number | null;   // Chegada na loja até início do atendimento (fila)
      tempoAtendimentoRealMin: number | null; // Início do atendimento até conclusão do serviço
      desvioAtendimentoMin: number | null;    // Real - Previsto
      tempoDevolucaoMin: number | null;    // Saída da loja até entrega na casa
      tempoTotalForaDeCasaMin: number | null; // Door-to-door
      aproveitamentoTempoPercent: number | null; // % do tempo em atendimento direto
    }> = [];

    // Processa agendamentos
    (rawAppointments ?? []).forEach((appt) => {
      const apptDate = new Date(appt.scheduled_at || appt.created_at);
      if (apptDate < dateRange.start || apptDate > dateRange.end) return;

      const tOrder = transportByAppt.get(appt.id);
      const isTransport = appt.logistics_type === "buscar_devolver" || !!tOrder;

      // Filtro de logística
      if (logisticsFilter === "transporte" && !isTransport) return;
      if (logisticsFilter === "balcao" && isTransport) return;

      // Filtro de categoria
      const cat = ((appt.services as any)?.category || "").toLowerCase();
      const sName = ((appt.services as any)?.name || "").toLowerCase();
      const isCirurgia = cat.includes("cirurg") || sName.includes("cirurg") || sName.includes("castra") || sName.includes("profilaxia");
      const isVet = cat.includes("vet") || cat.includes("clinic") || isCirurgia;
      const isBanho = !isVet;

      if (categoryFilter === "cirurgia" && !isCirurgia) return;
      if (categoryFilter === "veterinario" && (!isVet || isCirurgia)) return;
      if (categoryFilter === "banho" && !isBanho) return;

      // Filtro de status
      const isDone = appt.status === "concluido" || appt.ops_status === "finalizado" || appt.ops_status === "pet_entregue";
      if (statusFilter === "concluidos" && !isDone) return;
      if (statusFilter === "em_andamento" && isDone) return;

      // Busca dados de perfis
      const tutor = profileMap.get(appt.user_id) || { name: "Cliente" };
      const driver = tOrder?.driver_id ? profileMap.get(tOrder.driver_id) : null;

      // Duração cadastrada
      const durationPrevistaMin = (appt.services as any)?.duration_min || 45;

      // Histórico de status para tempos de bancada
      const hist = historyByAppt.get(appt.id) || [];
      const hInicioAtendimento = hist.find((h) => h.status === "em_atendimento");
      const hFimAtendimento = hist.find((h) => h.status === "servico_concluido" || h.status === "pet_entregue" || h.status === "finalizado");

      // Cronometragem do Transporte
      let tempoIdaMotoristaMin: number | null = null;
      let tempoPetNoVeiculoMin: number | null = null;
      let tempoTotalColetaMin: number | null = null;
      let tempoDevolucaoMin: number | null = null;
      let tempoTotalForaDeCasaMin: number | null = null;

      if (tOrder) {
        const enRoutePickup = tOrder.en_route_pickup_at ? new Date(tOrder.en_route_pickup_at).getTime() : null;
        const pickedUp = tOrder.picked_up_at ? new Date(tOrder.picked_up_at).getTime() : null;
        const arrivedShop = tOrder.arrived_shop_at ? new Date(tOrder.arrived_shop_at).getTime() : null;
        const enRouteReturn = tOrder.en_route_return_at ? new Date(tOrder.en_route_return_at).getTime() : null;
        const delivered = tOrder.delivered_at ? new Date(tOrder.delivered_at).getTime() : null;

        // Ida até a casa do tutor
        if (enRoutePickup && pickedUp && pickedUp >= enRoutePickup) {
          tempoIdaMotoristaMin = (pickedUp - enRoutePickup) / 60000;
        }
        // Pet embarcado até a chegada na loja
        if (pickedUp && arrivedShop && arrivedShop >= pickedUp) {
          tempoPetNoVeiculoMin = (arrivedShop - pickedUp) / 60000;
        }
        // Coleta total
        if (enRoutePickup && arrivedShop && arrivedShop >= enRoutePickup) {
          tempoTotalColetaMin = (arrivedShop - enRoutePickup) / 60000;
        } else if (pickedUp && arrivedShop && arrivedShop >= pickedUp) {
          tempoTotalColetaMin = tempoPetNoVeiculoMin;
        }
        // Devolução
        if (enRouteReturn && delivered && delivered >= enRouteReturn) {
          tempoDevolucaoMin = (delivered - enRouteReturn) / 60000;
        }
        // Total fora de casa (Door-to-door)
        const tStart = pickedUp || enRoutePickup;
        const tEnd = delivered || (tOrder.tutor_confirmed_at ? new Date(tOrder.tutor_confirmed_at).getTime() : null);
        if (tStart && tEnd && tEnd >= tStart) {
          tempoTotalForaDeCasaMin = (tEnd - tStart) / 60000;
        }
      }

      // Cronometragem do Atendimento e Espera na Loja
      let tempoEsperaLojaMin: number | null = null;
      let tempoAtendimentoRealMin: number | null = null;
      let desvioAtendimentoMin: number | null = null;

      const timeChegouLoja = tOrder?.arrived_shop_at
        ? new Date(tOrder.arrived_shop_at).getTime()
        : !isTransport
        ? new Date(appt.scheduled_at || appt.created_at).getTime()
        : null;

      const timeInicioAtendimento = hInicioAtendimento
        ? new Date(hInicioAtendimento.created_at).getTime()
        : null;

      const timeFimAtendimento = hFimAtendimento
        ? new Date(hFimAtendimento.created_at).getTime()
        : null;

      // Tempo de espera em loja
      if (timeChegouLoja && timeInicioAtendimento && timeInicioAtendimento >= timeChegouLoja) {
        tempoEsperaLojaMin = (timeInicioAtendimento - timeChegouLoja) / 60000;
      }

      // Duração real do atendimento
      if (timeInicioAtendimento && timeFimAtendimento && timeFimAtendimento >= timeInicioAtendimento) {
        tempoAtendimentoRealMin = (timeFimAtendimento - timeInicioAtendimento) / 60000;
      } else if (timeInicioAtendimento && appt.ops_status === "em_atendimento") {
        tempoAtendimentoRealMin = Math.max(0, (Date.now() - timeInicioAtendimento) / 60000);
      } else if (isDone && !tempoAtendimentoRealMin) {
        // Se concluído sem timestamp exato, usa a duração prevista como estimativa base
        tempoAtendimentoRealMin = durationPrevistaMin;
      }

      if (tempoAtendimentoRealMin !== null) {
        desvioAtendimentoMin = tempoAtendimentoRealMin - durationPrevistaMin;
      }

      // Aproveitamento do tempo (% de atendimento direto em relação ao ciclo completo)
      let aproveitamentoTempoPercent: number | null = null;
      if (tempoAtendimentoRealMin !== null) {
        const tempoTotalCiclo =
          (tempoTotalColetaMin || 0) +
          (tempoEsperaLojaMin || 0) +
          tempoAtendimentoRealMin +
          (tempoDevolucaoMin || 0);

        if (tempoTotalCiclo > 0) {
          aproveitamentoTempoPercent = Math.min(100, Math.round((tempoAtendimentoRealMin / tempoTotalCiclo) * 100));
        } else {
          aproveitamentoTempoPercent = 100;
        }
      }

      const rowCode = tOrder?.code ? `#${tOrder.code}` : `#${appt.id.slice(0, 6).toUpperCase()}`;

      items.push({
        id: appt.id,
        code: rowCode,
        appointmentId: appt.id,
        scheduledAt: apptDate,
        createdAt: new Date(appt.created_at),
        tutorName: tutor.name,
        tutorPhone: tutor.phone,
        petName: (appt.pets as any)?.name || "Pet",
        petSpecies: (appt.pets as any)?.species,
        serviceName: (appt.services as any)?.name || "Serviço",
        category: isCirurgia ? "Cirurgia" : isVet ? "Veterinário" : "Banho & Tosa",
        durationPrevistaMin,
        logisticsType: appt.logistics_type,
        driverName: driver?.name,
        status: appt.status,
        opsStatus: appt.ops_status || "agendado",
        district: tOrder?.addresses?.district,
        tempoIdaMotoristaMin,
        tempoPetNoVeiculoMin,
        tempoTotalColetaMin,
        tempoEsperaLojaMin,
        tempoAtendimentoRealMin,
        desvioAtendimentoMin,
        tempoDevolucaoMin,
        tempoTotalForaDeCasaMin,
        aproveitamentoTempoPercent,
      });
    });

    // Filtro por texto de busca
    const filteredItems = items.filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.code.toLowerCase().includes(q) ||
        item.tutorName.toLowerCase().includes(q) ||
        item.petName.toLowerCase().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        (item.driverName && item.driverName.toLowerCase().includes(q)) ||
        (item.district && item.district.toLowerCase().includes(q))
      );
    });

    // Médias e agregados
    const calcAvg = (getter: (i: (typeof items)[0]) => number | null) => {
      const vals = filteredItems.map(getter).filter((v): v is number => v !== null && !isNaN(v) && v >= 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const mediaColetaMin = calcAvg((i) => i.tempoTotalColetaMin);
    const mediaPetNoVeiculoMin = calcAvg((i) => i.tempoPetNoVeiculoMin);
    const mediaEsperaLojaMin = calcAvg((i) => i.tempoEsperaLojaMin);
    const mediaAtendimentoRealMin = calcAvg((i) => i.tempoAtendimentoRealMin);
    const mediaPrevistaMin = calcAvg((i) => i.durationPrevistaMin);
    const mediaDevolucaoMin = calcAvg((i) => i.tempoDevolucaoMin);
    const mediaTotalForaDeCasaMin = calcAvg((i) => i.tempoTotalForaDeCasaMin);
    const mediaAproveitamentoPercent = calcAvg((i) => i.aproveitamentoTempoPercent);

    // Pontualidade
    const comAtendimento = filteredItems.filter((i) => i.desvioAtendimentoMin !== null);
    const noPrazo = comAtendimento.filter((i) => (i.desvioAtendimentoMin || 0) <= 0).length;
    const taxaPontualidade = comAtendimento.length > 0 ? (noPrazo / comAtendimento.length) * 100 : 0;

    return {
      items: filteredItems,
      totalCount: filteredItems.length,
      mediaColetaMin,
      mediaPetNoVeiculoMin,
      mediaEsperaLojaMin,
      mediaAtendimentoRealMin,
      mediaPrevistaMin,
      mediaDevolucaoMin,
      mediaTotalForaDeCasaMin,
      mediaAproveitamentoPercent,
      taxaPontualidade,
    };
  }, [
    rawOrders,
    rawAppointments,
    statusHistory,
    profileMap,
    historyByAppt,
    dateRange,
    logisticsFilter,
    categoryFilter,
    statusFilter,
    search,
  ]);

  // ==========================================
  // EXPORTAÇÃO EXCEL (.XLSX)
  // ==========================================
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Aba 1: Atendimentos & Táxi Pet
    const apptData = appointmentsAnalysis.items.map((i) => ({
      "Código": i.code,
      "Data": formatDate(i.scheduledAt),
      "Tutor": i.tutorName,
      "Telefone": i.tutorPhone || "",
      "Pet": i.petName,
      "Serviço": i.serviceName,
      "Categoria": i.category,
      "Modalidade": i.logisticsType === "buscar_devolver" ? "Táxi Pet" : "Balcão",
      "Motorista": i.driverName || "—",
      "Bairro": i.district || "—",
      "Tempo Ida Motorista (min)": i.tempoIdaMotoristaMin !== null ? Math.round(i.tempoIdaMotoristaMin) : "—",
      "Tempo Pet no Veículo (min)": i.tempoPetNoVeiculoMin !== null ? Math.round(i.tempoPetNoVeiculoMin) : "—",
      "Tempo Coleta até a Loja (min)": i.tempoTotalColetaMin !== null ? Math.round(i.tempoTotalColetaMin) : "—",
      "Tempo Espera em Loja (min)": i.tempoEsperaLojaMin !== null ? Math.round(i.tempoEsperaLojaMin) : "—",
      "Duração Atendimento Real (min)": i.tempoAtendimentoRealMin !== null ? Math.round(i.tempoAtendimentoRealMin) : "—",
      "Duração Prevista (min)": i.durationPrevistaMin,
      "Diferença Real vs Previsto (min)": i.desvioAtendimentoMin !== null ? Math.round(i.desvioAtendimentoMin) : "—",
      "Tempo Devolução (min)": i.tempoDevolucaoMin !== null ? Math.round(i.tempoDevolucaoMin) : "—",
      "Tempo Total Fora de Casa (min)": i.tempoTotalForaDeCasaMin !== null ? Math.round(i.tempoTotalForaDeCasaMin) : "—",
      "Aproveitamento do Tempo (%)": i.aproveitamentoTempoPercent !== null ? `${i.aproveitamentoTempoPercent}%` : "—",
    }));

    const wsAppts = XLSX.utils.json_to_sheet(apptData);
    XLSX.utils.book_append_sheet(wb, wsAppts, "Atendimentos e Táxi Pet");

    // Aba 2: Chat & Suporte
    const chatData = chatAnalysis.rows.map((c) => ({
      "Conversa": c.conversationId,
      "Tutor": c.tutorName,
      "Telefone": c.tutorPhone || "",
      "Pet": c.petName || "—",
      "Assunto": c.contextTag || "Geral",
      "Início da Conversa": formatDateTime(c.startedAt),
      "Primeira Resposta da Loja": c.firstResponseAt ? formatDateTime(c.firstResponseAt) : "Aguardando",
      "Tempo de 1ª Resposta (min)": c.tempoPrimeiraRespostaMin !== null ? Math.round(c.tempoPrimeiraRespostaMin) : "—",
      "Avaliação de Rapidez":
        c.tempoPrimeiraRespostaMin === null
          ? "Em aberto"
          : c.tempoPrimeiraRespostaMin <= 5
          ? "Rápido (até 5 min)"
          : c.tempoPrimeiraRespostaMin <= 15
          ? "Moderado (5 a 15 min)"
          : "Demorado (> 15 min)",
      "Status da Conversa": c.status === "fechado" ? "Fechado" : c.status === "respondido" ? "Respondido" : "Aberto",
      "Tempo Total da Conversa (min)": c.tempoTotalConversaMin !== null ? Math.round(c.tempoTotalConversaMin) : "—",
      "Total de Mensagens": c.messageCount,
    }));

    const wsChat = XLSX.utils.json_to_sheet(chatData);
    XLSX.utils.book_append_sheet(wb, wsChat, "Atendimento no Chat");

    const todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Cronoanalise_Processos_BigDog_${todayStr}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRefresh = () => {
    refetchOrders();
    refetchAppts();
    setChatMessages(getAllChatMessages());
  };

  return (
    <div className="space-y-6">
      {/* ========================================================
          CABEÇALHO CENTRALIZADO ELEGANTE COM SOMBRA AZUL E DIVISÓRIA
          ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50/80 via-blue-100/50 to-blue-50/80 p-6 text-center shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-blue-900/20 dark:to-blue-950/30">
        <div className="mx-auto max-w-3xl space-y-2">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
            <Timer className="h-3.5 w-3.5" />
            Auditoria Gerencial de Processos & Tempo
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-900 dark:text-blue-100 tracking-tight drop-shadow-[0_2px_4px_rgba(37,99,235,0.35)]">
            ⏱️ Cronoanálise & Eficiência dos Processos
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-blue-800/90 dark:text-blue-200/90">
            Acompanhamento simplificado dos tempos de resposta no chat, deslocamento do táxi pet e duração dos atendimentos
          </p>
        </div>

        {/* Linha divisória azul elegante */}
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
            Atualizar Dados
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="border-blue-300 bg-white/80 font-semibold text-blue-900 hover:bg-blue-50 dark:border-blue-700 dark:bg-card dark:text-blue-100"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            Exportar para Excel (.xlsx)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-blue-200 bg-white/80 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir Relatório
          </Button>
        </div>
      </div>

      {/* ========================================================
          BARRA DE FILTROS COM BORDAS E LINHAS AZUIS
          ======================================================== */}
      <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-sm dark:border-blue-800/60 dark:bg-blue-950/20">
        <div className="mb-3 flex items-center gap-2 border-b border-blue-200/60 pb-2 dark:border-blue-800/40">
          <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-blue-900 dark:text-blue-200">
            Filtros do Relatório
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Período */}
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900 dark:text-blue-200">
              📅 Período
            </label>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { key: "hoje", label: "Hoje" },
                  { key: "7dias", label: "7 dias" },
                  { key: "30dias", label: "30 dias" },
                  { key: "mes", label: "Mês atual" },
                  { key: "todos", label: "Tudo" },
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
                      : "border border-blue-200 bg-white/70 text-blue-800 hover:bg-blue-100/60 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modalidade de Transporte */}
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900 dark:text-blue-200">
              🚗 Modalidade de Transporte
            </label>
            <select
              value={logisticsFilter}
              onChange={(e) => setLogisticsFilter(e.target.value as LogisticsFilter)}
              className="w-full rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-blue-800 dark:bg-card dark:text-blue-100"
            >
              <option value="todas">Todas as modalidades</option>
              <option value="transporte">🚗 Apenas Táxi Pet (Buscar e Devolver)</option>
              <option value="balcao">🏠 Apenas Balcão (Tutor levou ao petshop)</option>
            </select>
          </div>

          {/* Categoria de Serviço */}
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900 dark:text-blue-200">
              ✂️ Categoria do Atendimento
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="w-full rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm focus:border-blue-500 focus:outline-none dark:border-blue-800 dark:bg-card dark:text-blue-100"
            >
              <option value="todas">Todas as categorias</option>
              <option value="banho">🛁 Banho & Tosa</option>
              <option value="veterinario">🩺 Veterinário Geral & Vacinas</option>
              <option value="cirurgia">🏥 Cirurgias & Procedimentos</option>
            </select>
          </div>

          {/* Campo de Busca Rápida */}
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900 dark:text-blue-200">
              🔍 Busca Rápida
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-blue-400" />
              <Input
                placeholder="Tutor, pet, código ou serviço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-xl border-blue-200 bg-white pl-8 text-xs font-medium text-blue-900 placeholder:text-blue-400/80 dark:border-blue-800 dark:bg-card dark:text-blue-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          NAVEGAÇÃO DAS SEÇÕES (VISÃO GERAL, ATENDIMENTOS, CHAT)
          ======================================================== */}
      <div className="flex items-center gap-1.5 border-b border-blue-200/80 pb-2 dark:border-blue-800/60">
        <button
          type="button"
          onClick={() => setActiveSubTab("geral")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeSubTab === "geral"
              ? "bg-blue-600 text-white shadow-sm"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Visão Geral & Indicadores
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("atendimentos")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeSubTab === "atendimentos"
              ? "bg-blue-600 text-white shadow-sm"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
          )}
        >
          <Truck className="h-3.5 w-3.5" />
          Atendimentos & Táxi Pet ({appointmentsAnalysis.items.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("chat")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            activeSubTab === "chat"
              ? "bg-blue-600 text-white shadow-sm"
              : "border border-blue-200 bg-white text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200",
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Atendimento no Chat ({chatAnalysis.totalConversas})
        </button>
      </div>

      {/* ========================================================
          SEÇÃO 1: VISÃO GERAL & INDICADORES DE EFICIÊNCIA
          ======================================================== */}
      {(activeSubTab === "geral" || activeSubTab === "atendimentos") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-blue-600" />
              Resumo dos Indicadores de Tempo
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              Baseado em {appointmentsAnalysis.totalCount} atendimentos e {chatAnalysis.totalConversas} conversas
            </span>
          </div>

          {/* Cards de Métricas Principais (com fundo azul claro, borda e explicações claras) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Tempo de 1ª Resposta no Chat */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    1ª Resposta no Chat
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-blue-950 dark:text-blue-50">
                      {formatMinutesExplanatory(chatAnalysis.mediaRespostaMin)}
                    </span>
                    {chatAnalysis.mediaRespostaMin !== null && (
                      <span className="text-xs font-bold text-emerald-600">
                        {Math.round(chatAnalysis.percentualExcelente)}% em até 5min
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <MessageCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo médio que a loja levou para dar o primeiro retorno após a mensagem do tutor.
              </p>
            </div>

            {/* 2. Tempo de Coleta Táxi Pet */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Coleta até o Petshop
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-blue-950 dark:text-blue-50">
                      {formatMinutesExplanatory(appointmentsAnalysis.mediaColetaMin)}
                    </span>
                    {appointmentsAnalysis.mediaPetNoVeiculoMin !== null && (
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        ({formatMinutesExplanatory(appointmentsAnalysis.mediaPetNoVeiculoMin)} no carro)
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <Truck className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo desde a saída do motorista até a chegada física do pet à loja.
              </p>
            </div>

            {/* 3. Tempo de Espera em Loja */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Espera Antes do Atendimento
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-blue-950 dark:text-blue-50">
                      {formatMinutesExplanatory(appointmentsAnalysis.mediaEsperaLojaMin)}
                    </span>
                    <span className="text-xs font-bold text-blue-700">
                      Meta: ≤ 15 min
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Tempo em que o pet aguardou seguro na loja antes de iniciar o banho ou consulta.
              </p>
            </div>

            {/* 4. Duração do Atendimento vs Previsto */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/40 p-4 shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:via-card dark:to-blue-900/20">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    Duração do Atendimento
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-blue-950 dark:text-blue-50">
                      {formatMinutesExplanatory(appointmentsAnalysis.mediaAtendimentoRealMin)}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {Math.round(appointmentsAnalysis.taxaPontualidade)}% pontual
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <Scissors className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-300/80 leading-relaxed border-t border-blue-100 pt-2 dark:border-blue-900/40">
                💡 Duração real de execução do serviço comparada com a duração padrão cadastrada.
              </p>
            </div>
          </div>

          {/* Cartões Adicionais de Eficiência Global */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Aproveitamento do Tempo do Pet */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Smile className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Aproveitamento do Tempo do Pet
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-900 dark:text-blue-100">
                  {appointmentsAnalysis.mediaAproveitamentoPercent !== null
                    ? `${Math.round(appointmentsAnalysis.mediaAproveitamentoPercent)}%`
                    : "—"}
                </span>
                <span className="text-xs text-muted-foreground">do tempo em cuidado direto</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${appointmentsAnalysis.mediaAproveitamentoPercent || 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Porcentagem do tempo que o pet esteve em atendimento direto vs. deslocamento e espera.
              </p>
            </div>

            {/* Tempo Médio de Devolução */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Viagem de Volta (Devolução)
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-900 dark:text-blue-100">
                  {formatMinutesExplanatory(appointmentsAnalysis.mediaDevolucaoMin)}
                </span>
                <span className="text-xs text-muted-foreground">da loja até a casa</span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Tempo que o motorista levou da saída do petshop até a entrega carinhosa do pet ao tutor.
              </p>
            </div>

            {/* Tempo Total Fora de Casa */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-800 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Tempo Total Fora de Casa
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-900 dark:text-blue-100">
                  {formatMinutesExplanatory(appointmentsAnalysis.mediaTotalForaDeCasaMin)}
                </span>
                <span className="text-xs text-muted-foreground">buscar até devolver</span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Duração completa em que o animal de estimação esteve sob responsabilidade da equipe.
              </p>
            </div>
          </div>

          {/* Gráfico Visual Didático: Jornada do Pet & Composição do Tempo */}
          <div className="rounded-2xl border-2 border-blue-200/80 bg-white p-5 shadow-sm dark:border-blue-800 dark:bg-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-blue-600" />
              Composição da Jornada do Pet (Média de Tempos)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Visualização sequencial das 4 etapas do atendimento completo com táxi pet
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
              {/* Etapa 1: Coleta */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-center dark:border-blue-800 dark:bg-blue-950/30">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">1. Coleta Táxi Pet</span>
                <div className="text-lg font-black text-blue-950 dark:text-blue-100 mt-1">
                  {formatMinutesExplanatory(appointmentsAnalysis.mediaColetaMin)}
                </div>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {appointmentsAnalysis.mediaPetNoVeiculoMin !== null
                    ? `${formatMinutesExplanatory(appointmentsAnalysis.mediaPetNoVeiculoMin)} com pet`
                    : "Em deslocamento"}
                </span>
              </div>

              {/* Etapa 2: Espera na Loja */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-center dark:border-blue-800 dark:bg-blue-950/30">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">2. Espera na Loja</span>
                <div className="text-lg font-black text-blue-950 dark:text-blue-100 mt-1">
                  {formatMinutesExplanatory(appointmentsAnalysis.mediaEsperaLojaMin)}
                </div>
                <span className="text-xs text-muted-foreground block mt-0.5">Acolhimento seguro</span>
              </div>

              {/* Etapa 3: Atendimento Efetivo */}
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-3 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">3. Cuidado Direto ✨</span>
                <div className="text-lg font-black text-emerald-950 dark:text-emerald-100 mt-1">
                  {formatMinutesExplanatory(appointmentsAnalysis.mediaAtendimentoRealMin)}
                </div>
                <span className="text-xs text-emerald-700 font-semibold block mt-0.5">
                  Previsto: {formatMinutesExplanatory(appointmentsAnalysis.mediaPrevistaMin)}
                </span>
              </div>

              {/* Etapa 4: Devolução */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-center dark:border-blue-800 dark:bg-blue-950/30">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">4. Retorno ao Lar</span>
                <div className="text-lg font-black text-blue-950 dark:text-blue-100 mt-1">
                  {formatMinutesExplanatory(appointmentsAnalysis.mediaDevolucaoMin)}
                </div>
                <span className="text-xs text-muted-foreground block mt-0.5">Entrega segura</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SEÇÃO 2: TABELA DETALHADA DE ATENDIMENTOS & TÁXI PET
          ======================================================== */}
      {(activeSubTab === "geral" || activeSubTab === "atendimentos") && (
        <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm overflow-hidden dark:border-blue-800 dark:bg-card">
          <div className="border-b border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                Tabela Cronoanalítica de Atendimentos & Táxi Pet
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exibindo {appointmentsAnalysis.items.length} atendimentos detalhados com cronometragem etapa a etapa
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="border-blue-200 bg-white text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-card dark:text-blue-200"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Exportar Tabela
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-blue-200 bg-blue-100/60 text-blue-900 font-bold dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                <tr>
                  <th className="py-2.5 px-3">Código / Data</th>
                  <th className="py-2.5 px-3">Pet & Tutor</th>
                  <th className="py-2.5 px-3">Serviço</th>
                  <th className="py-2.5 px-3">Modalidade</th>
                  <th className="py-2.5 px-3 text-center">Coleta (Loja)</th>
                  <th className="py-2.5 px-3 text-center">Espera Loja</th>
                  <th className="py-2.5 px-3 text-center">Atendimento (Real vs Previsto)</th>
                  <th className="py-2.5 px-3 text-center">Devolução</th>
                  <th className="py-2.5 px-3 text-center">Tempo Total</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                {appointmentsAnalysis.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-muted-foreground font-medium">
                      Nenhum atendimento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  appointmentsAnalysis.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 transition-colors dark:hover:bg-blue-950/30"
                    >
                      {/* Código e Data */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-blue-950 dark:text-blue-100 block">
                          {item.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(item.scheduledAt)}
                        </span>
                      </td>

                      {/* Pet & Tutor */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-blue-900 dark:text-blue-100">
                          🐾 {item.petName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.tutorName}
                        </div>
                      </td>

                      {/* Serviço & Categoria */}
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-foreground block">
                          {item.serviceName}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 mt-0.5",
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

                      {/* Modalidade */}
                      <td className="py-2.5 px-3">
                        {item.logisticsType === "buscar_devolver" ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                              <Truck className="h-3 w-3" /> Táxi Pet
                            </span>
                            {item.driverName && (
                              <span className="text-[10px] text-muted-foreground block">
                                Motorista: {item.driverName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            🏠 Balcão
                          </span>
                        )}
                      </td>

                      {/* Tempo de Coleta */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-semibold text-foreground">
                          {formatMinutesExplanatory(item.tempoTotalColetaMin)}
                        </span>
                        {item.tempoPetNoVeiculoMin !== null && (
                          <span className="text-[10px] text-blue-600 block">
                            ({formatMinutesExplanatory(item.tempoPetNoVeiculoMin)} no carro)
                          </span>
                        )}
                      </td>

                      {/* Tempo de Espera em Loja */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "font-semibold",
                            item.tempoEsperaLojaMin !== null && item.tempoEsperaLojaMin > 20
                              ? "text-rose-600 font-bold"
                              : "text-foreground",
                          )}
                        >
                          {formatMinutesExplanatory(item.tempoEsperaLojaMin)}
                        </span>
                      </td>

                      {/* Atendimento Real vs Previsto */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="font-bold text-foreground">
                          {formatMinutesExplanatory(item.tempoAtendimentoRealMin)}
                        </div>
                        <div className="mt-0.5">
                          {renderAtendimentoPaceBadge(item.desvioAtendimentoMin)}
                        </div>
                      </td>

                      {/* Tempo de Devolução */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-semibold text-foreground">
                          {formatMinutesExplanatory(item.tempoDevolucaoMin)}
                        </span>
                      </td>

                      {/* Tempo Total Fora de Casa */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-bold text-blue-900 dark:text-blue-200">
                          {formatMinutesExplanatory(item.tempoTotalForaDeCasaMin)}
                        </span>
                        {item.aproveitamentoTempoPercent !== null && (
                          <span className="text-[10px] text-emerald-700 block font-semibold">
                            {item.aproveitamentoTempoPercent}% útil
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            openInAppChat({
                              tutorName: item.tutorName,
                              tutorPhone: item.tutorPhone || undefined,
                              petName: item.petName,
                              contextTag: `${item.serviceName} (${item.code})`,
                            });
                          }}
                          className="h-7 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                        >
                          <MessageCircle className="mr-1 h-3.5 w-3.5" />
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

      {/* ========================================================
          SEÇÃO 3: CRONOANÁLISE DO ATENDIMENTO NO CHAT
          ======================================================== */}
      {(activeSubTab === "geral" || activeSubTab === "chat") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              Cronoanálise do Chat & Atendimento ao Tutor
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              {chatAnalysis.totalConversas} chamados no período
            </span>
          </div>

          {/* Cards de Métricas do Chat */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* SLA de 1ª Resposta */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-800 dark:bg-blue-950/20">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Velocidade da 1ª Resposta
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(chatAnalysis.mediaRespostaMin)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Média do tempo até a loja acolher e dar o primeiro retorno ao tutor.
              </p>
            </div>

            {/* Distribuição de Rapidez */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-800 dark:bg-blue-950/20">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Conformidade de Rapidez
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700">
                  {Math.round(chatAnalysis.percentualExcelente)}%
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  ({chatAnalysis.noPrazoAte5Min} conversas ≤ 5 min)
                </span>
              </div>
              <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${chatAnalysis.percentualExcelente}%` }}
                  title="≤ 5 min"
                />
                <div
                  className="bg-amber-400"
                  style={{
                    width: `${
                      chatAnalysis.comResposta > 0
                        ? (chatAnalysis.moderado5a15Min / chatAnalysis.comResposta) * 100
                        : 0
                    }%`,
                  }}
                  title="5 a 15 min"
                />
                <div
                  className="bg-rose-500"
                  style={{
                    width: `${
                      chatAnalysis.comResposta > 0
                        ? (chatAnalysis.atrasadoMais15Min / chatAnalysis.comResposta) * 100
                        : 0
                    }%`,
                  }}
                  title="> 15 min"
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span className="text-emerald-600 font-bold">🟢 Até 5 min</span>
                <span className="text-amber-600 font-bold">🟡 5 a 15 min</span>
                <span className="text-rose-600 font-bold">🔴 &gt; 15 min</span>
              </div>
            </div>

            {/* Tempo de Fechamento */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-800 dark:bg-blue-950/20">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Tempo Total até Encerrar
              </span>
              <div className="mt-1 text-2xl font-black text-blue-950 dark:text-blue-50">
                {formatMinutesExplanatory(chatAnalysis.mediaFechamentoMin)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tempo total desde a abertura da dúvida até o fechamento com sucesso.
              </p>
            </div>
          </div>

          {/* Tabela de Conversas e Tempos de Resposta do Chat */}
          <div className="rounded-2xl border border-blue-200/80 bg-white shadow-sm overflow-hidden dark:border-blue-800 dark:bg-card">
            <div className="border-b border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  Histórico de Atendimento e Respostas no Chat
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lista de chamados com medição de espera do tutor
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-blue-200 bg-blue-100/60 text-blue-900 font-bold dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                  <tr>
                    <th className="py-2.5 px-3">Tutor / Pet</th>
                    <th className="py-2.5 px-3">Assunto</th>
                    <th className="py-2.5 px-3">Início do Chamado</th>
                    <th className="py-2.5 px-3 text-center">Tempo até 1ª Resposta</th>
                    <th className="py-2.5 px-3 text-center">Avaliação de Rapidez</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Duração Total</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                  {chatAnalysis.rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground font-medium">
                        Nenhuma conversa encontrada no período.
                      </td>
                    </tr>
                  ) : (
                    chatAnalysis.rows.map((row) => (
                      <tr
                        key={row.conversationId}
                        className="hover:bg-blue-50/40 transition-colors dark:hover:bg-blue-950/30"
                      >
                        {/* Tutor e Pet */}
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-blue-950 dark:text-blue-100 block">
                            {row.tutorName}
                          </span>
                          {row.petName && (
                            <span className="text-[11px] text-muted-foreground">
                              🐾 {row.petName}
                            </span>
                          )}
                        </td>

                        {/* Assunto / Contexto */}
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-foreground">
                            {row.contextTag}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            {row.messageCount} mensagens
                          </span>
                        </td>

                        {/* Início */}
                        <td className="py-2.5 px-3">
                          <span className="text-[11px] text-foreground block">
                            {formatDateTime(row.startedAt)}
                          </span>
                        </td>

                        {/* Tempo até 1ª Resposta */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-foreground">
                            {formatMinutesExplanatory(row.tempoPrimeiraRespostaMin)}
                          </span>
                        </td>

                        {/* Badge de Rapidez */}
                        <td className="py-2.5 px-3 text-center">
                          {renderChatSlaBadge(row.tempoPrimeiraRespostaMin)}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-2 py-0.5",
                              row.status === "fechado"
                                ? "border-muted text-muted-foreground bg-muted/30"
                                : row.status === "respondido"
                                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                : "border-rose-300 text-rose-700 bg-rose-50 font-bold animate-pulse",
                            )}
                          >
                            {row.status === "fechado"
                              ? "Fechado"
                              : row.status === "respondido"
                              ? "Respondido"
                              : "Aguardando Resposta"}
                          </Badge>
                        </td>

                        {/* Duração Total */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-medium text-foreground">
                            {formatMinutesExplanatory(row.tempoTotalConversaMin)}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              openInAppChat({
                                conversationId: row.conversationId,
                                tutorName: row.tutorName,
                                tutorPhone: row.tutorPhone || undefined,
                                petName: row.petName || undefined,
                                contextTag: row.contextTag || undefined,
                              });
                            }}
                            className="h-7 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                          >
                            <MessageCircle className="mr-1 h-3.5 w-3.5" />
                            Abrir Chat
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default RelatorioCronoanalise;
