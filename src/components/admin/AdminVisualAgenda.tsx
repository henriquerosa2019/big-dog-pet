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
  Layers,
  ArrowUpRight,
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
  scheduledAt: string; // ISO format
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
}

// Profissionais padrão de Banho & Tosa
const DEFAULT_PROFESSIONALS = [
  { id: "ana", name: "Ana Silva", role: "Tosadora Senior", color: "from-blue-500 to-indigo-600" },
  { id: "carlos", name: "Carlos Costa", role: "Banhista Especialista", color: "from-emerald-500 to-teal-600" },
  { id: "marina", name: "Marina Lima", role: "Estética Felina & Canina", color: "from-purple-500 to-pink-600" },
  { id: "pedro", name: "Pedro Santos", role: "Tosador Geral", color: "from-amber-500 to-orange-600" },
];

const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const STATUS_CONFIG: Record<
  VisualAgendaItem["status"],
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  confirmado: {
    label: "Confirmado",
    bg: "bg-emerald-500/10 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  em_atendimento: {
    label: "Em Atendimento",
    bg: "bg-amber-500/15 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-500/40",
    dot: "bg-amber-500",
  },
  concluido: {
    label: "Concluído",
    bg: "bg-blue-500/10 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
  },
  pendente: {
    label: "Aguardando",
    bg: "bg-purple-500/10 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    dot: "bg-purple-500",
  },
  cancelado: {
    label: "Cancelado",
    bg: "bg-rose-500/10 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/30",
    dot: "bg-rose-500",
  },
};

export function AdminVisualAgenda({
  items,
  onSelectAppointment,
  onNewAppointment,
  onOpenPetRecord,
}: AdminVisualAgendaProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"dia" | "semana">("dia");
  const [searchTerm, setSearchTerm] = useState("");

  // Formatador da data no topo
  const formattedHeaderDate = useMemo(() => {
    const isToday =
      selectedDate.toDateString() === new Date().toDateString();
    const dateStr = selectedDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    return `${isToday ? "Hoje, " : ""}${capitalizeWords(dateStr)}`;
  }, [selectedDate]);

  // Navegação de dias
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Filtrar itens pela data selecionada
  const dateStrKey = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtrar data
      const itemDateStr = item.scheduledAt.slice(0, 10);
      const matchesDate = itemDateStr === dateStrKey;

      // Filtrar busca
      const matchesSearch =
        !searchTerm ||
        item.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tutorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serviceName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDate && matchesSearch;
    });
  }, [items, dateStrKey, searchTerm]);

  // Distribuir itens por profissional e hora
  const appointmentsBySlot = useMemo(() => {
    const matrix: Record<string, Record<string, VisualAgendaItem[]>> = {};

    DEFAULT_PROFESSIONALS.forEach((p) => {
      matrix[p.id] = {};
      TIME_SLOTS.forEach((slot) => {
        matrix[p.id][slot] = [];
      });
    });

    filteredItems.forEach((item, idx) => {
      try {
        const timePart = item.scheduledAt.slice(11, 16);
        const hour = timePart.split(":")[0];
        const slotKey = `${hour.padStart(2, "0")}:00`;

        let targetProfId = DEFAULT_PROFESSIONALS[idx % DEFAULT_PROFESSIONALS.length].id;
        if (item.professionalName) {
          const match = DEFAULT_PROFESSIONALS.find(
            (p) => p.name.toLowerCase() === item.professionalName?.toLowerCase()
          );
          if (match) targetProfId = match.id;
        }

        if (matrix[targetProfId] && matrix[targetProfId][slotKey]) {
          matrix[targetProfId][slotKey].push(item);
        } else if (matrix[targetProfId]) {
          matrix[targetProfId]["09:00"]?.push(item);
        }
      } catch {
        // Fallback
      }
    });

    return matrix;
  }, [filteredItems]);

  // Contadores de status do dia
  const statusCounts = useMemo(() => {
    const counts = {
      total: filteredItems.length,
      confirmado: 0,
      em_atendimento: 0,
      concluido: 0,
      pendente: 0,
    };
    filteredItems.forEach((it) => {
      if (it.status in counts) {
        counts[it.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [filteredItems]);

  // Próximos agendamentos
  const upcomingAppointments = useMemo(() => {
    return [...filteredItems]
      .filter((i) => i.status !== "concluido" && i.status !== "cancelado")
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 6);
  }, [filteredItems]);

  return (
    <div className="space-y-4">
      {/* Topo: Navegação, Seletor de Modo e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Agenda Visual de Banho & Tosa
              </h2>
              <Badge variant="outline" className="text-[10px] uppercase font-bold bg-muted/60 text-muted-foreground">
                PawsomeGroom
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span>{formattedHeaderDate}</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="font-semibold text-primary">{filteredItems.length} agendamentos no dia</span>
            </p>
          </div>
        </div>

        {/* Controles de Navegação e Botão Novo */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegador de Data */}
          <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border/60">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={handlePrevDay}
              title="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-bold px-2.5 rounded-lg"
              onClick={handleToday}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={handleNextDay}
              title="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Seletor Dia / Semana */}
          <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode("dia")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                viewMode === "dia"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setViewMode("semana")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                viewMode === "semana"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semana
            </button>
          </div>

          {onNewAppointment && (
            <Button
              size="sm"
              onClick={onNewAppointment}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Agendamento
            </Button>
          )}
        </div>
      </div>

      {/* Grid Principal: Timeline por Profissional + Sidebar Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Coluna da Timeline (3/4 da tela em desktop) */}
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          {/* Header dos Profissionais */}
          <div className="grid grid-cols-[64px_repeat(4,1fr)] border-b border-border bg-muted/30">
            <div className="p-3 text-center text-xs font-black text-muted-foreground border-r border-border flex items-center justify-center">
              <Clock className="h-4 w-4 text-muted-foreground/70" />
            </div>
            {DEFAULT_PROFESSIONALS.map((prof) => (
              <div
                key={prof.id}
                className="p-3 border-r border-border last:border-r-0 flex flex-col items-center text-center justify-center gap-1"
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full bg-linear-to-tr text-white text-xs font-black flex items-center justify-center shadow-xs",
                    prof.color
                  )}
                >
                  {prof.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-black text-foreground line-clamp-1 leading-tight">
                    {prof.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {prof.role}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Grade de Horários */}
          <div className="divide-y divide-border overflow-y-auto max-h-[640px]">
            {TIME_SLOTS.map((timeSlot) => (
              <div
                key={timeSlot}
                className="grid grid-cols-[64px_repeat(4,1fr)] min-h-[90px] group hover:bg-muted/10 transition-colors"
              >
                {/* Coluna da Hora */}
                <div className="p-2 border-r border-border text-[11px] font-extrabold text-muted-foreground text-center flex flex-col justify-start pt-3 bg-muted/10">
                  {timeSlot}
                </div>

                {/* Colunas por Profissional no Horário */}
                {DEFAULT_PROFESSIONALS.map((prof) => {
                  const slotItems = appointmentsBySlot[prof.id]?.[timeSlot] || [];
                  return (
                    <div
                      key={prof.id}
                      className="p-1.5 border-r border-border last:border-r-0 flex flex-col gap-1.5 relative transition-colors"
                    >
                      {slotItems.map((item) => {
                        const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.confirmado;
                        return (
                          <div
                            key={item.id}
                            onClick={() => onSelectAppointment?.(item)}
                            className={cn(
                              "rounded-xl p-2 border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between gap-1",
                              status.bg,
                              status.border
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {item.petPhotoUrl ? (
                                  <img
                                    src={item.petPhotoUrl}
                                    alt={item.petName}
                                    className="h-6 w-6 rounded-full object-cover shrink-0 border border-border"
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-black text-[10px] flex items-center justify-center shrink-0">
                                    {item.petName.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-foreground truncate">
                                    {item.petName}
                                  </p>
                                  {item.petBreed && (
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {item.petBreed}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full shrink-0 mt-1",
                                  status.dot
                                )}
                              />
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[10px] font-semibold pt-1 border-t border-border/30">
                              <span className="truncate text-foreground/80 font-medium">
                                {item.serviceName}
                              </span>
                              <span className={cn("px-1.5 py-0.2 rounded-md font-bold text-[9px]", status.text)}>
                                {status.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {slotItems.length === 0 && (
                        <div className="h-full w-full rounded-xl border border-dashed border-transparent hover:border-border/60 hover:bg-muted/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-muted-foreground/60 font-semibold">
                            Livre
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

        {/* Sidebar Direita: Status do Dia & Próximos Atendimentos */}
        <div className="space-y-4">
          {/* Card Resumo de Status */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Status do Dia</span>
              <span className="text-foreground font-black">{statusCounts.total} total</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Confirmados
                </p>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                  {statusCounts.confirmado}
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  Em Atendimento
                </p>
                <p className="text-lg font-black text-amber-800 dark:text-amber-200">
                  {statusCounts.em_atendimento}
                </p>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5">
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  Concluídos
                </p>
                <p className="text-lg font-black text-blue-800 dark:text-blue-200">
                  {statusCounts.concluido}
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-2.5">
                <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  Aguardando
                </p>
                <p className="text-lg font-black text-purple-800 dark:text-purple-200">
                  {statusCounts.pendente}
                </p>
              </div>
            </div>
          </div>

          {/* Próximos Atendimentos */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Próximos da Fila</span>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </h3>

            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Sem atendimentos pendentes no dia.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.map((app) => {
                  const time = app.scheduledAt.slice(11, 16);
                  return (
                    <div
                      key={app.id}
                      onClick={() => onSelectAppointment?.(app)}
                      className="rounded-xl border border-border/70 p-2.5 hover:bg-muted/40 transition-colors cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {time}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-foreground truncate">
                            {app.petName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {app.tutorName} • {app.serviceName}
                          </p>
                        </div>
                      </div>

                      {app.petId && onOpenPetRecord && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md shrink-0 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPetRecord(app.petId!);
                          }}
                          title="Abrir prontuário"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
