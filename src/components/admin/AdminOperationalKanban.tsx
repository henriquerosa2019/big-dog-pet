import { useState, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  Play,
  Truck,
  MessageCircle,
  MoreVertical,
  Phone,
  Calendar,
  User,
  Scissors,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openInAppChat } from "@/components/InAppChatDrawer";
import {
  formatDateTime,
  formatBRL,
  capitalizeWords,
  whatsappLinkTo,
  digitsOnly,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export interface KanbanItem {
  id: string;
  userId: string;
  tutorName: string;
  tutorPhone?: string | null;
  petId?: string | null;
  petName: string;
  petSpecies?: string | null;
  serviceName: string;
  serviceCategory?: string | null;
  scheduledAt: string;
  status: string; // pendente, confirmado, concluido, cancelado
  opsStatus?: string | null; // agendado, motorista_designado, em_deslocamento_retirada, cheguei_retirada, retirado_em_transito_loja, em_atendimento, pronto_para_devolucao, em_rota_devolucao, entregue, cancelado
  logisticsType?: string | null; // leva_e_traz, leva, traz, levar
  totalCents?: number;
  transportOrderId?: string | null;
  addressSummary?: string | null;
}

interface AdminOperationalKanbanProps {
  items: KanbanItem[];
  onAdvanceStatus?: ((item: KanbanItem) => void) | undefined;
  onCancelAppointment?: ((appointmentId: string) => void) | undefined;
  onConfirmAppointment?: ((appointmentId: string) => void) | undefined;
  onOpenPetRecord?: ((petId: string) => void) | undefined;
}

export function AdminOperationalKanban({
  items,
  onAdvanceStatus,
  onCancelAppointment,
  onConfirmAppointment,
  onOpenPetRecord,
}: AdminOperationalKanbanProps) {
  // Filtro rápido de categoria
  const [filterType, setFilterType] = useState<"todos" | "banho" | "delivery">("todos");
  // Aba ativa para mobile
  const [activeMobileStage, setActiveMobileStage] = useState<"aguardando" | "andamento" | "concluido">("aguardando");

  // Classifica os itens em 3 etapas operacionais
  const stages = useMemo(() => {
    const aguardando: KanbanItem[] = [];
    const andamento: KanbanItem[] = [];
    const concluido: KanbanItem[] = [];

    for (const item of items) {
      if (item.status === "cancelado" || item.opsStatus === "cancelado") continue;

      // Filtro por tipo
      if (filterType === "delivery" && (!item.logisticsType || item.logisticsType === "levar")) {
        continue;
      }
      if (filterType === "banho" && item.serviceCategory && !["banho", "tosa"].includes(item.serviceCategory)) {
        continue;
      }

      const ops = item.opsStatus;
      const isConcluido =
        item.status === "concluido" ||
        ops === "entregue" ||
        (ops === "concluido" && (!item.logisticsType || item.logisticsType === "levar"));

      const isAndamento =
        ops === "em_atendimento" ||
        ops === "retirado_em_transito_loja" ||
        ops === "em_rota_devolucao" ||
        ops === "cheguei_retirada" ||
        ops === "em_deslocamento_retirada" ||
        ops === "pronto_para_devolucao";

      if (isConcluido) {
        concluido.push(item);
      } else if (isAndamento) {
        andamento.push(item);
      } else {
        aguardando.push(item);
      }
    }

    // Ordenação por horário
    const sortFn = (a: KanbanItem, b: KanbanItem) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();

    return {
      aguardando: aguardando.sort(sortFn),
      andamento: andamento.sort(sortFn),
      concluido: concluido.sort(sortFn),
    };
  }, [items, filterType]);

  const handleOpenChat = (item: KanbanItem) => {
    openInAppChat({
      tutorName: item.tutorName,
      petName: item.petName,
      contextTag: item.serviceName,
    });
  };

  const handleWhatsApp = (item: KanbanItem) => {
    if (!item.tutorPhone) return;
    const phone = digitsOnly(item.tutorPhone);
    const msg = `Olá, ${item.tutorName}! Somos da Big Dog Pet. Estamos preparando o atendimento de ${item.petName} (${item.serviceName})!`;
    const link = whatsappLinkTo(phone, msg);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      {/* 1. Barra de Controles e Filtros Rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={filterType === "todos" ? "default" : "outline"}
            onClick={() => setFilterType("todos")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Todos ({items.filter(i => i.status !== "cancelado").length})
          </Button>
          <Button
            size="sm"
            variant={filterType === "banho" ? "default" : "outline"}
            onClick={() => setFilterType("banho")}
            className="h-8 rounded-xl text-xs font-semibold px-3 gap-1"
          >
            <Scissors className="h-3.5 w-3.5" />
            Banho & Tosa
          </Button>
          <Button
            size="sm"
            variant={filterType === "delivery" ? "default" : "outline"}
            onClick={() => setFilterType("delivery")}
            className="h-8 rounded-xl text-xs font-semibold px-3 gap-1"
          >
            <Truck className="h-3.5 w-3.5" />
            Táxi Pet
          </Button>
        </div>

        {/* Alternador Mobile de Etapa */}
        <div className="flex md:hidden items-center gap-1 w-full pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setActiveMobileStage("aguardando")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-center transition-all",
              activeMobileStage === "aguardando"
                ? "bg-amber-500/15 text-amber-950 dark:text-amber-300 ring-1 ring-amber-500/40"
                : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            Aguardando ({stages.aguardando.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileStage("andamento")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-center transition-all",
              activeMobileStage === "andamento"
                ? "bg-violet-500/15 text-violet-950 dark:text-violet-300 ring-1 ring-violet-500/40"
                : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            Andamento ({stages.andamento.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileStage("concluido")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-center transition-all",
              activeMobileStage === "concluido"
                ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500/40"
                : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            Pronto ({stages.concluido.length})
          </button>
        </div>
      </div>

      {/* 2. Colunas do Kanban (Grid no Desktop / Abas no Mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
        {/* COLUNA 1: AGUARDANDO */}
        <div
          className={cn(
            "rounded-2xl border border-border/70 bg-card p-3 space-y-2.5 shadow-xs transition-all",
            "md:block",
            activeMobileStage === "aguardando" ? "block" : "hidden md:block"
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Aguardando Início
              </h3>
            </div>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-900 dark:text-amber-300 font-bold text-[10px]">
              {stages.aguardando.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {stages.aguardando.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                Nenhum pet aguardando no momento.
              </div>
            ) : (
              stages.aguardando.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  stage="aguardando"
                  onAdvance={onAdvanceStatus}
                  onConfirm={onConfirmAppointment}
                  onCancel={onCancelAppointment}
                  onOpenChat={handleOpenChat}
                  onWhatsApp={handleWhatsApp}
                  onOpenPetRecord={onOpenPetRecord}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 2: EM ANDAMENTO */}
        <div
          className={cn(
            "rounded-2xl border border-border/70 bg-card p-3 space-y-2.5 shadow-xs transition-all",
            "md:block",
            activeMobileStage === "andamento" ? "block" : "hidden md:block"
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
              </span>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Em Andamento / Rota
              </h3>
            </div>
            <Badge variant="secondary" className="bg-violet-500/10 text-violet-900 dark:text-violet-300 font-bold text-[10px]">
              {stages.andamento.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {stages.andamento.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                Nenhum atendimento em andamento no momento.
              </div>
            ) : (
              stages.andamento.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  stage="andamento"
                  onAdvance={onAdvanceStatus}
                  onConfirm={onConfirmAppointment}
                  onCancel={onCancelAppointment}
                  onOpenChat={handleOpenChat}
                  onWhatsApp={handleWhatsApp}
                  onOpenPetRecord={onOpenPetRecord}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUNA 3: PRONTO / CONCLUÍDO */}
        <div
          className={cn(
            "rounded-2xl border border-border/70 bg-card p-3 space-y-2.5 shadow-xs transition-all",
            "md:block",
            activeMobileStage === "concluido" ? "block" : "hidden md:block"
          )}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                Pronto / Concluído
              </h3>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-bold text-[10px]">
              {stages.concluido.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {stages.concluido.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                Nenhum serviço finalizado hoje ainda.
              </div>
            ) : (
              stages.concluido.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  stage="concluido"
                  onAdvance={onAdvanceStatus}
                  onConfirm={onConfirmAppointment}
                  onCancel={onCancelAppointment}
                  onOpenChat={handleOpenChat}
                  onWhatsApp={handleWhatsApp}
                  onOpenPetRecord={onOpenPetRecord}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card Individual do Kanban Operacional com Ação Primária e Menu ⋮ */
function KanbanCard({
  item,
  stage,
  onAdvance,
  onConfirm,
  onCancel,
  onOpenChat,
  onWhatsApp,
  onOpenPetRecord,
}: {
  item: KanbanItem;
  stage: "aguardando" | "andamento" | "concluido";
  onAdvance?: ((item: KanbanItem) => void) | undefined;
  onConfirm?: ((id: string) => void) | undefined;
  onCancel?: ((id: string) => void) | undefined;
  onOpenChat: (item: KanbanItem) => void;
  onWhatsApp: (item: KanbanItem) => void;
  onOpenPetRecord?: ((petId: string) => void) | undefined;
}) {
  const isPendente = item.status === "pendente";
  const hasTaxi = item.logisticsType && item.logisticsType !== "levar";

  // Emoji inteligente por espécie
  const isCat = item.petSpecies?.toLowerCase().includes("gato") || item.petSpecies?.toLowerCase().includes("felin");
  const petEmoji = isCat ? "🐱" : "🐶";

  const timeDisplay = useMemo(() => {
    try {
      const d = new Date(item.scheduledAt);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "--:--";
    }
  }, [item.scheduledAt]);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs hover:shadow-sm transition-all space-y-2">
      {/* Linha 1: Horário, Nome do Pet e Menu ⋮ */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display font-extrabold text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">
              {timeDisplay}
            </span>
            <span className="font-bold text-xs text-foreground truncate">
              {petEmoji} {capitalizeWords(item.petName)}
            </span>
            {hasTaxi && (
              <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold border-sky-500/40 text-sky-600 dark:text-sky-400">
                Táxi Pet 🚗
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {capitalizeWords(item.tutorName)} {item.tutorPhone ? `· ${item.tutorPhone}` : ""}
          </p>
        </div>

        {/* Menu de Ações Secundárias (⋮) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            <DropdownMenuItem onClick={() => onOpenChat(item)} className="gap-2 cursor-pointer">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span>Abrir no Chat</span>
            </DropdownMenuItem>

            {item.tutorPhone && (
              <>
                <DropdownMenuItem onClick={() => onWhatsApp(item)} className="gap-2 cursor-pointer">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Chamar no WhatsApp</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(`tel:${digitsOnly(item.tutorPhone!)}`)}
                  className="gap-2 cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Ligar para Tutor</span>
                </DropdownMenuItem>
              </>
            )}

            {item.petId && onOpenPetRecord && (
              <DropdownMenuItem onClick={() => onOpenPetRecord(item.petId!)} className="gap-2 cursor-pointer">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Ver Ficha do Pet</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {onCancel && (
              <DropdownMenuItem
                onClick={() => onCancel(item.id)}
                className="gap-2 text-rose-600 dark:text-rose-400 cursor-pointer"
              >
                <span>Cancelar Agendamento</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Linha 2: Serviço e Detalhe */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg">
        <span className="font-medium truncate">{item.serviceName}</span>
        {item.totalCents && item.totalCents > 0 && (
          <span className="font-semibold text-foreground/80 shrink-0 ml-1">
            {formatBRL(item.totalCents)}
          </span>
        )}
      </div>

      {/* Linha 3: Ação Primária Direta em 1 Toque */}
      <div className="pt-1">
        {stage === "aguardando" && (
          isPendente && onConfirm ? (
            <Button
              size="sm"
              onClick={() => onConfirm(item.id)}
              className="w-full h-7 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-amber-950 gap-1 shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirmar Agendamento
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAdvance?.(item)}
              className="w-full h-7 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1 shadow-xs"
            >
              <Play className="h-3 w-3" />
              Iniciar Atendimento
            </Button>
          )
        )}

        {stage === "andamento" && (
          <Button
            size="sm"
            onClick={() => onAdvance?.(item)}
            className="w-full h-7 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white gap-1 shadow-xs"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluir Atendimento
          </Button>
        )}

        {stage === "concluido" && (
          <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold px-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Pronto / Concluído
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChat(item)}
              className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
            >
              Avisar Tutor
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
