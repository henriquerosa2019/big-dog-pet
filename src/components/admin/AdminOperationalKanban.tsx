import { useState, useMemo, useRef } from "react";
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
  Layers,
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
  petPhotoUrl?: string | null;
  petBreed?: string | null;
  serviceName: string;
  serviceCategory?: string | null;
  scheduledAt: string;
  status: string; // pendente, confirmado, concluido, cancelado
  opsStatus?: string | null;
  logisticsType?: string | null; // leva_e_traz, leva, traz, levar
  totalCents?: number;
  transportOrderId?: string | null;
  addressSummary?: string | null;
}

export interface KanbanPetGroup {
  groupKey: string;
  petId?: string | null | undefined;
  petName: string;
  petSpecies?: string | null | undefined;
  petPhotoUrl?: string | null | undefined;
  petBreed?: string | null | undefined;
  tutorName: string;
  tutorPhone?: string | null | undefined;
  userId: string;
  hasTaxi: boolean;
  totalCents: number;
  items: KanbanItem[];
}

function groupItemsByPet(items: KanbanItem[]): KanbanPetGroup[] {
  const map = new Map<string, KanbanPetGroup>();

  for (const item of items) {
    const petKey = (item.petId ? `p-${item.petId}` : `pn-${item.petName.toLowerCase().trim()}`);
    const userKey = (item.userId ? `u-${item.userId}` : `un-${item.tutorName.toLowerCase().trim()}`);
    const key = `${petKey}_${userKey}`;

    const existing = map.get(key);
    const hasTaxi = Boolean(item.logisticsType && item.logisticsType !== "levar");

    if (!existing) {
      map.set(key, {
        groupKey: key,
        petId: item.petId,
        petName: item.petName,
        petSpecies: item.petSpecies,
        petPhotoUrl: item.petPhotoUrl || null,
        petBreed: item.petBreed || null,
        tutorName: item.tutorName,
        tutorPhone: item.tutorPhone,
        userId: item.userId,
        hasTaxi,
        totalCents: item.totalCents || 0,
        items: [item],
      });
    } else {
      existing.items.push(item);
      existing.totalCents += (item.totalCents || 0);
      if (hasTaxi) existing.hasTaxi = true;
      if (!existing.tutorPhone && item.tutorPhone) existing.tutorPhone = item.tutorPhone;
      if (!existing.petPhotoUrl && item.petPhotoUrl) existing.petPhotoUrl = item.petPhotoUrl;
      if (!existing.petBreed && item.petBreed) existing.petBreed = item.petBreed;
    }
  }

  // Ordena itens de cada grupo por horário e ordena os grupos pelo primeiro serviço
  return Array.from(map.values())
    .map((g) => {
      g.items.sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
      return g;
    })
    .sort((a, b) => {
      const timeA = new Date(a.items[0]?.scheduledAt || 0).getTime();
      const timeB = new Date(b.items[0]?.scheduledAt || 0).getTime();
      return timeA - timeB;
    });
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
  // Aba ativa para mobile (indicador e rolagem com snap)
  const [activeMobileStage, setActiveMobileStage] = useState<"aguardando" | "andamento" | "concluido">("aguardando");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Classifica os itens em 3 etapas operacionais e agrupa por Pet/Tutor
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

    return {
      aguardandoRaw: aguardando,
      andamentoRaw: andamento,
      concluidoRaw: concluido,
      aguardando: groupItemsByPet(aguardando),
      andamento: groupItemsByPet(andamento),
      concluido: groupItemsByPet(concluido),
    };
  }, [items, filterType]);

  const scrollToStage = (stage: "aguardando" | "andamento" | "concluido") => {
    setActiveMobileStage(stage);
    if (!scrollContainerRef.current) return;
    const colIndex = stage === "aguardando" ? 0 : stage === "andamento" ? 1 : 2;
    const targetWidth = scrollContainerRef.current.clientWidth;
    scrollContainerRef.current.scrollTo({
      left: colIndex * (targetWidth * 0.82),
      behavior: "smooth",
    });
  };

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

  const totalActiveItems = items.filter((i) => i.status !== "cancelado" && i.opsStatus !== "cancelado").length;

  return (
    <div className="space-y-3">
      {/* 1. Barra de Controles e Filtros Rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={filterType === "todos" ? "default" : "outline"}
            onClick={() => setFilterType("todos")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Todos ({totalActiveItems})
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

        {/* Pílulas de Navegação Rápida no Mobile */}
        <div className="flex md:hidden items-center gap-1 w-full pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => scrollToStage("aguardando")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-center transition-all",
              activeMobileStage === "aguardando"
                ? "bg-amber-500/15 text-amber-950 dark:text-amber-300 ring-1 ring-amber-500/40"
                : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            Aguardando ({stages.aguardandoRaw.length})
          </button>
          <button
            type="button"
            onClick={() => scrollToStage("andamento")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-center transition-all",
              activeMobileStage === "andamento"
                ? "bg-sky-500/15 text-sky-950 dark:text-sky-300 ring-1 ring-sky-500/40"
                : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            Andamento ({stages.andamentoRaw.length})
          </button>
          <button
            type="button"
            onClick={() => scrollToStage("concluido")}
            className={cn(
              "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold text-center transition-all",
              activeMobileStage === "concluido"
                ? "bg-emerald-500/15 text-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500/40"
                : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            Pronto ({stages.concluidoRaw.length})
          </button>
        </div>
      </div>

      {/* 2. Colunas do Kanban (3 Colunas no Desktop / Swipe Horizontal Touch com Snap no Celular) */}
      <div
        ref={scrollContainerRef}
        className="flex md:grid md:grid-cols-3 gap-3.5 items-start overflow-x-auto snap-x snap-mandatory pb-3 pt-1 scroll-smooth"
      >
        {/* COLUNA 1: AGUARDANDO (LARANJA / ÂMBAR) */}
        <div className="w-[86vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none rounded-2xl border border-amber-500/30 bg-card p-3 space-y-2.5 shadow-xs transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30">
                <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                Aguardando Início
              </span>
            </div>
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 font-bold text-[10px]">
              {stages.aguardandoRaw.length} {stages.aguardando.length !== stages.aguardandoRaw.length ? `(${stages.aguardando.length} pets)` : ""}
            </Badge>
          </div>

          <div className="space-y-2.5">
            {stages.aguardando.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-amber-500/30 text-center text-xs text-muted-foreground">
                Nenhum pet aguardando no momento.
              </div>
            ) : (
              stages.aguardando.map((group) => (
                <KanbanGroupCard
                  key={group.groupKey}
                  group={group}
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

        {/* COLUNA 2: EM ANDAMENTO (AZUL) */}
        <div className="w-[86vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none rounded-2xl border border-sky-500/30 bg-card p-3 space-y-2.5 shadow-xs transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-sky-500/20">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/15 text-sky-900 dark:text-sky-300 border border-sky-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                Em Andamento / Rota
              </span>
            </div>
            <Badge variant="secondary" className="bg-sky-500/15 text-sky-900 dark:text-sky-300 border border-sky-500/30 font-bold text-[10px]">
              {stages.andamentoRaw.length} {stages.andamento.length !== stages.andamentoRaw.length ? `(${stages.andamento.length} pets)` : ""}
            </Badge>
          </div>

          <div className="space-y-2.5">
            {stages.andamento.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-sky-500/30 text-center text-xs text-muted-foreground">
                Nenhum atendimento em andamento no momento.
              </div>
            ) : (
              stages.andamento.map((group) => (
                <KanbanGroupCard
                  key={group.groupKey}
                  group={group}
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

        {/* COLUNA 3: PRONTO / CONCLUÍDO (VERDE) */}
        <div className="w-[86vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none rounded-2xl border border-emerald-500/30 bg-card p-3 space-y-2.5 shadow-xs transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Pronto / Concluído
              </span>
            </div>
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
              {stages.concluidoRaw.length} {stages.concluido.length !== stages.concluidoRaw.length ? `(${stages.concluido.length} pets)` : ""}
            </Badge>
          </div>

          <div className="space-y-2.5">
            {stages.concluido.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-emerald-500/30 text-center text-xs text-muted-foreground">
                Nenhum serviço finalizado hoje ainda.
              </div>
            ) : (
              stages.concluido.map((group) => (
                <KanbanGroupCard
                  key={group.groupKey}
                  group={group}
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

/**
 * Card Consolidado do Kanban
 * - Agrupa múltiplos serviços do mesmo pet em um único card elegante com timeline/sequência.
 * - Renderiza como card simples e limpo quando há apenas 1 serviço.
 */
function KanbanGroupCard({
  group,
  stage,
  onAdvance,
  onConfirm,
  onCancel,
  onOpenChat,
  onWhatsApp,
  onOpenPetRecord,
}: {
  group: KanbanPetGroup;
  stage: "aguardando" | "andamento" | "concluido";
  onAdvance?: ((item: KanbanItem) => void) | undefined;
  onConfirm?: ((id: string) => void) | undefined;
  onCancel?: ((id: string) => void) | undefined;
  onOpenChat: (item: KanbanItem) => void;
  onWhatsApp: (item: KanbanItem) => void;
  onOpenPetRecord?: ((petId: string) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMultiple = group.items.length > 1;
  const primaryItem = group.items[0];
  if (!primaryItem) return null;

  // Emoji inteligente por espécie
  const isCat =
    group.petSpecies?.toLowerCase().includes("gato") ||
    group.petSpecies?.toLowerCase().includes("felin");
  const petEmoji = isCat ? "🐱" : "🐶";

  const firstTime = useMemo(() => {
    try {
      return new Date(primaryItem.scheduledAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "--:--";
    }
  }, [primaryItem.scheduledAt]);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs hover:shadow-sm transition-all space-y-2">
      {/* Linha 1: Foto/Avatar do Pet (40x40px), Horário, Nome do Pet, Raça, Badges e Menu ⋮ */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Avatar com foto real do pet (40x40px) */}
          <div className="relative h-10 w-10 shrink-0">
            {group.petPhotoUrl ? (
              <img
                src={group.petPhotoUrl}
                alt={group.petName}
                className="h-10 w-10 rounded-full object-cover border-2 border-primary/25 shadow-xs"
                loading="lazy"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 border-2 border-primary/20 text-base font-bold shadow-xs">
                {petEmoji}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display font-extrabold text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">
                {firstTime}
              </span>
              <span className="font-bold text-xs text-foreground truncate">
                {capitalizeWords(group.petName)}
              </span>
              {group.petBreed && (
                <span className="text-[10px] text-muted-foreground font-medium truncate">
                  ({capitalizeWords(group.petBreed)})
                </span>
              )}
              {group.hasTaxi && (
                <Badge
                  variant="outline"
                  className="text-[9px] py-0 px-1 font-semibold border-sky-500/40 text-sky-600 dark:text-sky-400"
                >
                  Táxi 🚗
                </Badge>
              )}
              {isMultiple && (
                <Badge
                  className="text-[9px] py-0 px-1.5 font-bold bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/30"
                >
                  {group.items.length} serviços
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Tutor: <span className="font-semibold text-foreground/85">{capitalizeWords(group.tutorName)}</span>
            </p>
          </div>
        </div>

        {/* Menu de Ações Secundárias (⋮) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 text-xs">
            <DropdownMenuItem onClick={() => onOpenChat(primaryItem)} className="gap-2 cursor-pointer">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span>Abrir no Chat</span>
            </DropdownMenuItem>

            {group.tutorPhone && (
              <>
                <DropdownMenuItem onClick={() => onWhatsApp(primaryItem)} className="gap-2 cursor-pointer">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>WhatsApp ({group.tutorPhone})</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(`tel:${digitsOnly(group.tutorPhone!)}`)}
                  className="gap-2 cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Ligar ({group.tutorPhone})</span>
                </DropdownMenuItem>
              </>
            )}

            {group.petId && onOpenPetRecord && (
              <DropdownMenuItem
                onClick={() => onOpenPetRecord(group.petId!)}
                className="gap-2 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Ver Prontuário do Pet</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {onCancel && (
              <DropdownMenuItem
                onClick={() => onCancel(primaryItem.id)}
                className="gap-2 text-rose-600 dark:text-rose-400 cursor-pointer"
              >
                <span>Cancelar Agendamento</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Linha 2: Serviços (Único ou Indentado Compacto para Multi-serviços) */}
      {!isMultiple ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg border border-border/40">
          <span className="font-medium truncate text-foreground/90">{primaryItem.serviceName}</span>
          {group.totalCents > 0 && (
            <span className="font-bold text-foreground shrink-0 ml-1 text-[11px]">
              {formatBRL(group.totalCents)}
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-1 pl-2.5 border-l-2 border-primary/40 my-1 py-0.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground tracking-wider pb-0.5">
            <span className="flex items-center gap-1">
              <Layers className="h-2.5 w-2.5 text-primary" />
              {group.items.length} Serviços Agendados
            </span>
            {group.totalCents > 0 && (
              <span className="font-extrabold text-foreground">
                Total: {formatBRL(group.totalCents)}
              </span>
            )}
          </div>
          {group.items.map((item) => {
            let itemTime = "";
            try {
              itemTime = new Date(item.scheduledAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
            } catch {
              itemTime = "";
            }
            return (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs py-0.5 group/item"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.2 rounded shrink-0">
                    {itemTime}
                  </span>
                  <span className="font-medium truncate text-foreground text-[11px]">
                    {item.serviceName}
                  </span>
                </div>
                {item.totalCents && item.totalCents > 0 ? (
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0 ml-1">
                    {formatBRL(item.totalCents)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Linha 3: Botões Compactos de Ação Operacional com Ícones Nítidos */}
      <div className="pt-0.5">
        {stage === "aguardando" && (
          primaryItem.status === "pendente" && onConfirm ? (
            <Button
              size="sm"
              onClick={() => onConfirm(primaryItem.id)}
              className="w-full h-8 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-amber-950 gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              ✓ Confirmar {isMultiple ? `(${group.items.length})` : ""}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAdvance?.(primaryItem)}
              className="w-full h-8 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              ▶ Iniciar {isMultiple ? `(${primaryItem.serviceName})` : "Atendimento"}
            </Button>
          )
        )}

        {stage === "andamento" && (
          <Button
            size="sm"
            onClick={() => onAdvance?.(primaryItem)}
            className="w-full h-8 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            ✓ Concluir {isMultiple ? `(${primaryItem.serviceName})` : "Atendimento"}
          </Button>
        )}

        {stage === "concluido" && (
          <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-bold px-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {isMultiple ? `${group.items.length} Concluídos` : "Pronto / Concluído"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChat(primaryItem)}
              className="h-7 px-2.5 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 gap-1"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              💬 Avisar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
