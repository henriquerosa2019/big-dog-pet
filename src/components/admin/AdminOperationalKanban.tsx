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
  ChevronRight,
  Layers,
  Send,
  DollarSign,
  CreditCard,
  QrCode,
  Stethoscope,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openInAppChat } from "@/components/InAppChatDrawer";
import {
  formatDateTime,
  formatBRL,
  capitalizeWords,
  digitsOnly,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTutorChatAlerts, replyToTutorFromStore } from "@/lib/inAppChat";

export type PaymentMethod = "credito" | "debito" | "pix" | "dinheiro";

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
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
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
  isPaid: boolean;
  paymentMethod?: string | null | undefined;
  paidAt?: string | null | undefined;
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
      const isPaid = item.paymentStatus === "pago";
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
        isPaid,
        paymentMethod: item.paymentMethod || null,
        paidAt: item.paidAt || null,
      });
    } else {
      existing.items.push(item);
      existing.totalCents += (item.totalCents || 0);
      if (hasTaxi) existing.hasTaxi = true;
      if (!existing.tutorPhone && item.tutorPhone) existing.tutorPhone = item.tutorPhone;
      if (!existing.petPhotoUrl && item.petPhotoUrl) existing.petPhotoUrl = item.petPhotoUrl;
      if (!existing.petBreed && item.petBreed) existing.petBreed = item.petBreed;
      if (item.paymentStatus === "pago") {
        if (!existing.paymentMethod && item.paymentMethod) existing.paymentMethod = item.paymentMethod;
        if (!existing.paidAt && item.paidAt) existing.paidAt = item.paidAt;
      }
    }
  }

  // Recalcular status de pagamento consolidado do grupo
  for (const group of map.values()) {
    group.isPaid = group.items.length > 0 && group.items.every((it) => it.paymentStatus === "pago");
    if (!group.paymentMethod) {
      const paidItem = group.items.find((it) => it.paymentStatus === "pago" && it.paymentMethod);
      if (paidItem) {
        group.paymentMethod = paidItem.paymentMethod;
        group.paidAt = paidItem.paidAt;
      }
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

export interface AdminOperationalKanbanProps {
  items: KanbanItem[];
  onAdvanceStatus?: ((item: KanbanItem) => void) | undefined;
  onAdvanceGroup?: ((group: KanbanPetGroup, paymentMethod?: PaymentMethod) => Promise<void> | void) | undefined;
  onRegisterPayment?: ((appointmentIds: string[], method: PaymentMethod) => Promise<void> | void) | undefined;
  onCancelAppointment?: ((appointmentId: string) => void) | undefined;
  onConfirmAppointment?: ((appointmentId: string) => void) | undefined;
  onOpenPetRecord?: ((petId: string) => void) | undefined;
  filterType?: ("todos" | "banho" | "delivery" | "vet") | undefined;
  onFilterTypeChange?: ((filter: "todos" | "banho" | "delivery" | "vet") => void) | undefined;
  hideTopFilterBar?: boolean | undefined;
}

export function AdminOperationalKanban({
  items,
  onAdvanceStatus,
  onAdvanceGroup,
  onRegisterPayment,
  onCancelAppointment,
  onConfirmAppointment,
  onOpenPetRecord,
  filterType: externalFilterType,
  onFilterTypeChange,
  hideTopFilterBar = false,
}: AdminOperationalKanbanProps) {
  // Filtro rápido de categoria (interno ou externo)
  const [internalFilterType, setInternalFilterType] = useState<"todos" | "banho" | "delivery" | "vet">("todos");
  const filterType = externalFilterType !== undefined ? externalFilterType : internalFilterType;
  const setFilterType = (newFilter: "todos" | "banho" | "delivery" | "vet") => {
    setInternalFilterType(newFilter);
    if (onFilterTypeChange) onFilterTypeChange(newFilter);
  };
  // Aba ativa para mobile (indicador e rolagem com snap)
  const [activeMobileStage, setActiveMobileStage] = useState<"aguardando" | "andamento" | "concluido">("aguardando");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Modal de Finalização de Atendimento com Recebimento de Pagamento
  const [checkoutGroup, setCheckoutGroup] = useState<KanbanPetGroup | null>(null);
  const [isFinishingPayment, setIsFinishingPayment] = useState(false);

  const handleFinishWithPayment = async (group: KanbanPetGroup, method?: PaymentMethod) => {
    setIsFinishingPayment(true);
    try {
      if (onAdvanceGroup) {
        await onAdvanceGroup(group, method);
      } else {
        if (method && onRegisterPayment) {
          await onRegisterPayment(group.items.map((it) => it.id), method);
        }
        if (onAdvanceStatus) {
          onAdvanceStatus(group.items[0]);
        }
      }
      setCheckoutGroup(null);
    } catch (err) {
      toast.error("Erro ao concluir atendimento com pagamento");
    } finally {
      setIsFinishingPayment(false);
    }
  };

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
      if (filterType === "banho") {
        const isBath = (item.serviceCategory && ["banho", "tosa"].includes(item.serviceCategory.toLowerCase())) ||
          /banho|tosa|estética|estetica/i.test(item.serviceName);
        if (!isBath) continue;
      }
      if (filterType === "vet") {
        const isVet = (item.serviceCategory && ["veterinario", "veterinaria", "clinica", "consulta", "vacina", "vet"].includes(item.serviceCategory.toLowerCase())) ||
          /vet|consulta|vacina|clínica|clinica|exame|retorno/i.test(item.serviceName);
        if (!isVet) continue;
      }

      const ops = item.opsStatus;
      const isConcluido =
        item.status === "concluido" ||
        ops === "entregue" ||
        ops === "pet_entregue" ||
        ops === "finalizado" ||
        ops === "servico_concluido" ||
        (ops === "concluido" && (!item.logisticsType || item.logisticsType === "levar"));

      const isAndamento =
        ops === "em_atendimento" ||
        ops === "em_deslocamento_retirada" ||
        ops === "pet_retirado" ||
        ops === "retirado_em_transito_loja" ||
        ops === "em_rota_devolucao" ||
        ops === "cheguei_retirada" ||
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

  const handleOpenChat = (item: KanbanItem, overrideConvId?: string) => {
    openInAppChat({
      conversationId: overrideConvId || item.userId,
      tutorId: item.userId,
      tutorName: item.tutorName,
      tutorPhone: item.tutorPhone,
      petId: item.petId,
      petName: item.petName,
      petSpecies: item.petSpecies,
      contextTag: item.serviceName,
    });
  };

  const handleWhatsApp = (item: KanbanItem) => {
    const msg = `Olá, ${item.tutorName}! Somos da Big Dog Pet. Estamos preparando o atendimento de ${item.petName} (${item.serviceName})!`;
    openInAppChat({
      conversationId: item.tutorId || item.id,
      tutorId: item.tutorId,
      tutorName: item.tutorName,
      tutorPhone: item.tutorPhone,
      petId: item.petId,
      petName: item.petName,
      petSpecies: item.petSpecies,
      contextTag: item.serviceName,
      defaultText: msg,
    });
  };

  const totalActiveItems = items.filter((i) => i.status !== "cancelado" && i.opsStatus !== "cancelado").length;

  return (
    <div className="space-y-3">
      {/* 1. Barra de Controles e Filtros Rápidos */}
      {!hideTopFilterBar ? (
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
            <Button
              size="sm"
              variant={filterType === "vet" ? "default" : "outline"}
              onClick={() => setFilterType("vet")}
              className="h-8 rounded-xl text-xs font-semibold px-3 gap-1"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              Veterinário
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
      ) : (
        /* Quando os filtros principais estão posicionados no topo acima das abas, no mobile mantemos o seletor rápido de coluna */
        <div className="flex md:hidden items-center gap-1 w-full p-1 bg-card rounded-2xl border border-border/60 shadow-xs">
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
      )}

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
                  onAdvanceGroup={onAdvanceGroup}
                  onRequestCheckout={(g) => setCheckoutGroup(g)}
                  onRegisterPayment={onRegisterPayment}
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
                  onAdvanceGroup={onAdvanceGroup}
                  onRequestCheckout={(g) => setCheckoutGroup(g)}
                  onRegisterPayment={onRegisterPayment}
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
                  onAdvanceGroup={onAdvanceGroup}
                  onRequestCheckout={(g) => setCheckoutGroup(g)}
                  onRegisterPayment={onRegisterPayment}
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

      {/* Modal de Finalização de Atendimento e Recebimento de Pagamento */}
      <Dialog open={Boolean(checkoutGroup)} onOpenChange={(open) => !open && setCheckoutGroup(null)}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-5 sm:p-6 bg-card border-border shadow-xl">
          <DialogHeader className="space-y-1.5 pb-2 border-b border-border/60">
            <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-foreground">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Finalizar Atendimento & Recebimento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Conclua o atendimento e registre a forma de pagamento recebida no caixa.
            </DialogDescription>
          </DialogHeader>

          {checkoutGroup && (
            <div className="space-y-4 py-2">
              {/* Resumo do Pet e Tutor */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
                <div className="relative h-12 w-12 shrink-0">
                  {checkoutGroup.petPhotoUrl ? (
                    <img
                      src={checkoutGroup.petPhotoUrl}
                      alt={checkoutGroup.petName}
                      className="h-12 w-12 rounded-full object-cover border-2 border-primary/30"
                    />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 border-2 border-primary/20 text-xl font-bold">
                      {checkoutGroup.petSpecies?.toLowerCase().includes("gato") ? "🐱" : "🐶"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-sm text-foreground truncate">
                      {capitalizeWords(checkoutGroup.petName)}
                    </span>
                    {checkoutGroup.petBreed && (
                      <span className="text-xs text-muted-foreground truncate">
                        ({capitalizeWords(checkoutGroup.petBreed)})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tutor: <strong className="text-foreground/90">{capitalizeWords(checkoutGroup.tutorName)}</strong>
                  </p>
                </div>
              </div>

              {/* Lista de Serviços e Valor Total */}
              <div className="rounded-xl border border-border/70 p-3 bg-card space-y-2">
                <div className="space-y-1 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Serviços Realizados:
                  </p>
                  {checkoutGroup.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-muted-foreground">
                      <span className="truncate">{it.serviceName}</span>
                      <span className="font-semibold text-foreground shrink-0 ml-2">
                        {it.totalCents ? formatBRL(it.totalCents) : "--"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between font-black text-sm">
                  <span className="text-foreground">Total a Receber:</span>
                  <span className="text-base sm:text-lg text-emerald-600 dark:text-emerald-400 font-display">
                    {formatBRL(checkoutGroup.totalCents)}
                  </span>
                </div>
              </div>

              {/* Se já estiver pago */}
              {checkoutGroup.isPaid ? (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Atendimento já consta como PAGO no Caixa</span>
                  </div>
                  {checkoutGroup.paymentMethod && (
                    <p className="text-[11px] text-emerald-600/90 font-medium">
                      Forma: {checkoutGroup.paymentMethod.toUpperCase()}
                      {checkoutGroup.paidAt ? ` às ${new Date(checkoutGroup.paidAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  )}
                  <Button
                    type="button"
                    disabled={isFinishingPayment}
                    onClick={async () => {
                      await handleFinishWithPayment(checkoutGroup);
                    }}
                    className="w-full h-10 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Concluir Atendimento Agora
                  </Button>
                </div>
              ) : (
                /* Seletor com os 4 Botões de 1 Toque */
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                    Selecione a forma de pagamento recebida no balcão:
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFinishingPayment}
                      onClick={async () => {
                        await handleFinishWithPayment(checkoutGroup, "credito");
                      }}
                      className="h-14 rounded-xl border-2 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30 flex flex-col items-center justify-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 transition-all cursor-pointer"
                    >
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                      <span className="text-xs">Cartão de Crédito</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFinishingPayment}
                      onClick={async () => {
                        await handleFinishWithPayment(checkoutGroup, "debito");
                      }}
                      className="h-14 rounded-xl border-2 border-sky-500/30 hover:border-sky-500 hover:bg-sky-500/10 dark:hover:bg-sky-950/30 flex flex-col items-center justify-center gap-1 font-bold text-sky-700 dark:text-sky-300 transition-all cursor-pointer"
                    >
                      <CreditCard className="h-5 w-5 text-sky-600" />
                      <span className="text-xs">Cartão de Débito</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFinishingPayment}
                      onClick={async () => {
                        await handleFinishWithPayment(checkoutGroup, "pix");
                      }}
                      className="h-14 rounded-xl border-2 border-teal-500/30 hover:border-teal-500 hover:bg-teal-500/10 dark:hover:bg-teal-950/30 flex flex-col items-center justify-center gap-1 font-bold text-teal-700 dark:text-teal-300 transition-all cursor-pointer"
                    >
                      <QrCode className="h-5 w-5 text-teal-600" />
                      <span className="text-xs">PIX</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFinishingPayment}
                      onClick={async () => {
                        await handleFinishWithPayment(checkoutGroup, "dinheiro");
                      }}
                      className="h-14 rounded-xl border-2 border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 dark:hover:bg-amber-950/30 flex flex-col items-center justify-center gap-1 font-bold text-amber-700 dark:text-amber-300 transition-all cursor-pointer"
                    >
                      <DollarSign className="h-5 w-5 text-amber-600" />
                      <span className="text-xs">Dinheiro</span>
                    </Button>
                  </div>

                  {/* Opção secundária: concluir sem registrar pagamento */}
                  <div className="pt-2 border-t border-border/40 text-center">
                    <button
                      type="button"
                      disabled={isFinishingPayment}
                      onClick={async () => {
                        await handleFinishWithPayment(checkoutGroup);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 cursor-pointer"
                    >
                      Concluir sem registrar pagamento agora (deixar pendente)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  onAdvanceGroup,
  onRequestCheckout,
  onRegisterPayment,
  onConfirm,
  onCancel,
  onOpenChat,
  onWhatsApp,
  onOpenPetRecord,
}: {
  group: KanbanPetGroup;
  stage: "aguardando" | "andamento" | "concluido";
  onAdvance?: ((item: KanbanItem) => void) | undefined;
  onAdvanceGroup?: ((group: KanbanPetGroup, paymentMethod?: PaymentMethod) => Promise<void> | void) | undefined;
  onRequestCheckout: (group: KanbanPetGroup) => void;
  onRegisterPayment?: ((appointmentIds: string[], method: PaymentMethod) => Promise<void> | void) | undefined;
  onConfirm?: ((id: string) => void) | undefined;
  onCancel?: ((id: string) => void) | undefined;
  onOpenChat: (item: KanbanItem, overrideConvId?: string) => void;
  onWhatsApp: (item: KanbanItem) => void;
  onOpenPetRecord?: ((petId: string) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const { checkUnread } = useTutorChatAlerts();
  const alertInfo = checkUnread({
    userId: group.userId,
    petId: group.petId,
    tutorName: group.tutorName,
    petName: group.petName,
  });

  const isMultiple = group.items.length > 1;
  const primaryItem = group.items[0];
  if (!primaryItem) return null;

  const handleSendInlineReply = () => {
    const text = inlineReplyText.trim();
    if (!text || isSendingReply) return;
    setIsSendingReply(true);
    try {
      replyToTutorFromStore({
        conversationId: alertInfo.conversationId || group.userId || "geral",
        tutorId: group.userId,
        tutorName: group.tutorName,
        petId: group.petId,
        petName: group.petName,
        petSpecies: group.petSpecies,
        contextTag: primaryItem.serviceName,
        text,
      });
      setInlineReplyText("");
      toast.success(`Resposta enviada para ${capitalizeWords(group.tutorName)}!`);
    } catch (e) {
      toast.error("Erro ao enviar resposta.");
    } finally {
      setIsSendingReply(false);
    }
  };

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
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-xs hover:shadow-sm transition-all space-y-2",
        alertInfo.hasUnread
          ? "border-rose-500/70 ring-2 ring-rose-400/30 dark:ring-rose-950/50"
          : "border-border/70"
      )}
    >
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

              {/* Badge Pulsante MSG Tutor */}
              {alertInfo.hasUnread && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat(primaryItem, alertInfo.conversationId);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-600 hover:bg-rose-700 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-xs animate-pulse cursor-pointer ring-2 ring-rose-400/50 transition-all shrink-0"
                  title="Mensagem nova do tutor! Clique para abrir no Chat ou responda abaixo"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span>MSG Tutor{alertInfo.unreadCount > 1 ? ` (${alertInfo.unreadCount})` : ""}</span>
                </button>
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
            <DropdownMenuItem onClick={() => onOpenChat(primaryItem, alertInfo.conversationId)} className="gap-2 cursor-pointer">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span>Abrir no Chat</span>
            </DropdownMenuItem>

            {group.tutorPhone && (
              <>
                <DropdownMenuItem onClick={() => onWhatsApp(primaryItem)} className="gap-2 cursor-pointer">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  <span>Chat ({group.tutorPhone})</span>
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

            <DropdownMenuItem
              onClick={() => onRequestCheckout(group)}
              className="gap-2 text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>{group.isPaid ? "Ver Pagamento no Caixa" : "Receber / Finalizar Pagamento"}</span>
            </DropdownMenuItem>

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

      {/* Alerta Destacado & Resposta Direta no Kanban quando há mensagem do Tutor */}
      {alertInfo.hasUnread && (
        <div className="rounded-xl bg-rose-50/90 dark:bg-rose-950/45 border-2 border-rose-500/50 p-2.5 space-y-2 shadow-xs transition-all animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-extrabold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
              </span>
              <MessageCircle className="h-3.5 w-3.5 text-rose-600" />
              <span>Mensagem do Tutor:</span>
            </span>
            <button
              type="button"
              onClick={() => onOpenChat(primaryItem, alertInfo.conversationId)}
              className="text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Abrir no Chat</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {alertInfo.lastMessage?.text && (
            <p className="text-xs text-foreground bg-card/95 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50 italic leading-relaxed shadow-2xs">
              "{alertInfo.lastMessage.text}"
            </p>
          )}

          {/* Campo de Resposta Direta no Próprio Kanban */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              type="text"
              value={inlineReplyText}
              onChange={(e) => setInlineReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendInlineReply();
                }
              }}
              placeholder="Responder ao tutor aqui no Kanban..."
              className="flex-1 h-8 rounded-lg border border-rose-300 dark:border-rose-800 bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
            <Button
              size="sm"
              type="button"
              onClick={handleSendInlineReply}
              disabled={!inlineReplyText.trim() || isSendingReply}
              className="h-8 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shrink-0 shadow-xs cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Enviar</span>
            </Button>
          </div>
        </div>
      )}

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
              Iniciar {isMultiple ? `(${primaryItem.serviceName})` : "Atendimento"}
            </Button>
          )
        )}

        {stage === "andamento" && (
          <Button
            size="sm"
            onClick={() => onRequestCheckout(group)}
            className="w-full h-8 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Concluir {isMultiple ? `(${group.items.length} Serviços)` : "Atendimento"}
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
              onClick={() => onOpenChat(primaryItem, alertInfo.conversationId)}
              className="h-7 px-2.5 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 gap-1"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              💬 Avisar
            </Button>
          </div>
        )}
      </div>

      {/* Informações e Recebimento de Pagamento no Balcão */}
      {(stage === "andamento" || stage === "concluido") && (
        group.isPaid ? (
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ✓ Pago via {group.paymentMethod?.toUpperCase() || "CAIXA"}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">
              {group.paidAt
                ? new Date(group.paidAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                : "Confirmado"}
            </span>
          </div>
        ) : group.totalCents > 0 ? (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold flex items-center gap-1 text-foreground">
                <DollarSign className="h-3 w-3 text-emerald-600" />
                Receber no Caixa:
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatBRL(group.totalCents)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRegisterPayment?.(group.items.map((i) => i.id), "credito")}
                className="h-6 rounded-md text-[9px] font-bold px-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
              >
                <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                Crédito
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRegisterPayment?.(group.items.map((i) => i.id), "debito")}
                className="h-6 rounded-md text-[9px] font-bold px-1 border-sky-500/30 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
              >
                <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                Débito
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRegisterPayment?.(group.items.map((i) => i.id), "pix")}
                className="h-6 rounded-md text-[9px] font-bold px-1 border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 cursor-pointer"
              >
                <QrCode className="h-2.5 w-2.5 mr-0.5" />
                Pix
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRegisterPayment?.(group.items.map((i) => i.id), "dinheiro")}
                className="h-6 rounded-md text-[9px] font-bold px-1 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
              >
                <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                Dinheiro
              </Button>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
