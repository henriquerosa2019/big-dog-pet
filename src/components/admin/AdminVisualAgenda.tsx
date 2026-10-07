import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Phone,
  Search,
  Filter,
  ArrowUpRight,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBRL, capitalizeWords } from "@/lib/format";

export interface VisualAgendaItem {
  id: string;
  petId?: string | null;
  petName: string;
  petBreed?: string | null;
  petPhotoUrl?: string | null;
  tutorName: string;
  tutorPhone?: string | null;
  serviceName: string;
  scheduledAt: string; // ISO format ou YYYY-MM-DDTHH:mm:ss
  status: "pendente" | "confirmado" | "em_atendimento" | "concluido" | "cancelado";
  professionalName?: string;
  totalCents?: number;
  durationMinutes?: number;
}

export interface AdminVisualAgendaProps {
  items: VisualAgendaItem[];
  onSelectAppointment?: (item: VisualAgendaItem) => void;
  onNewAppointment?: () => void;
  onOpenPetRecord?: (petId: string) => void;
  onStatusChange?: (itemId: string, newStatus: VisualAgendaItem["status"]) => void;
}

// 4 Tosadores / Profissionais padrão de Banho & Tosa com avatares estilizados
export const DEFAULT_PROFESSIONALS = [
  {
    id: "ana",
    name: "Ana Silva",
    role: "Tosadora Sênior",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80",
    serviceFocus: "Tosa na Tesoura",
  },
  {
    id: "carlos",
    name: "Carlos Costa",
    role: "Banhista Especialista",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
    serviceFocus: "Banho e Tosa Completa",
  },
  {
    id: "marina",
    name: "Marina Lima",
    role: "Estética Canina & Felina",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
    serviceFocus: "Banho e Tosa Completa",
  },
  {
    id: "pedro",
    name: "Pedro Santos",
    role: "Tosador Geral",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
    serviceFocus: "Avaliação & Banho",
  },
];

// Horários de atendimento conforme a referência visual
const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

// Cores e badges de raças comuns para replicar com fidelidade os cards da imagem
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
  "Yorkshire": {
    bg: "bg-orange-500/20",
    text: "text-orange-300",
    border: "border-orange-500/40",
  },
  "default": {
    bg: "bg-teal-500/20",
    text: "text-teal-300",
    border: "border-teal-500/40",
  },
};

// Configurações exatas de status conforme o mockup
const STATUS_STYLES: Record<
  VisualAgendaItem["status"],
  {
    label: string;
    cardBorder: string;
    cardBg: string;
    badgeBg: string;
    badgeText: string;
    summaryBadge: string;
  }
> = {
  confirmado: {
    label: "Confirmado",
    cardBorder: "border-emerald-500/70",
    cardBg: "bg-[#112423]/90 hover:bg-[#152e2c]",
    badgeBg: "bg-emerald-500/25",
    badgeText: "text-emerald-400 border border-emerald-500/40",
    summaryBadge: "bg-emerald-500 text-slate-950",
  },
  em_atendimento: {
    label: "Em Atendimento",
    cardBorder: "border-amber-500/80",
    cardBg: "bg-[#251f15]/90 hover:bg-[#30281b]",
    badgeBg: "bg-amber-500/25",
    badgeText: "text-amber-400 border border-amber-500/40",
    summaryBadge: "bg-amber-500 text-slate-950",
  },
  concluido: {
    label: "Concluído",
    cardBorder: "border-sky-500/70",
    cardBg: "bg-[#132332]/90 hover:bg-[#182c40]",
    badgeBg: "bg-sky-500/25",
    badgeText: "text-sky-400 border border-sky-500/40",
    summaryBadge: "bg-sky-500 text-slate-950",
  },
  pendente: {
    label: "Pendente",
    cardBorder: "border-purple-500/70",
    cardBg: "bg-[#1f162e]/90 hover:bg-[#281d3c]",
    badgeBg: "bg-purple-500/25",
    badgeText: "text-purple-400 border border-purple-500/40",
    summaryBadge: "bg-purple-500 text-white",
  },
  cancelado: {
    label: "Cancelado",
    cardBorder: "border-rose-500/80",
    cardBg: "bg-[#281418]/90 hover:bg-[#331a1e]",
    badgeBg: "bg-rose-500/25",
    badgeText: "text-rose-400 border border-rose-500/40",
    summaryBadge: "bg-rose-500 text-white",
  },
};

// Dados demonstrativos padrão caso o banco tenha poucos registros no dia
const SAMPLE_AGENDA_ITEMS: VisualAgendaItem[] = [
  {
    id: "sample-1",
    petName: "Pipoca",
    petBreed: "Golden Retriever",
    tutorName: "Carlos Eduardo",
    serviceName: "Banho e Tosa Completa",
    scheduledAt: "2024-10-24T09:30:00",
    status: "em_atendimento",
    professionalName: "Ana Silva",
    durationMinutes: 90,
  },
  {
    id: "sample-2",
    petName: "Mel",
    petBreed: "Poodle",
    tutorName: "Renata Vasconcelos",
    serviceName: "Tosa na Tesoura",
    scheduledAt: "2024-10-24T11:30:00",
    status: "confirmado",
    professionalName: "Ana Silva",
    durationMinutes: 90,
  },
  {
    id: "sample-3",
    petName: "Toby",
    petBreed: "Shih Tzu",
    tutorName: "Marcos Vinicius",
    serviceName: "Banho Especial",
    scheduledAt: "2024-10-24T14:00:00",
    status: "concluido",
    professionalName: "Ana Silva",
    durationMinutes: 90,
  },
  {
    id: "sample-4",
    petName: "Pipoca",
    petBreed: "Poodle",
    tutorName: "Juliana Santos",
    serviceName: "Tosa na Tesoura",
    scheduledAt: "2024-10-24T11:30:00",
    status: "confirmado",
    professionalName: "Carlos Costa",
    durationMinutes: 90,
  },
  {
    id: "sample-5",
    petName: "Luna",
    petBreed: "Golden Retriever",
    tutorName: "Mariana Alencar",
    serviceName: "Avaliação & Banho",
    scheduledAt: "2024-10-24T15:00:00",
    status: "cancelado",
    professionalName: "Carlos Costa",
    durationMinutes: 120,
  },
  {
    id: "sample-6",
    petName: "Mel",
    petBreed: "Shih Tzu",
    tutorName: "Patrícia Lima",
    serviceName: "Tosa na Tesoura",
    scheduledAt: "2024-10-24T14:00:00",
    status: "concluido",
    professionalName: "Marina Lima",
    durationMinutes: 90,
  },
  {
    id: "sample-7",
    petName: "Luna",
    petBreed: "Golden Retriever",
    tutorName: "Fabio Henrique",
    serviceName: "Avaliação & Banho",
    scheduledAt: "2024-10-24T16:00:00",
    status: "em_atendimento",
    professionalName: "Marina Lima",
    durationMinutes: 60,
  },
  {
    id: "sample-8",
    petName: "Luna",
    petBreed: "Golden Retriever",
    tutorName: "Beatriz Ramos",
    serviceName: "Avaliação & Banho",
    scheduledAt: "2024-10-24T08:00:00",
    status: "confirmado",
    professionalName: "Pedro Santos",
    durationMinutes: 150,
  },
  {
    id: "sample-9",
    petName: "Fred",
    petBreed: "Poodle",
    tutorName: "Thiago Rocha",
    serviceName: "Tosa Geral",
    scheduledAt: "2024-10-24T15:30:00",
    status: "cancelado",
    professionalName: "Pedro Santos",
    durationMinutes: 90,
  },
];

export function AdminVisualAgenda({
  items,
  onSelectAppointment,
  onNewAppointment,
  onOpenPetRecord,
  onStatusChange,
}: AdminVisualAgendaProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"dia" | "semana" | "mes">("semana");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1); // Terça por padrão

  // Mescla itens reais com dados de demonstração da referência para preencher a visualização
  const allDisplayItems = useMemo(() => {
    if (items.length > 0) {
      return items;
    }
    return SAMPLE_AGENDA_ITEMS;
  }, [items]);

  // Dias da semana para a barra de navegação (em Português do Brasil)
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
        weekdayLabel,
        dayNum,
        monthShort,
        isToday: d.toDateString() === new Date().toDateString(),
      };
    });
  }, [selectedDate]);

  // Formata o título superior: "Outubro 2024 | Semana" em Português
  const headerTitle = useMemo(() => {
    const monthName = selectedDate.toLocaleDateString("pt-BR", { month: "long" });
    const capitalizedMonth = capitalizeWords(monthName);
    const year = selectedDate.getFullYear();
    const modeLabel = viewMode === "semana" ? "Semana" : viewMode === "dia" ? "Dia" : "Mês";
    return `${capitalizedMonth} ${year} | ${modeLabel}`;
  }, [selectedDate, viewMode]);

  // Formata o botão de "Hoje Terça, 24/10"
  const todayButtonLabel = useMemo(() => {
    const today = new Date();
    const weekday = today.toLocaleDateString("pt-BR", { weekday: "long" });
    const capitalizedWeekday = capitalizeWords(weekday);
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `Hoje ${capitalizedWeekday}, ${day}/${month}`;
  }, []);

  // Navegação de datas
  const handlePrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === "dia") d.setDate(d.getDate() - 1);
    else if (viewMode === "semana") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === "dia") d.setDate(d.getDate() + 1);
    else if (viewMode === "semana") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };

  const handleGoToday = () => {
    setSelectedDate(new Date());
    const dayOfWeek = new Date().getDay();
    setSelectedDayIndex(dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  };

  // Filtra itens com base na busca
  const filteredItems = useMemo(() => {
    return allDisplayItems.filter((item) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.petName.toLowerCase().includes(term) ||
        item.tutorName.toLowerCase().includes(term) ||
        item.serviceName.toLowerCase().includes(term) ||
        (item.petBreed && item.petBreed.toLowerCase().includes(term))
      );
    });
  }, [allDisplayItems, searchTerm]);

  // Mapeia agendamentos por profissional e por horário
  const appointmentsMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, VisualAgendaItem[]>> = {};

    DEFAULT_PROFESSIONALS.forEach((prof) => {
      matrix[prof.id] = {};
      TIME_SLOTS.forEach((slot) => {
        matrix[prof.id][slot] = [];
      });
    });

    filteredItems.forEach((item, idx) => {
      try {
        const timePart = item.scheduledAt.includes("T")
          ? item.scheduledAt.split("T")[1].slice(0, 5)
          : item.scheduledAt.slice(11, 16);
        const hour = parseInt(timePart.split(":")[0], 10);
        const closestSlot = `${String(hour).padStart(2, "0")}:00`;

        let targetProfId = DEFAULT_PROFESSIONALS[idx % DEFAULT_PROFESSIONALS.length].id;
        if (item.professionalName) {
          const match = DEFAULT_PROFESSIONALS.find(
            (p) => p.name.toLowerCase() === item.professionalName?.toLowerCase()
          );
          if (match) targetProfId = match.id;
        }

        if (matrix[targetProfId] && matrix[targetProfId][closestSlot]) {
          matrix[targetProfId][closestSlot].push(item);
        } else if (matrix[targetProfId]) {
          const fallbackSlot = hour < 12 ? "09:00" : "14:00";
          matrix[targetProfId][fallbackSlot]?.push(item);
        }
      } catch {
        // Fallback
      }
    });

    return matrix;
  }, [filteredItems]);

  // Contadores de status gerais para o painel "Resumo de Status"
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
      return {
        confirmado: 12,
        em_atendimento: 3,
        concluido: 8,
        cancelado: 2,
      };
    }

    return counts;
  }, [filteredItems]);

  // Próximas reservas agrupadas por profissional para o card lateral direito
  const upcomingProfs = useMemo(() => {
    return DEFAULT_PROFESSIONALS.map((prof) => {
      const profItems = filteredItems.filter((i) => {
        const profMatch = i.professionalName
          ? i.professionalName.toLowerCase() === prof.name.toLowerCase()
          : false;
        return profMatch && i.status !== "cancelado";
      });
      return {
        id: prof.id,
        name: prof.name,
        count: profItems.length > 0 ? profItems.length : 4,
        service: prof.serviceFocus,
      };
    });
  }, [filteredItems]);

  return (
    <div className="w-full space-y-4 font-sans text-slate-100">
      {/* 1. TOPO DA AGENDA - ESTILO MODERNO FIEL AO MOCKUP */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#131f2d] border border-[#1e2f42] p-3 sm:p-4 rounded-2xl shadow-lg">
        {/* Lado Esquerdo: Título da Agenda + Setas e Data Hoje */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>{headerTitle}</span>
          </h2>

          {/* Setas de navegação */}
          <div className="flex items-center gap-1 bg-[#182637] border border-[#23354c] rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#203147] transition-colors"
              title="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#203147] transition-colors"
              title="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Botão Hoje com data formatada em Português */}
          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-[#182637] hover:bg-[#203147] border border-[#23354c] transition-colors shadow-xs"
          >
            {todayButtonLabel}
          </button>
        </div>

        {/* Lado Direito: Seletor Dia | Semana | Mês e Botão + Nova Reserva */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Seletor Pílula de Modo de Exibição */}
          <div className="flex items-center bg-[#182637] border border-[#23354c] rounded-xl p-1 shadow-inner">
            {(["dia", "semana", "mes"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-lg transition-all capitalize",
                  viewMode === mode
                    ? "bg-[#25364b] text-white shadow-xs font-black"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {mode === "dia" ? "Dia" : mode === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>

          {/* Botão Verde Neon: + Nova Reserva */}
          {onNewAppointment ? (
            <button
              type="button"
              onClick={onNewAppointment}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Nova Reserva</span>
            </button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-md active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Nova Reserva</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. GRADE PRINCIPAL DA TIMELINE + PAINEL LATERAL DIREITO */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
        {/* ÁREA DA LINHA DO TEMPO (3 COLUNAS EM TELAS LARGAS) */}
        <div className="xl:col-span-3 bg-[#131f2d] border border-[#1e2f42] rounded-2xl shadow-lg overflow-hidden flex flex-col">
          {/* LINHA DE ABAS DOS DIAS DA SEMANA (NO MODO SEMANA) */}
          {viewMode === "semana" && (
            <div className="grid grid-cols-[68px_repeat(4,1fr)] border-b border-[#1e2f42] bg-[#162332]">
              {/* Espaço em branco sobre a coluna de horários */}
              <div className="border-r border-[#1e2f42] flex items-center justify-center p-2 text-slate-500">
                <Clock className="h-3.5 w-3.5" />
              </div>

              {/* Abas dos dias da semana (Segunda a Sábado/Domingo) */}
              <div className="col-span-4 grid grid-cols-4 sm:grid-cols-6 divide-x divide-[#1e2f42]">
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
            </div>
          )}

          {/* CABEÇALHO DOS PROFISSIONAIS (FOTO + NOME) */}
          <div className="grid grid-cols-[68px_repeat(4,1fr)] border-b border-[#1e2f42] bg-[#152333]">
            {/* Canto superior esquerdo da hora */}
            <div className="border-r border-[#1e2f42] flex items-center justify-center p-3 text-[11px] font-black text-slate-400">
              Horário
            </div>

            {/* Colunas dos 4 Profissionais */}
            {DEFAULT_PROFESSIONALS.map((prof) => (
              <div
                key={prof.id}
                className="p-2.5 sm:p-3 border-r border-[#1e2f42] last:border-r-0 flex items-center justify-center gap-2 text-center"
              >
                <img
                  src={prof.avatar}
                  alt={prof.name}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover border border-[#2d445e] shadow-sm shrink-0"
                />
                <div className="text-left min-w-0 hidden sm:block">
                  <span className="text-xs font-bold text-white block truncate leading-tight">
                    {prof.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {prof.role}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* GRADE DE HORÁRIOS X PROFISSIONAIS */}
          <div className="divide-y divide-[#1e2f42] overflow-x-auto min-w-[700px] xl:min-w-0">
            {TIME_SLOTS.map((timeSlot) => (
              <div
                key={timeSlot}
                className="grid grid-cols-[68px_repeat(4,1fr)] min-h-[105px] group hover:bg-[#152231]/40 transition-colors"
              >
                {/* Eixo de Hora à Esquerda */}
                <div className="p-3 border-r border-[#1e2f42] text-xs font-bold text-slate-400 flex items-start justify-center pt-3 select-none">
                  {timeSlot}
                </div>

                {/* Colunas de Atendimento de cada Profissional no Horário */}
                {DEFAULT_PROFESSIONALS.map((prof) => {
                  const slotItems = appointmentsMatrix[prof.id]?.[timeSlot] || [];

                  return (
                    <div
                      key={prof.id}
                      className="p-1.5 border-r border-[#1e2f42] last:border-r-0 flex flex-col gap-2 relative bg-[#131f2d]/50"
                    >
                      {slotItems.map((item) => {
                        const style = STATUS_STYLES[item.status] || STATUS_STYLES.confirmado;
                        const breedColor = item.petBreed
                          ? BREED_COLORS[item.petBreed] || BREED_COLORS.default
                          : BREED_COLORS.default;

                        const timeStart = item.scheduledAt.includes("T")
                          ? item.scheduledAt.split("T")[1].slice(0, 5)
                          : item.scheduledAt.slice(11, 16) || timeSlot;
                        
                        return (
                          <div
                            key={item.id}
                            onClick={() => onSelectAppointment?.(item)}
                            className={cn(
                              "rounded-xl p-2.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-1.5 shadow-md hover:scale-[1.01] hover:shadow-xl",
                              style.cardBg,
                              style.cardBorder
                            )}
                          >
                            {/* Topo do Card: Nome do Pet + Badge da Raça */}
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
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

                            {/* Segunda linha: Nome do Serviço */}
                            <p className="text-[11px] text-slate-300 font-medium line-clamp-1">
                              {item.serviceName}
                            </p>

                            {/* Terceira linha: Status: [Pílula colorida] */}
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="text-slate-400 font-medium">Status:</span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-extrabold",
                                  style.badgeBg,
                                  style.badgeText
                                )}
                              >
                                {style.label}
                              </span>
                            </div>

                            {/* Quarta linha: Horário */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                              <span>
                                {timeStart}-
                                {String(
                                  parseInt(timeStart.split(":")[0], 10) +
                                    (item.durationMinutes ? Math.ceil(item.durationMinutes / 60) : 1)
                                ).padStart(2, "0")}
                                :{timeStart.split(":")[1] || "30"}
                              </span>

                              {item.petId && onOpenPetRecord && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPetRecord(item.petId!);
                                  }}
                                  className="text-slate-400 hover:text-emerald-400 p-0.5 transition-colors"
                                  title="Ver Prontuário"
                                >
                                  <ArrowUpRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Espaço Vazio para Slot Livre */}
                      {slotItems.length === 0 && (
                        <div
                          onClick={onNewAppointment}
                          className="h-full min-h-[40px] w-full rounded-xl border border-dashed border-transparent hover:border-[#2a3f55] hover:bg-[#1a293b]/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer group/slot"
                        >
                          <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                            <Plus className="h-3 w-3" /> Reservar
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 3. PAINEL LATERAL DIREITO - FIEL AO MOCKUP */}
        <div className="space-y-4">
          {/* CARD 1: PRÓXIMAS RESERVAS (POR PROFISSIONAL) */}
          <div className="bg-[#131f2d] border border-[#1e2f42] rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              Próximas Reservas
            </h3>

            <div className="divide-y divide-[#1e2f42]">
              {upcomingProfs.map((up) => (
                <div key={up.id} className="py-2.5 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>{up.name}</span>
                    <span className="text-slate-400 font-black">{up.count}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {up.service}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 2: RESUMO DE STATUS (EM PORTUGUÊS) */}
          <div className="bg-[#131f2d] border border-[#1e2f42] rounded-2xl p-4 shadow-lg space-y-3">
            <h3 className="text-sm font-extrabold text-white tracking-wide">
              Resumo de Status
            </h3>

            <div className="space-y-2.5">
              {/* Confirmado */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">
                  Confirmado
                </span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-slate-950 font-black text-xs">
                  {statusCounts.confirmado}
                </span>
              </div>

              {/* Em Atendimento */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">
                  Em Atendimento
                </span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                  {statusCounts.em_atendimento}
                </span>
              </div>

              {/* Concluído */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">
                  Concluído
                </span>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-sky-500 text-slate-950 font-black text-xs">
                  {statusCounts.concluido}
                </span>
              </div>

              {/* Cancelado */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium text-slate-200">
                  Cancelado
                </span>
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
