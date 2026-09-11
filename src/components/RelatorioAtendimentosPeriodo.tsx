import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Layers,
  MessageCircle,
  Phone,
  Printer,
  Search,
  TrendingUp,
  User,
  Users,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, digitsOnly } from "@/lib/format";
import { isServiceExecuted } from "@/lib/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { cn } from "@/lib/utils";

export type PeriodFilter = "hoje" | "semana" | "mes" | "bimestre" | "trimestre" | "ano";

interface PeriodBucket {
  id: string;
  label: string;
  sublabel?: string;
  start: Date;
  end: Date;
}

interface ClientBucketStats {
  count: number;
  revenueCents: number;
  cancelledCount: number;
}

interface ClientRow {
  userId: string;
  tutorName: string;
  phone?: string | null;
  petNames: string[];
  buckets: Record<string, ClientBucketStats>;
  totalCount: number;
  totalRevenueCents: number;
  totalCancelledCount: number;
}

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function RelatorioAtendimentosPeriodo() {
  const [period, setPeriod] = useState<PeriodFilter>("trimestre");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"executados" | "ativos" | "cancelados" | "todos">("executados");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"faturamento" | "atendimentos" | "nome">("faturamento");

  // Navegação de referência de data (ano e mês base)
  const [refDate, setRefDate] = useState<Date>(() => new Date());

  // Gera os baldes/blocos de colunas de acordo com o filtro selecionado
  const { buckets, periodTitle, rangeStart, rangeEnd } = useMemo(() => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const now = refDate;

    if (period === "hoje") {
      const dayStart = new Date(year, month, now.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(year, month, now.getDate(), 23, 59, 59, 999);

      const b1Start = new Date(year, month, now.getDate(), 8, 0, 0);
      const b1End = new Date(year, month, now.getDate(), 12, 0, 0);
      const b2Start = new Date(year, month, now.getDate(), 12, 0, 1);
      const b2End = new Date(year, month, now.getDate(), 18, 0, 0);
      const b3Start = new Date(year, month, now.getDate(), 18, 0, 1);
      const b3End = new Date(year, month, now.getDate(), 22, 0, 0);

      return {
        buckets: [
          { id: "manha", label: "Manhã", sublabel: "08h às 12h", start: b1Start, end: b1End },
          { id: "tarde", label: "Tarde", sublabel: "12h às 18h", start: b2Start, end: b2End },
          { id: "noite", label: "Noite", sublabel: "18h às 22h", start: b3Start, end: b3End },
        ],
        periodTitle: `Hoje (${now.toLocaleDateString("pt-BR")})`,
        rangeStart: dayStart,
        rangeEnd: dayEnd,
      };
    }

    if (period === "semana") {
      // Semana de Segunda a Domingo
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(year, month, now.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      sunday.setHours(23, 59, 59, 999);

      const bList: PeriodBucket[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday.getTime() + i * 86400000);
        const dayName = WEEKDAY_NAMES[d.getDay()] || "Dia";
        const dayLabel = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
        const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        bList.push({
          id: `day-${i}`,
          label: dayName,
          sublabel: dayLabel,
          start: s,
          end: e,
        });
      }

      return {
        buckets: bList,
        periodTitle: `Semana (${monday.toLocaleDateString("pt-BR")} a ${sunday.toLocaleDateString("pt-BR")})`,
        rangeStart: monday,
        rangeEnd: sunday,
      };
    }

    if (period === "mes") {
      // Divide o mês selecionado em semanas
      const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const totalDays = lastDay.getDate();

      const bList: PeriodBucket[] = [];
      const step = 7;
      let startDay = 1;
      let weekIdx = 1;

      while (startDay <= totalDays) {
        const endDay = Math.min(startDay + step - 1, totalDays);
        const s = new Date(year, month, startDay, 0, 0, 0, 0);
        const e = new Date(year, month, endDay, 23, 59, 59, 999);

        bList.push({
          id: `sem-${weekIdx}`,
          label: `Semana ${weekIdx}`,
          sublabel: `${startDay.toString().padStart(2, "0")} a ${endDay.toString().padStart(2, "0")}`,
          start: s,
          end: e,
        });

        startDay = endDay + 1;
        weekIdx++;
      }

      return {
        buckets: bList,
        periodTitle: `${MONTH_NAMES_FULL[month]} de ${year}`,
        rangeStart: firstDay,
        rangeEnd: lastDay,
      };
    }

    if (period === "bimestre") {
      // Bimestre de 2 meses baseado no mês corrente (ex: Jan-Fev, Mar-Abr, Mai-Jun, Jul-Ago, Set-Out, Nov-Dez)
      const bIndex = Math.floor(month / 2); // 0, 1, 2, 3, 4, 5
      const m1 = bIndex * 2;
      const m2 = m1 + 1;

      const s1 = new Date(year, m1, 1, 0, 0, 0, 0);
      const e1 = new Date(year, m1 + 1, 0, 23, 59, 59, 999);
      const s2 = new Date(year, m2, 1, 0, 0, 0, 0);
      const e2 = new Date(year, m2 + 1, 0, 23, 59, 59, 999);

      return {
        buckets: [
          { id: `b-${m1}`, label: MONTH_NAMES_FULL[m1] || `Mês ${m1 + 1}`, sublabel: `${MONTH_NAMES_SHORT[m1] || ""}/${year}`, start: s1, end: e1 },
          { id: `b-${m2}`, label: MONTH_NAMES_FULL[m2] || `Mês ${m2 + 1}`, sublabel: `${MONTH_NAMES_SHORT[m2] || ""}/${year}`, start: s2, end: e2 },
        ],
        periodTitle: `${bIndex + 1}º Bimestre de ${year} (${MONTH_NAMES_SHORT[m1] || ""} - ${MONTH_NAMES_SHORT[m2] || ""})`,
        rangeStart: s1,
        rangeEnd: e2,
      };
    }

    if (period === "trimestre") {
      // Trimestre de 3 meses (1º: Jan-Mar, 2º: Abr-Jun, 3º: Jul-Set, 4º: Out-Dez)
      const qIndex = Math.floor(month / 3); // 0, 1, 2, 3
      const m1 = qIndex * 3;
      const m2 = m1 + 1;
      const m3 = m1 + 2;

      const s1 = new Date(year, m1, 1, 0, 0, 0, 0);
      const e1 = new Date(year, m1 + 1, 0, 23, 59, 59, 999);
      const s2 = new Date(year, m2, 1, 0, 0, 0, 0);
      const e2 = new Date(year, m2 + 1, 0, 23, 59, 59, 999);
      const s3 = new Date(year, m3, 1, 0, 0, 0, 0);
      const e3 = new Date(year, m3 + 1, 0, 23, 59, 59, 999);

      return {
        buckets: [
          { id: `q-${m1}`, label: MONTH_NAMES_FULL[m1] || `Mês ${m1 + 1}`, sublabel: `${MONTH_NAMES_SHORT[m1] || ""}/${year}`, start: s1, end: e1 },
          { id: `q-${m2}`, label: MONTH_NAMES_FULL[m2] || `Mês ${m2 + 1}`, sublabel: `${MONTH_NAMES_SHORT[m2] || ""}/${year}`, start: s2, end: e2 },
          { id: `q-${m3}`, label: MONTH_NAMES_FULL[m3] || `Mês ${m3 + 1}`, sublabel: `${MONTH_NAMES_SHORT[m3] || ""}/${year}`, start: s3, end: e3 },
        ],
        periodTitle: `${qIndex + 1}º Trimestre de ${year} (${MONTH_NAMES_SHORT[m1] || ""} - ${MONTH_NAMES_SHORT[m3] || ""})`,
        rangeStart: s1,
        rangeEnd: e3,
      };
    }

    // Default: "ano" (12 meses)
    const bList: PeriodBucket[] = [];
    for (let m = 0; m < 12; m++) {
      const s = new Date(year, m, 1, 0, 0, 0, 0);
      const e = new Date(year, m + 1, 0, 23, 59, 59, 999);
      bList.push({
        id: `m-${m}`,
        label: MONTH_NAMES_SHORT[m] || `Mês ${m + 1}`,
        sublabel: MONTH_NAMES_FULL[m] || "",
        start: s,
        end: e,
      });
    }

    return {
      buckets: bList,
      periodTitle: `Ano de ${year}`,
      rangeStart: new Date(year, 0, 1, 0, 0, 0, 0),
      rangeEnd: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }, [period, refDate]);

  // Busca agendamentos do intervalo
  const { data: rawAppointments, isLoading: loadingAppointments } = useQuery({
    queryKey: ["relatorio-atendimentos-periodo", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          user_id,
          pet_id,
          scheduled_at,
          status,
          ops_status,
          notes,
          total_cents,
          service_price_cents,
          transport_price_cents,
          logistics_type,
          services (
            name,
            category
          ),
          pets (
            name,
            species
          )
        `)
        .gte("scheduled_at", rangeStart.toISOString())
        .lte("scheduled_at", rangeEnd.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Busca todos os perfis cadastrados para mapear o nome e telefone do tutor
  const { data: profiles } = useQuery({
    queryKey: ["profiles-tutors-relatorio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileById = useMemo(() => {
    const map = new Map<string, { full_name: string | null; phone: string | null }>();
    for (const p of profiles ?? []) {
      map.set(p.id, { full_name: p.full_name, phone: p.phone });
    }
    return map;
  }, [profiles]);

  // Categorias únicas encontradas
  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of rawAppointments ?? []) {
      const cat = a.services?.category;
      if (cat) set.add(cat);
    }
    return Array.from(set).sort();
  }, [rawAppointments]);

  // Agrega dados de agendamentos por Cliente e por Balde/Coluna
  const {
    clientRows,
    bucketTotals,
    maxCellRevenue,
    maxBucketTotalRevenue,
    grandTotalCount,
    grandTotalRevenue,
    periodCancelledCount,
    periodUnder2hCount,
    periodCancellationRate,
  } = useMemo(() => {
    const clientMap = new Map<string, ClientRow>();

    // Inicializa totais de baldes
    const bTotals: Record<string, ClientBucketStats> = {};
    for (const b of buckets) {
      bTotals[b.id] = { count: 0, revenueCents: 0, cancelledCount: 0 };
    }

    let grandCount = 0;
    let grandRevenue = 0;
    let periodTotalCount = 0;
    let periodCancelled = 0;
    let periodUnder2h = 0;

    for (const a of rawAppointments ?? []) {
      const isCancelled = a.status === "cancelado" || a.ops_status === "cancelado";
      const isExecuted = isServiceExecuted({ status: a.status, ops_status: a.ops_status });
      const isUnder2h = (a.notes || "").includes("menos de 2h");

      periodTotalCount++;
      if (isCancelled) {
        periodCancelled++;
        if (isUnder2h) periodUnder2h++;
      }

      // Filtro de status: executados vs ativos vs cancelados vs todos
      if (statusFilter === "cancelados" && !isCancelled) continue;
      if (statusFilter === "executados" && (!isExecuted || isCancelled)) continue;
      if (statusFilter === "ativos" && (isExecuted || isCancelled)) continue;

      // Filtro de categoria de serviço
      if (categoryFilter !== "todos" && a.services?.category !== categoryFilter) {
        continue;
      }

      const apptDate = new Date(a.scheduled_at);
      const apptTime = apptDate.getTime();

      // Encontra o balde em que o agendamento cai
      const bucket = buckets.find((b) => apptTime >= b.start.getTime() && apptTime <= b.end.getTime());
      if (!bucket) continue;

      const userId = a.user_id || "anon";
      const profile = a.user_id ? profileById.get(a.user_id) : undefined;
      const tutorName = profile?.full_name?.trim() || (a.user_id ? `Cliente ${a.user_id.slice(0, 5)}` : "Cliente Avulso");
      const phone = profile?.phone || null;
      const petName = a.pets?.name || null;

      const cents = (a.total_cents && a.total_cents > 0)
        ? a.total_cents
        : (a.service_price_cents || 0) + (a.transport_price_cents || 0);

      if (!clientMap.has(userId)) {
        const initBuckets: Record<string, ClientBucketStats> = {};
        for (const b of buckets) {
          initBuckets[b.id] = { count: 0, revenueCents: 0, cancelledCount: 0 };
        }

        clientMap.set(userId, {
          userId,
          tutorName,
          phone,
          petNames: petName ? [petName] : [],
          buckets: initBuckets,
          totalCount: 0,
          totalRevenueCents: 0,
          totalCancelledCount: 0,
        });
      }

      const row = clientMap.get(userId)!;
      if (petName && !row.petNames.includes(petName)) {
        row.petNames.push(petName);
      }

      if (!row.buckets[bucket.id]) {
        row.buckets[bucket.id] = { count: 0, revenueCents: 0, cancelledCount: 0 };
      }

      if (!bTotals[bucket.id]) {
        bTotals[bucket.id] = { count: 0, revenueCents: 0, cancelledCount: 0 };
      }

      if (isCancelled) {
        row.buckets[bucket.id]!.cancelledCount += 1;
        row.totalCancelledCount += 1;
        bTotals[bucket.id]!.cancelledCount += 1;

        if (statusFilter === "cancelados") {
          row.buckets[bucket.id]!.count += 1;
          row.buckets[bucket.id]!.revenueCents += cents;
          row.totalCount += 1;
          row.totalRevenueCents += cents;

          bTotals[bucket.id]!.count += 1;
          bTotals[bucket.id]!.revenueCents += cents;
          grandCount += 1;
          grandRevenue += cents;
        }
      } else {
        row.buckets[bucket.id]!.count += 1;
        row.buckets[bucket.id]!.revenueCents += cents;
        row.totalCount += 1;
        row.totalRevenueCents += cents;

        bTotals[bucket.id]!.count += 1;
        bTotals[bucket.id]!.revenueCents += cents;
        grandCount += 1;
        grandRevenue += cents;
      }
    }

    let maxCell = 0;
    for (const row of clientMap.values()) {
      for (const b of buckets) {
        const rev = row.buckets[b.id]?.revenueCents || 0;
        if (rev > maxCell) {
          maxCell = rev;
        }
      }
    }

    let maxBucketTotal = 0;
    for (const b of buckets) {
      const bRev = bTotals[b.id]?.revenueCents || 0;
      if (bRev > maxBucketTotal) {
        maxBucketTotal = bRev;
      }
    }

    const cancellationRate = periodTotalCount > 0 ? (periodCancelled / periodTotalCount) * 100 : 0;

    return {
      clientRows: Array.from(clientMap.values()),
      bucketTotals: bTotals,
      maxCellRevenue: maxCell || 1,
      maxBucketTotalRevenue: maxBucketTotal || 1,
      grandTotalCount: grandCount,
      grandTotalRevenue: grandRevenue,
      periodCancelledCount: periodCancelled,
      periodUnder2hCount: periodUnder2h,
      periodCancellationRate: cancellationRate,
    };
  }, [rawAppointments, statusFilter, categoryFilter, buckets, profileById]);

  // Filtragem e ordenação das linhas
  const filteredRows = useMemo(() => {
    let list = clientRows;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.tutorName.toLowerCase().includes(q) ||
          r.petNames.some((p) => p.toLowerCase().includes(q)) ||
          (r.phone && r.phone.includes(q))
      );
    }

    return list.sort((a, b) => {
      if (sortBy === "faturamento") {
        return b.totalRevenueCents - a.totalRevenueCents;
      }
      if (sortBy === "atendimentos") {
        return b.totalCount - a.totalCount;
      }
      return a.tutorName.localeCompare(b.tutorName);
    });
  }, [clientRows, search, sortBy]);

  // Exportação para Excel (.xlsx)
  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();

    // Monta cabeçalhos da planilha
    const isCanc = statusFilter === "cancelados";
    const headerRow: string[] = ["Cliente / Tutor", "Telefone", "Pets"];
    for (const b of buckets) {
      headerRow.push(
        isCanc ? `Qtde Canc. (${b.label})` : `Qtde (${b.label})`,
        isCanc ? `Valor Estimado R$ (${b.label})` : `Valor R$ (${b.label})`
      );
    }
    headerRow.push(
      isCanc ? "Total Cancelamentos" : "Total Atendimentos",
      isCanc ? "Total Estimado (R$)" : "Total Faturamento (R$)"
    );

    const dataRows: (string | number)[][] = [headerRow];

    // Linhas de dados
    for (const r of filteredRows) {
      const row: (string | number)[] = [
        r.tutorName,
        r.phone || "-",
        r.petNames.join(", ") || "-",
      ];
      for (const b of buckets) {
        const bStats = r.buckets[b.id] || { count: 0, revenueCents: 0 };
        row.push(bStats.count);
        row.push((bStats.revenueCents / 100).toFixed(2));
      }
      row.push(r.totalCount);
      row.push((r.totalRevenueCents / 100).toFixed(2));
      dataRows.push(row);
    }

    // Linha de totais
    const totalRow: (string | number)[] = ["TOTAL GERAL", "-", "-"];
    for (const b of buckets) {
      totalRow.push(bucketTotals[b.id]?.count || 0);
      totalRow.push(((bucketTotals[b.id]?.revenueCents || 0) / 100).toFixed(2));
    }
    totalRow.push(grandTotalCount);
    totalRow.push((grandTotalRevenue / 100).toFixed(2));
    dataRows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(dataRows);

    // Larguras automáticas de coluna
    ws["!cols"] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 20 },
      ...buckets.flatMap(() => [{ wch: 14 }, { wch: 16 }]),
      { wch: 18 },
      { wch: 20 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");
    const fileName = `relatorio-atendimentos-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  // Controles de navegação temporal (avançar/voltar)
  const handleShiftPeriod = (direction: -1 | 1) => {
    const d = new Date(refDate);
    if (period === "hoje") {
      d.setDate(d.getDate() + direction);
    } else if (period === "semana") {
      d.setDate(d.getDate() + direction * 7);
    } else if (period === "mes") {
      d.setMonth(d.getMonth() + direction);
    } else if (period === "bimestre") {
      d.setMonth(d.getMonth() + direction * 2);
    } else if (period === "trimestre") {
      d.setMonth(d.getMonth() + direction * 3);
    } else if (period === "ano") {
      d.setFullYear(d.getFullYear() + direction);
    }
    setRefDate(d);
  };

  const handleResetToToday = () => {
    setRefDate(new Date());
  };

  const ticketMedioCents = grandTotalCount > 0 ? Math.round(grandTotalRevenue / grandTotalCount) : 0;

  return (
    <div className="space-y-4">
      {/* 1. Header do Relatório e Filtros de Período */}
      <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-card space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary font-bold">
                <Calendar className="h-4 w-4" />
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-foreground font-display">
                Relatório Analítico de Atendimentos
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Acompanhamento de volume e faturamento por cliente através dos períodos com barras comparativas.
            </p>
          </div>

          {/* Botões de Ação: Exportar Excel e Imprimir */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportXLSX}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/70 hover:bg-muted/60"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Exportar Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 border-border/70 hover:bg-muted/60"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Barra de Filtros Principais (Hoje, Semana, Mês, Bimestre, Trimestre, Ano) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-border/60">
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-2xl">
            {(
              [
                ["hoje", "Hoje"],
                ["semana", "Semana"],
                ["mes", "Mês"],
                ["bimestre", "Bimestre"],
                ["trimestre", "Trimestre"],
                ["ano", "Ano"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-xl transition-all text-center",
                  period === key
                    ? "bg-card text-foreground shadow-xs ring-1 ring-border/80 font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Seletor Temporal (Voltar, Período Ativo, Avançar, Reset Hoje) */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => handleShiftPeriod(-1)}
              title="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-foreground px-2 whitespace-nowrap">
              {periodTitle}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => handleShiftPeriod(1)}
              title="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetToToday}
              className="h-7 px-2 text-[10px] font-bold rounded-lg ml-1"
            >
              Hoje
            </Button>
          </div>
        </div>

        {/* Filtros Secundários (Busca, Status, Categoria, Ordenação) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {/* Busca por cliente ou pet */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente ou pet..."
              className="pl-8 h-8 text-xs rounded-xl"
            />
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: "executados", label: "Concluídos" },
              { id: "ativos", label: "Confirmados / Abertos" },
              { id: "cancelados", label: "🚫 Cancelados" },
              { id: "todos", label: "Todos" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id as any)}
                className={cn(
                  "flex-1 h-8 rounded-xl text-xs font-semibold px-2 transition-all border whitespace-nowrap cursor-pointer",
                  statusFilter === st.id
                    ? st.id === "cancelados"
                      ? "bg-rose-600 text-white border-rose-600 font-bold shadow-xs"
                      : "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                    : st.id === "cancelados" && periodCancelledCount > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filtro de Categoria de Serviço */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-xl text-xs font-semibold px-2.5 bg-background border border-border/70 text-foreground"
          >
            <option value="todos">Todos os serviços</option>
            {serviceCategories.map((cat) => (
              <option key={cat} value={cat}>
                Categoria: {cat}
              </option>
            ))}
          </select>

          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-8 rounded-xl text-xs font-semibold px-2.5 bg-background border border-border/70 text-foreground"
          >
            <option value="faturamento">Ordenar: Maior Faturamento</option>
            <option value="atendimentos">Ordenar: Mais Atendimentos</option>
            <option value="nome">Ordenar: Nome do Cliente (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 2. Cards de KPIs Resumidos do Período */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="rounded-2xl p-3 border border-border/80 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {statusFilter === "cancelados" ? "Cancelados no Período" : "Atendimentos no Período"}
            </p>
            <p className="text-lg font-black font-display text-foreground mt-0.5">
              {grandTotalCount}
            </p>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/10 text-violet-600 font-bold">
            <Layers className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl p-3 border border-border/80 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {statusFilter === "cancelados" ? "Valor Cancelado" : "Faturamento Total"}
            </p>
            <p className={cn(
              "text-lg font-black font-display mt-0.5",
              statusFilter === "cancelados" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {formatBRL(grandTotalRevenue)}
            </p>
          </div>
          <div className={cn(
            "grid h-8 w-8 place-items-center rounded-xl font-bold",
            statusFilter === "cancelados" ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
          )}>
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl p-3 border border-border/80 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Clientes Únicos
            </p>
            <p className="text-lg font-black font-display text-foreground mt-0.5">
              {filteredRows.length}
            </p>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-500/10 text-sky-600 font-bold">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-2xl p-3 border border-border/80 bg-card shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ticket Médio
            </p>
            <p className="text-lg font-black font-display text-foreground mt-0.5">
              {formatBRL(ticketMedioCents)}
            </p>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 font-bold">
            <Filter className="h-4 w-4" />
          </div>
        </div>

        {/* Card 5: Taxa e Total de Cancelamentos */}
        <div className="rounded-2xl p-3 border border-rose-200/80 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900/60 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Cancelamentos
              </p>
              {periodUnder2hCount > 0 && (
                <span className="text-[9px] font-bold px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300" title="Cancelados com menos de 2h">
                  {periodUnder2hCount} &lt;2h
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <p className="text-lg font-black font-display text-rose-700 dark:text-rose-400">
                {periodCancelledCount}
              </p>
              <span className="text-[10px] font-bold text-rose-600/80 dark:text-rose-400/80">
                ({periodCancellationRate.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15 text-rose-600 font-bold">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. Tabela Analítica Multi-Período com Barras Horizontais */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-card overflow-hidden">
        <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Grade de Atendimentos & Barras de Volume
            </span>
            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0">
              {filteredRows.length} cliente{filteredRows.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-xs bg-primary/40 inline-block" />
              Barra = Proporcional ao valor em R$
            </span>
          </div>
        </div>

        {loadingAppointments ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Carregando agendamentos do período...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            Nenhum atendimento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40">
                  {/* Coluna Fixa do Cliente */}
                  <th className="p-3 font-extrabold text-foreground sticky left-0 bg-muted/90 backdrop-blur-xs z-10 min-w-[220px] max-w-[260px] shadow-xs">
                    Cliente / Tutor
                  </th>

                  {/* Colunas dos Baldes de Período (ex: Jan, Fev, Mar) */}
                  {buckets.map((b) => (
                    <th key={b.id} className="p-3 font-extrabold text-foreground min-w-[170px] border-l border-border/40">
                      <div className="flex flex-col">
                        <span className="text-xs font-extrabold text-foreground truncate">{b.label}</span>
                        {b.sublabel && (
                          <span className="text-[10px] font-medium text-muted-foreground truncate">{b.sublabel}</span>
                        )}
                        <span className="text-[9px] font-semibold text-primary/80 mt-0.5">
                          Qtde · R$ · Volume
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* Coluna Total do Cliente */}
                  <th className="p-3 font-extrabold text-foreground min-w-[160px] border-l border-border/60 bg-muted/60 text-right">
                    Total Acumulado
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/50">
                {filteredRows.map((row) => {
                  return (
                    <tr key={row.userId} className="hover:bg-muted/30 transition-colors group">
                      {/* Coluna do Tutor / Pets */}
                      <td className="p-3 sticky left-0 bg-card group-hover:bg-muted/40 transition-colors z-10 shadow-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-foreground truncate">{row.tutorName}</span>
                          </div>

                          {row.petNames.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {row.petNames.slice(0, 2).map((p) => (
                                <span
                                  key={p}
                                  className="inline-flex items-center gap-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-secondary-foreground"
                                >
                                  🐾 {p}
                                </span>
                              ))}
                              {row.petNames.length > 2 && (
                                <span className="text-[9px] text-muted-foreground font-semibold">
                                  +{row.petNames.length - 2}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Botão Rápido de Contato */}
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openInAppChat({
                                  tutorName: row.tutorName,
                                  tutorPhone: row.phone ?? undefined,
                                  petName: row.petNames[0],
                                  contextTag: "Relatório de Atendimentos",
                                  defaultText: `Olá, ${row.tutorName}! Somos da Big Dog Pet.`,
                                })
                              }
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                            >
                              <MessageCircle className="h-3 w-3" />
                              Chat
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Colunas dos Períodos (Qtde / R$ / Barra Horizontal) */}
                      {buckets.map((b) => {
                        const cell = row.buckets[b.id] || { count: 0, revenueCents: 0, cancelledCount: 0 };
                        const hasValue = cell.count > 0;
                        const isCanc = statusFilter === "cancelados";
                        const barWidthPercent = hasValue
                          ? isCanc
                            ? 100
                            : Math.min(100, Math.max(10, Math.round((cell.revenueCents / maxCellRevenue) * 100)))
                          : 0;

                        return (
                          <td key={b.id} className="p-3 border-l border-border/40 align-middle">
                            {hasValue ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "text-[10px] font-black px-1.5 py-0 h-4",
                                      isCanc
                                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                        : "bg-primary/15 text-primary"
                                    )}
                                  >
                                    {cell.count} {isCanc ? "canc." : "atend."}
                                  </Badge>
                                  <span className={cn(
                                    "text-xs font-black",
                                    isCanc ? "text-rose-600 dark:text-rose-400 line-through opacity-80" : "text-foreground"
                                  )}>
                                    {formatBRL(cell.revenueCents)}
                                  </span>
                                </div>

                                {/* Barra Horizontal de Valor Proporcional */}
                                <div
                                  className="w-full bg-muted/70 rounded-full h-2 overflow-hidden flex"
                                  title={`${row.tutorName} - ${b.label}: ${cell.count} ${isCanc ? "cancelamentos" : "atendimentos"} (${formatBRL(cell.revenueCents)})`}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      isCanc ? "bg-rose-500" : "bg-primary"
                                    )}
                                    style={{ width: `${barWidthPercent}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground/40 font-mono text-xs">-</div>
                            )}
                          </td>
                        );
                      })}

                      {/* Coluna Total Acumulado do Cliente */}
                      <td className="p-3 border-l border-border/60 bg-muted/20 text-right align-middle">
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "text-xs font-black font-display",
                            statusFilter === "cancelados" ? "text-rose-600 dark:text-rose-400 line-through opacity-80" : "text-foreground"
                          )}>
                            {formatBRL(row.totalRevenueCents)}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground mt-0.5">
                            {row.totalCount} {statusFilter === "cancelados" ? (row.totalCount === 1 ? "cancelamento" : "cancelamentos") : (row.totalCount === 1 ? "atendimento" : "atendimentos")}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* 4. Rodapé Fixo: TOTAL DO MÊS / PERÍODO */}
              <tfoot>
                <tr className="border-t-2 border-border/90 bg-muted/80 font-black">
                  {/* Totalizador Geral */}
                  <td className="p-3.5 sticky left-0 bg-muted/95 backdrop-blur-xs z-10 shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                        TOTAL MÊS / PERÍODO
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {filteredRows.length} clientes {statusFilter === "cancelados" ? "com cancelamentos" : "ativos"}
                      </span>
                    </div>
                  </td>

                  {/* Totais de Cada Coluna com Barra Comparativa de Volume */}
                  {buckets.map((b) => {
                    const bTotal = bucketTotals[b.id] || { count: 0, revenueCents: 0, cancelledCount: 0 };
                    const isCanc = statusFilter === "cancelados";
                    const barWidthPercent =
                      bTotal.revenueCents > 0
                        ? Math.min(100, Math.max(12, Math.round((bTotal.revenueCents / maxBucketTotalRevenue) * 100)))
                        : isCanc && bTotal.count > 0
                        ? 100
                        : 0;

                    return (
                      <td key={b.id} className="p-3.5 border-l border-border/50 align-middle">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn(
                              "text-xs font-black",
                              isCanc ? "text-rose-600 dark:text-rose-400" : "text-primary"
                            )}>
                              {bTotal.count} {isCanc ? "canc." : "atend."}
                            </span>
                            <span className={cn(
                              "text-xs font-black font-display",
                              isCanc ? "text-rose-600 dark:text-rose-400 line-through opacity-80" : "text-foreground"
                            )}>
                              {formatBRL(bTotal.revenueCents)}
                            </span>
                          </div>

                          {/* Barra Horizontal Comparativa dos Totais de Cada Mês */}
                          <div
                            className={cn(
                              "w-full rounded-full h-2.5 overflow-hidden flex",
                              isCanc ? "bg-rose-500/20" : "bg-primary/20"
                            )}
                            title={`Total ${b.label}: ${bTotal.count} ${isCanc ? "cancelamentos" : "atendimentos"} | ${formatBRL(bTotal.revenueCents)}`}
                          >
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                isCanc ? "bg-rose-500" : "bg-primary"
                              )}
                              style={{ width: `${barWidthPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  {/* Super Total Acumulado */}
                  <td className={cn(
                    "p-3.5 border-l border-border/70 text-right align-middle",
                    statusFilter === "cancelados" ? "bg-rose-500/10" : "bg-primary/10"
                  )}>
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "text-sm font-black font-display",
                        statusFilter === "cancelados" ? "text-rose-600 dark:text-rose-400 line-through opacity-80" : "text-primary"
                      )}>
                        {formatBRL(grandTotalRevenue)}
                      </span>
                      <span className="text-[10px] font-extrabold text-foreground">
                        {grandTotalCount} {statusFilter === "cancelados" ? (grandTotalCount === 1 ? "cancelamento" : "cancelamentos") : (grandTotalCount === 1 ? "atendimento" : "atendimentos")}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
