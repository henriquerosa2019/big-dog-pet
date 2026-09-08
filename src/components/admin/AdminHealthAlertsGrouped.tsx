import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Syringe,
  Clock,
  User,
  Phone,
  MessageCircle,
  MoreVertical,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { openInAppChat } from "@/components/InAppChatDrawer";
import {
  formatDate,
  daysUntil,
  capitalizeWords,
  whatsappLinkTo,
  digitsOnly,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export interface HealthAlertItem {
  id: string;
  type: "vacina" | "retorno";
  title: string;
  dueDate: string;
  petId?: string | null | undefined;
  petName: string;
  petSpecies?: string | null | undefined;
  ownerId?: string | null | undefined;
  ownerName?: string | null | undefined;
  ownerPhone?: string | null | undefined;
  reminderId?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface PetHealthGroup {
  petId: string;
  petName: string;
  petSpecies?: string | null | undefined;
  ownerId?: string | null | undefined;
  ownerName: string;
  ownerPhone?: string | null | undefined;
  alerts: HealthAlertItem[];
  urgentCount: number;
  thisWeekCount: number;
  futureCount: number;
  minDueDate: string;
}

interface AdminHealthAlertsGroupedProps {
  alerts: HealthAlertItem[];
  onCompleteReminder?: ((reminderId: string) => void) | undefined;
  onOpenPetRecord?: ((petId: string) => void) | undefined;
}

export function AdminHealthAlertsGrouped({
  alerts,
  onCompleteReminder,
  onOpenPetRecord,
}: AdminHealthAlertsGroupedProps) {
  const [filterPeriod, setFilterPeriod] = useState<"urgente" | "semana" | "todos">("urgente");
  const [showDrawerModal, setShowDrawerModal] = useState(false);

  // Agrupa alertas por Pet
  const petGroups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const map = new Map<string, HealthAlertItem[]>();

    for (const item of alerts) {
      const key = item.petId || `${item.petName}-${item.ownerId || "anon"}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }

    const groups: PetHealthGroup[] = [];

    for (const [key, alertList] of map.entries()) {
      if (!alertList || alertList.length === 0) continue;
      const first = alertList[0];
      if (!first) continue;

      let urgentCount = 0;
      let thisWeekCount = 0;
      let futureCount = 0;
      let minDueDate = first.dueDate;

      for (const a of alertList) {
        if (a.dueDate < minDueDate) minDueDate = a.dueDate;
        if (a.dueDate <= today) {
          urgentCount++;
        } else if (a.dueDate <= in7Days) {
          thisWeekCount++;
        } else {
          futureCount++;
        }
      }

      // Ordena alertas do pet (mais atrasados primeiro)
      alertList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      groups.push({
        petId: first.petId || key,
        petName: first.petName,
        petSpecies: first.petSpecies,
        ownerId: first.ownerId,
        ownerName: first.ownerName || "Tutor",
        ownerPhone: first.ownerPhone,
        alerts: alertList,
        urgentCount,
        thisWeekCount,
        futureCount,
        minDueDate,
      });
    }

    // Ordenação de grupos:
    // 1. Quem tem alertas urgentes/atrasados no topo
    // 2. Data de vencimento mais antiga
    return groups.sort((a, b) => {
      if (a.urgentCount > 0 && b.urgentCount === 0) return -1;
      if (a.urgentCount === 0 && b.urgentCount > 0) return 1;
      return a.minDueDate.localeCompare(b.minDueDate);
    });
  }, [alerts]);

  // Grupos filtrados pelo período selecionado na tela principal
  const filteredGroups = useMemo(() => {
    if (filterPeriod === "urgente") {
      return petGroups.filter((g) => g.urgentCount > 0);
    }
    if (filterPeriod === "semana") {
      return petGroups.filter((g) => g.urgentCount > 0 || g.thisWeekCount > 0);
    }
    return petGroups;
  }, [petGroups, filterPeriod]);

  // Contadores rápidos para as abas
  const totalUrgentes = petGroups.filter((g) => g.urgentCount > 0).length;
  const totalSemana = petGroups.filter((g) => g.thisWeekCount > 0 && g.urgentCount === 0).length;
  const totalFuturos = petGroups.filter((g) => g.futureCount > 0 && g.urgentCount === 0 && g.thisWeekCount === 0).length;

  const handleOpenChat = (group: PetHealthGroup) => {
    const alertNames = group.alerts.map((a) => a.title).join(", ");
    openInAppChat({
      tutorName: group.ownerName,
      petName: group.petName,
      contextTag: `Aviso: ${alertNames}`,
    });
  };

  const handleWhatsApp = (group: PetHealthGroup) => {
    if (!group.ownerPhone) return;
    const phone = digitsOnly(group.ownerPhone);
    const alertNames = group.alerts.map((a) => `• ${a.title}`).join("\n");
    const msg = `Olá, ${group.ownerName}! Aqui é da Big Dog Pet. Notamos que ${group.petName} tem lembretes importantes de saúde pendentes:\n\n${alertNames}\n\nPodemos agendar o melhor dia e horário para o atendimento? 🐾✨`;
    const link = whatsappLinkTo(phone, msg);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      {/* 1. Header do Módulo de Saúde com Filtros Enxutos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-card p-3 rounded-2xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Button
            size="sm"
            variant={filterPeriod === "urgente" ? "default" : "outline"}
            onClick={() => setFilterPeriod("urgente")}
            className={cn(
              "h-8 rounded-xl text-xs font-bold px-3 gap-1.5",
              filterPeriod === "urgente" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Urgentes / Atrasados ({totalUrgentes})
          </Button>

          <Button
            size="sm"
            variant={filterPeriod === "semana" ? "default" : "outline"}
            onClick={() => setFilterPeriod("semana")}
            className="h-8 rounded-xl text-xs font-bold px-3 gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            Próximos 7 Dias ({totalUrgentes + totalSemana})
          </Button>

          <Button
            size="sm"
            variant={filterPeriod === "todos" ? "default" : "outline"}
            onClick={() => setFilterPeriod("todos")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Todos ({petGroups.length})
          </Button>
        </div>

        {/* Botão para abrir Gaveta / Modal com lista de 30 dias */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDrawerModal(true)}
          className="h-8 rounded-xl text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5 self-start sm:self-auto shrink-0"
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Ver Agenda Completa (30d)</span>
        </Button>
      </div>

      {/* 2. Listagem de Alertas Agrupados por Pet */}
      <div className="space-y-2.5">
        {filteredGroups.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border/80 bg-card text-center space-y-1">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
            <p className="font-bold text-xs text-foreground">
              {filterPeriod === "urgente"
                ? "Nenhum alerta de vacina ou retorno atrasado no momento!"
                : "Nenhum alerta de saúde encontrado para este período."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              A saúde dos pets da Big Dog Pet está em dia.
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isCat = group.petSpecies?.toLowerCase().includes("gato") || group.petSpecies?.toLowerCase().includes("felin");
            const petEmoji = isCat ? "🐱" : "🐶";
            const hasUrgent = group.urgentCount > 0;

            return (
              <div
                key={group.petId}
                className={cn(
                  "rounded-2xl border p-3.5 transition-all bg-card shadow-xs space-y-2.5",
                  hasUrgent
                    ? "border-rose-500/40 bg-rose-500/[0.02]"
                    : "border-border/70"
                )}
              >
                {/* Linha Superior: Pet, Tutor e Badges de Alerta */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display font-bold text-sm text-foreground">
                        {petEmoji} {capitalizeWords(group.petName)}
                      </span>

                      {hasUrgent ? (
                        <Badge className="bg-rose-600 text-white font-bold text-[10px] px-1.5 py-0 shadow-2xs animate-pulse">
                          ⚠️ {group.urgentCount} atrasado{group.urgentCount > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold text-[10px] px-1.5 py-0">
                          🟡 Nesta semana
                        </Badge>
                      )}

                      {group.alerts.length > 1 && (
                        <Badge variant="secondary" className="text-[10px] font-medium py-0">
                          {group.alerts.length} procedimentos
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                      <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      <span>{capitalizeWords(group.ownerName)}</span>
                      {group.ownerPhone && (
                        <>
                          <span>·</span>
                          <span>{group.ownerPhone}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Menu de Ações Secundárias (⋮) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 text-xs">
                      <DropdownMenuItem onClick={() => handleOpenChat(group)} className="gap-2 cursor-pointer">
                        <MessageCircle className="h-3.5 w-3.5 text-primary" />
                        <span>Abrir Chat com Tutor</span>
                      </DropdownMenuItem>

                      {group.ownerPhone && (
                        <>
                          <DropdownMenuItem onClick={() => handleWhatsApp(group)} className="gap-2 cursor-pointer">
                            <Phone className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Chamar no WhatsApp</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`tel:${digitsOnly(group.ownerPhone!)}`)}
                            className="gap-2 cursor-pointer"
                          >
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Ligar para Tutor</span>
                          </DropdownMenuItem>
                        </>
                      )}

                      {group.petId && onOpenPetRecord && (
                        <DropdownMenuItem onClick={() => onOpenPetRecord(group.petId)} className="gap-2 cursor-pointer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Ver Ficha Médica do Pet</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Lista Agrupada de Procedimentos do Pet */}
                <div className="rounded-xl bg-muted/30 border border-border/40 p-2.5 space-y-1.5">
                  {group.alerts.map((alert) => {
                    const days = daysUntil(alert.dueDate);
                    const isLate = days < 0;
                    const isToday = days === 0;

                    return (
                      <div
                        key={alert.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {alert.type === "vacina" ? (
                            <Syringe className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          )}
                          <span className="font-semibold text-foreground truncate">
                            {alert.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "text-[11px] font-bold px-1.5 py-0.2 rounded-md",
                              isLate
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                : isToday
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                                : "text-muted-foreground"
                            )}
                          >
                            {isLate
                              ? `Atrasado há ${Math.abs(days)}d (${formatDate(alert.dueDate)})`
                              : isToday
                              ? `Vence Hoje`
                              : `Em ${days} dias (${formatDate(alert.dueDate)})`}
                          </span>

                          {alert.reminderId && onCompleteReminder && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onCompleteReminder(alert.reminderId!)}
                              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-emerald-600"
                              title="Marcar retorno como concluído"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ação Primária em 1 Toque */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] text-muted-foreground truncate">
                    {group.alerts.length === 1 ? "1 procedimento pendente" : `${group.alerts.length} procedimentos pendentes`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {group.ownerPhone && (
                      <Button
                        size="sm"
                        onClick={() => handleWhatsApp(group)}
                        className="h-7 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-xs"
                      >
                        <Phone className="h-3 w-3" />
                        <span>Notificar WhatsApp</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenChat(group)}
                      className="h-7 px-2.5 rounded-lg text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                    >
                      <MessageCircle className="h-3 w-3" />
                      <span>Chat</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Modal / Gaveta para Visualização Completa da Agenda dos Próximos 30 Dias */}
      <Dialog open={showDrawerModal} onOpenChange={setShowDrawerModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border/80 bg-card">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Agenda Preventiva Completa · Próximos 30 Dias
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Total de {alerts.length} procedimentos previstos para {petGroups.length} pets cadastrados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {petGroups.map((group) => (
              <div
                key={`modal-${group.petId}`}
                className="p-3 bg-card rounded-xl border border-border/70 shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">
                    🐾 {group.petName} · <span className="font-normal text-muted-foreground">{group.ownerName}</span>
                  </span>
                  {group.urgentCount > 0 ? (
                    <Badge className="bg-rose-600 text-white text-[9px]">Urgente</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px]">Previsto</Badge>
                  )}
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {group.alerts.map((a) => (
                    <div key={a.id} className="flex justify-between">
                      <span>• {a.title}</span>
                      <span>{formatDate(a.dueDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border/80 bg-card flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowDrawerModal(false)} className="h-8 text-xs font-semibold">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
