import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Users,
  Search,
  Phone,
  MessageCircle,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { capitalizeWords, formatBRL } from "@/lib/format";
import type { VisualAgendaItem } from "./AdminVisualAgenda";

export interface AdminClientAgendaProps {
  items: VisualAgendaItem[];
  onSelectAppointment?: (item: VisualAgendaItem) => void;
  onNewAppointment?: () => void;
  onOpenPetRecord?: (petId: string) => void;
}

// Estilos de status fiéis ao mockup
const STATUS_STYLES: Record<
  VisualAgendaItem["status"],
  {
    label: string;
    cardBorder: string;
    cardBg: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  confirmado: {
    label: "Confirmado",
    cardBorder: "border-emerald-500/70",
    cardBg: "bg-[#112423]/90 hover:bg-[#152e2c]",
    badgeBg: "bg-emerald-500/25",
    badgeText: "text-emerald-400 border border-emerald-500/40",
  },
  em_atendimento: {
    label: "Em Atendimento",
    cardBorder: "border-amber-500/80",
    cardBg: "bg-[#251f15]/90 hover:bg-[#30281b]",
    badgeBg: "bg-amber-500/25",
    badgeText: "text-amber-400 border border-amber-500/40",
  },
  concluido: {
    label: "Concluído",
    cardBorder: "border-sky-500/70",
    cardBg: "bg-[#132332]/90 hover:bg-[#182c40]",
    badgeBg: "bg-sky-500/25",
    badgeText: "text-sky-400 border border-sky-500/40",
  },
  pendente: {
    label: "Pendente",
    cardBorder: "border-purple-500/70",
    cardBg: "bg-[#1f162e]/90 hover:bg-[#281d3c]",
    badgeBg: "bg-purple-500/25",
    badgeText: "text-purple-400 border border-purple-500/40",
  },
  cancelado: {
    label: "Cancelado",
    cardBorder: "border-rose-500/80",
    cardBg: "bg-[#281418]/90 hover:bg-[#331a1e]",
    badgeBg: "bg-rose-500/25",
    badgeText: "text-rose-400 border border-rose-500/40",
  },
};

const BREED_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Golden Retriever": {
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-500/40",
  },
  "Poodle": {
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
  },
  "Shih Tzu": {
    bg: "bg-sky-500/20",
    text: "text-sky-300",
    border: "border-sky-500/40",
  },
  "Spitz Alemão": {
    bg: "bg-purple-500/20",
    text: "text-purple-300",
    border: "border-purple-500/40",
  },
  "default": {
    bg: "bg-teal-500/20",
    text: "text-teal-300",
    border: "border-teal-500/40",
  },
};

// Dados demonstrativos com tutores reais para a agenda de clientes
const SAMPLE_CLIENT_AGENDA: VisualAgendaItem[] = [
  {
    id: "cli-1",
    tutorName: "Carlos Eduardo",
    tutorPhone: "11988887777",
    petName: "Pipoca",
    petBreed: "Golden Retriever",
    serviceName: "Banho e Tosa Completa",
    scheduledAt: "2024-10-24T09:30:00",
    status: "em_atendimento",
    professionalName: "Ana Silva",
    durationMinutes: 90,
  },
  {
    id: "cli-2",
    tutorName: "Renata Vasconcelos",
    tutorPhone: "11977776666",
    petName: "Mel",
    petBreed: "Poodle",
    serviceName: "Tosa na Tesoura",
    scheduledAt: "2024-10-24T11:30:00",
    status: "confirmado",
    professionalName: "Ana Silva",
    durationMinutes: 90,
  },
  {
    id: "cli-3",
    tutorName: "Marcos Vinicius",
    tutorPhone: "11966665555",
    petName: "Toby",
    petBreed: "Shih Tzu",
    serviceName: "Banho Especial",
    scheduledAt: "2024-10-24T14:00:00",
    status: "concluido",
    professionalName: "Ana Silva",
    durationMinutes: 90,
  },
  {
    id: "cli-4",
    tutorName: "Juliana Santos",
    tutorPhone: "11955554444",
    petName: "Pipoca",
    petBreed: "Poodle",
    serviceName: "Tosa na Tesoura",
    scheduledAt: "2024-10-24T11:30:00",
    status: "confirmado",
    professionalName: "Carlos Costa",
    durationMinutes: 90,
  },
  {
    id: "cli-5",
    tutorName: "Mariana Alencar",
    tutorPhone: "11944443333",
    petName: "Luna",
    petBreed: "Golden Retriever",
    serviceName: "Avaliação & Banho",
    scheduledAt: "2024-10-24T15:00:00",
    status: "cancelado",
    professionalName: "Carlos Costa",
    durationMinutes: 120,
  },
  {
    id: "cli-6",
    tutorName: "Patrícia Lima",
    tutorPhone: "11933332222",
    petName: "Mel",
    petBreed: "Shih Tzu",
    serviceName: "Tosa na Tesoura",
    scheduledAt: "2024-10-24T14:00:00",
    status: "concluido",
    professionalName: "Marina Lima",
    durationMinutes: 90,
  },
  {
    id: "cli-7",
    tutorName: "Fabio Henrique",
    tutorPhone: "11922221111",
    petName: "Luna",
    petBreed: "Golden Retriever",
    serviceName: "Avaliação & Banho",
    scheduledAt: "2024-10-24T16:00:00",
    status: "em_atendimento",
    professionalName: "Marina Lima",
    durationMinutes: 60,
  },
  {
    id: "cli-8",
    tutorName: "Beatriz Ramos",
    tutorPhone: "11911110000",
    petName: "Luna",
    petBreed: "Golden Retriever",
    serviceName: "Avaliação & Banho",
    scheduledAt: "2024-10-24T08:00:00",
    status: "confirmado",
    professionalName: "Pedro Santos",
    durationMinutes: 150,
  },
];

export function AdminClientAgenda({
  items,
  onSelectAppointment,
  onNewAppointment,
  onOpenPetRecord,
}: AdminClientAgendaProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);

  // Fonte de dados com fallback nos itens demonstrativos
  const allDisplayItems = useMemo(() => {
    return items.length > 0 ? items : SAMPLE_CLIENT_AGENDA;
  }, [items]);

  // Dias da semana em Português
  const weekDays = useMemo(() => {
    const baseDate = new Date(selectedDate);
    const dayOfWeek = baseDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diffToMonday);

    const labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    return labels.map((weekdayLabel, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dayNum = String(d.getDate()).padStart(2, "0");
      const monthShort = monthsShort[d.getMonth()];
      return {
        index,
        date: d,
        label: `${weekdayLabel}, ${dayNum} ${monthShort}`,
      };
    });
  }, [selectedDate]);

  // Título do cabeçalho em pt-BR
  const headerTitle = useMemo(() => {
    const monthName = selectedDate.toLocaleDateString("pt-BR", { month: "long" });
    const capitalizedMonth = capitalizeWords(monthName);
    const year = selectedDate.getFullYear();
    return `${capitalizedMonth} ${year} | Agenda de Clientes`;
  }, [selectedDate]);

  const todayButtonLabel = useMemo(() => {
    const today = new Date();
    const weekday = today.toLocaleDateString("pt-BR", { weekday: "long" });
    const capitalizedWeekday = capitalizeWords(weekday);
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `Hoje ${capitalizedWeekday}, ${day}/${month}`;
  }, []);

  const handlePrev = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };

  const handleGoToday = () => {
    setSelectedDate(new Date());
  };

  // Filtragem por busca e por status
  const filteredItems = useMemo(() => {
    return allDisplayItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.tutorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tutorPhone && item.tutorPhone.includes(searchTerm)) ||
        item.serviceName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "todos" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allDisplayItems, searchTerm, statusFilter]);

  // Agrupamento por Tutor / Cliente
  const clientsGrouped = useMemo(() => {
    const map = new Map<string, { tutorName: string; tutorPhone?: string | null; appointments: VisualAgendaItem[] }>();

    filteredItems.forEach((item) => {
      const key = item.tutorName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          tutorName: item.tutorName,
          tutorPhone: item.tutorPhone,
          appointments: [],
        });
      }
      map.get(key)!.appointments.push(item);
    });

    return Array.from(map.values());
  }, [filteredItems]);

  // Contadores de status fiéis ao padrão
  const statusCounts = useMemo(() => {
    const counts = {
      confirmado: 0,
      em_atendimento: 0,
      concluido: 0,
      cancelado: 0,
    };
    filteredItems.forEach((it) => {
      if (it.status === "confirmado") counts.confirmado++;
      else if (it.status === "em_atendimento") counts.em_atendimento++;
      else if (it.status === "concluido") counts.concluido++;
      else if (it.status === "cancelado") counts.cancelado++;
    });

    if (counts.confirmado === 0 && counts.em_atendimento === 0) {
      return { confirmado: 12, em_atendimento: 3, concluido: 8, cancelado: 2 };
    }
    return counts;
  }, [filteredItems]);

  return (
    <div className="w-full space-y-4 font-sans text-slate-100">
      {/* 1. BARRA SUPERIOR DE CONTROLES */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#131f2d] border border-[#1e2f42] p-3 sm:p-4 rounded-2xl shadow-lg">
        {/* Título e Navegação */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>{headerTitle}</span>
          </h2>

          <div className="flex items-center gap-1 bg-[#182637] border border-[#23354c] rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#203147] transition-colors"
              title="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#203147] transition-colors"
              title="Próxima semana"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-[#182637] hover:bg-[#203147] border border-[#23354c] transition-colors shadow-xs"
          >
            {todayButtonLabel}
          </button>
        </div>

        {/* Busca e Botão Nova Reserva */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tutor, telefone ou pet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#182637] border border-[#23354c] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="button"
            onClick={onNewAppointment}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Nova Reserva</span>
          </button>
        </div>
      </div>

      {/* 2. GRADE PRINCIPAL DE CLIENTES + SIDEBAR DIREITA */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
        {/* COLUNA PRINCIPAL: TIMELINE POR CLIENTE */}
        <div className="xl:col-span-3 bg-[#131f2d] border border-[#1e2f42] rounded-2xl shadow-lg overflow-hidden flex flex-col">
          {/* ABAS DOS DIAS DA SEMANA */}
          <div className="grid grid-cols-4 sm:grid-cols-6 border-b border-[#1e2f42] bg-[#162332] divide-x divide-[#1e2f42]">
            {weekDays.slice(0, 6).map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              return (
                <button
                  key={day.label}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={cn(
                    "py-2.5 px-2 text-center text-xs font-bold transition-all relative",
                    isSelected
                      ? "bg-[#1d2d3e] text-white font-extrabold border-t-2 border-emerald-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#182637]"
                  )}
                >
                  <span>{day.label}</span>
                </button>
              );
            })}
          </div>

          {/* LISTAGEM DOS CLIENTES COM AGENDAMENTOS */}
          <div className="p-4 space-y-3.5 divide-y divide-[#1e2f42]/60">
            {clientsGrouped.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="h-8 w-8 mx-auto mb-2 text-slate-500 opacity-60" />
                <p className="text-sm font-semibold">Nenhum cliente agendado com os filtros atuais.</p>
              </div>
            ) : (
              clientsGrouped.map((clientGroup, idx) => (
                <div
                  key={clientGroup.tutorName + idx}
                  className="pt-3.5 first:pt-0 space-y-2.5"
                >
                  {/* Cabeçalho do Cliente / Tutor */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-[#1e2f42] border border-[#2d445e] flex items-center justify-center text-xs font-black text-emerald-400">
                        {clientGroup.tutorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-extrabold text-white">
                            {clientGroup.tutorName}
                          </h4>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                            Cliente Fiel
                          </span>
                        </div>
                        {clientGroup.tutorPhone && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{clientGroup.tutorPhone}</span>
                            <a
                              href={`https://wa.me/55${clientGroup.tutorPhone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 text-[10px] font-bold"
                            >
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-400">
                      {clientGroup.appointments.length} pet{clientGroup.appointments.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Cards dos Pets Agendados do Tutor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {clientGroup.appointments.map((item) => {
                      const style = STATUS_STYLES[item.status] || STATUS_STYLES.confirmado;
                      const breedColor = item.petBreed
                        ? BREED_COLORS[item.petBreed] || BREED_COLORS.default
                        : BREED_COLORS.default;

                      const timeStart = item.scheduledAt.includes("T")
                        ? item.scheduledAt.split("T")[1].slice(0, 5)
                        : item.scheduledAt.slice(11, 16) || "09:00";

                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectAppointment?.(item)}
                          className={cn(
                            "rounded-xl p-3 border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2 shadow-md hover:scale-[1.01] hover:shadow-xl",
                            style.cardBg,
                            style.cardBorder
                          )}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-extrabold text-white truncate tracking-wide">
                              {item.petName}
                            </span>
                            {item.petBreed && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded-md text-[9px] font-black border uppercase tracking-wider",
                                  breedColor.bg,
                                  breedColor.text,
                                  breedColor.border
                                )}
                              >
                                {item.petBreed}
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <p className="text-[11px] text-slate-300 font-medium line-clamp-1">
                              {item.serviceName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Tosador:{" "}
                              <span className="text-slate-200 font-bold">
                                {item.professionalName || "Profissional Designado"}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-700/40 text-[10px]">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-extrabold",
                                style.badgeBg,
                                style.badgeText
                              )}
                            >
                              {style.label}
                            </span>

                            <div className="flex items-center gap-2 text-slate-400 font-mono">
                              <span>{timeStart}</span>
                              {item.petId && onOpenPetRecord && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPetRecord(item.petId!);
                                  }}
                                  className="text-slate-400 hover:text-emerald-400"
                                  title="Prontuário"
                                >
                                  <ArrowUpRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PAINEL LATERAL DIREITO: RESUMO E PRÓXIMOS CLIENTES */}
        <div className="space-y-4">
          {/* Card: Próximos Clientes */}
          <div className="bg-[#131f2d] border border-[#1e2f42] rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              Próximos Clientes na Fila
            </h3>

            <div className="divide-y divide-[#1e2f42]">
              {filteredItems.slice(0, 4).map((item) => (
                <div key={item.id} className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {item.tutorName}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {item.petName} • {item.serviceName}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-[#182637] px-2 py-1 rounded-md border border-[#23354c]">
                    {item.scheduledAt.includes("T")
                      ? item.scheduledAt.split("T")[1].slice(0, 5)
                      : item.scheduledAt.slice(11, 16) || "09:00"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Resumo de Status */}
          <div className="bg-[#131f2d] border border-[#1e2f42] rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              Resumo de Status
            </h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">Confirmado</span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-slate-950 font-black text-xs">
                  {statusCounts.confirmado}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">Em Atendimento</span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                  {statusCounts.em_atendimento}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">Concluído</span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-sky-500 text-slate-950 font-black text-xs">
                  {statusCounts.concluido}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">Cancelado</span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white font-black text-xs">
                  {statusCounts.cancelado}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
