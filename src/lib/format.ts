export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: string | Date): string {
  // Datas "puras" (YYYY-MM-DD, como birth_date) sao fixadas ao meio-dia pra nao
  // escorregar um dia por causa de fuso. Timestamps completos (scheduled_at,
  // created_at, que ja vem com hora e offset) sao usados como estao: concatenar
  // "T12:00:00" neles gerava Invalid Date e o Intl.DateTimeFormat estourava
  // RangeError, quebrando a exportacao de Excel/PDF dos relatorios.
  const date =
    typeof value === "string"
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
      : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function daysUntil(value: string): number {
  const target = new Date(`${value}T12:00:00`).getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

export const CLINIC = {
  name: "Big Dog Pet",
  fullName: "Big Dog Pet - Banho e Tosa",
  tagline: "Acessórios | Banho e Tosa | Produtos p/ Pet",
  unit: "Loja 3",
  address: "Rua Rangel Pestana, 56 - Vila Bazú, Franco da Rocha - SP",
  phoneDisplay: "(21) 99379-3746",
  whatsapp: "5521993793746",
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${CLINIC.whatsapp}?text=${encodeURIComponent(message.slice(0, 1500))}`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Aplica máscara de telefone brasileiro conforme o usuário digita: fixo
 * (99) 9999-9999 (10 dígitos) ou celular (99) 99999-9999 (11 dígitos).
 * Sempre re-deriva da string bruta (não é stateful), então funciona bem
 * como onChange direto de um <Input>.
 */
export function maskPhoneBR(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Builds a wa.me link to a client's own phone number (as opposed to `whatsappLink`,
 * which always points at the clinic's WhatsApp). Returns null when there aren't enough
 * digits to form a valid number, so callers can show a fallback instead of a broken link.
 */
/**
 * Avisos AUTOMÁTICOS por WhatsApp pro cliente (os que abriam sozinhos ao
 * confirmar agendamento, designar motorista, avançar status e entregar o pet).
 * Desligados a pedido do Henrique em 2026-08-29: o volume de disparos automáticos
 * saindo do número da loja levou a Meta a bloquear o número. A ideia é substituir
 * por e-mail. Os botões de conversa individual (falar com o tutor / com o
 * motorista) e os disparos de aniversário e retorno continuam funcionando.
 */
export const AVISO_AUTOMATICO_WHATSAPP = false;

export function whatsappLinkTo(phone: string | null | undefined, message: string): string | null {
  const digits = digitsOnly(phone ?? "");
  if (digits.length < 10) return null;
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message.slice(0, 1500))}`;
}

/**
 * True when a YYYY-MM-DD birth date falls on today's month/day (any year).
 * Compares local calendar date parts directly (not toISOString) to avoid the
 * UTC-vs-Rio timezone day-shift documented elsewhere in this codebase.
 */
export function isBirthdayToday(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const [, month, day] = birthDate.split("-");
  const now = new Date();
  return Number(month) === now.getMonth() + 1 && Number(day) === now.getDate();
}

/** Human-readable pet age ("3 anos", "8 meses", "recém-nascido") from a birth_date. */
export function formatPetAge(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years >= 1) return `${years} ano${years === 1 ? "" : "s"}`;
  if (months >= 1) return `${months} ${months === 1 ? "mês" : "meses"}`;
  return "recém-nascido";
}

/** True when a YYYY-MM-DD birth date falls on tomorrow's month/day (any year). */
export function isBirthdayTomorrow(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const [, month, day] = birthDate.split("-");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return Number(month) === tomorrow.getMonth() + 1 && Number(day) === tomorrow.getDate();
}

/**
 * Deixa cada palavra com inicial maiúscula (ex.: "shana" -> "Shana",
 * "joão da silva" -> "João Da Silva"). Usado pra exibir nome de pet/tutor de
 * forma consistente mesmo quando foi digitado em caixa baixa no cadastro —
 * pedido do Henrique 2026-08-28 depois de ver "shana" em caixa baixa no card
 * de aniversário.
 */
export function capitalizeWords(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Tom visual compartilhado por badges/cards de status em toda a área do
 * tutor e do admin — cada tela mapeia seu próprio status (agendamento, pedido,
 * ops_status de transporte, urgência de alerta) pra um destes 5 tons.
 */
export type StatusTone = "pending" | "info" | "success" | "danger" | "neutral";

const STATUS_TONE_BADGE_CLASSES: Record<StatusTone, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
  danger: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300",
  neutral: "bg-secondary text-secondary-foreground",
};

/** Classes de fundo/texto pra usar num <Badge> (ex.: variant="secondary" + este className). */
export function statusToneClass(tone: StatusTone): string {
  return STATUS_TONE_BADGE_CLASSES[tone];
}

const STATUS_TONE_CARD_CLASSES: Record<StatusTone, string> = {
  pending: "border-amber-400 bg-amber-50/90 dark:border-amber-500/50 dark:bg-amber-950/30",
  info: "border-sky-300 bg-sky-50/90 dark:border-sky-500/40 dark:bg-sky-950/30",
  success: "border-emerald-400 bg-emerald-50/90 dark:border-emerald-500/50 dark:bg-emerald-950/30",
  danger: "border-red-400 bg-red-50/90 dark:border-red-500/50 dark:bg-red-950/30",
  neutral: "border-primary/30 bg-secondary",
};

/** Classes de borda/fundo pra usar num card de alerta (ex.: aviso de vacina atrasada). */
export function statusToneCardClass(tone: StatusTone): string {
  return STATUS_TONE_CARD_CLASSES[tone];
}

const STATUS_TONE_ICON_CLASSES: Record<StatusTone, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  info: "text-sky-600 dark:text-sky-400",
  success: "text-emerald-600 dark:text-emerald-400",
  danger: "text-red-600 dark:text-red-400",
  neutral: "text-primary",
};

/** Cor de ícone que combina com statusToneCardClass. */
export function statusToneIconClass(tone: StatusTone): string {
  return STATUS_TONE_ICON_CLASSES[tone];
}

/** Cor por status de agendamento (appointments.status: pendente/confirmado/em_atendimento/concluido/cancelado). */
export function appointmentStatusTone(status: string): StatusTone {
  switch (status) {
    case "pendente":
      return "pending";
    case "confirmado":
      return "info";
    case "em_atendimento":
    case "concluido":
      return "success";
    case "cancelado":
      return "danger";
    default:
      return "neutral";
  }
}

/** Cor por status de pedido da loja (orders.status: novo/em_preparo/em_atendimento/entregue/cancelado). */
export function orderStatusTone(status: string): StatusTone {
  switch (status) {
    case "novo":
      return "pending";
    case "em_preparo":
    case "em_atendimento":
    case "entregue":
      return "success";
    case "cancelado":
      return "danger";
    default:
      return "neutral";
  }
}

/**
 * Retorna true se o agendamento estiver com status operacional ou geral "em_atendimento".
 */
export function isAppointmentInService(item: {
  status?: string | null;
  ops_status?: string | null;
} | null | undefined): boolean {
  if (!item) return false;
  return item.ops_status === "em_atendimento" || item.status === "em_atendimento";
}

export interface AppointmentStatusDisplay {
  label: string;
  bannerText: string;
  bannerTag: string;
  badgeClass: string;
  cardClass: string;
  bannerClass: string;
  dotPingClass: string;
  dotClass: string;
  titleColorClass: string;
  timeColorClass: string;
  iconColorClass: string;
  isCancelled: boolean;
  isPending: boolean;
  isConfirmed: boolean;
  isInService: boolean;
  isConcluded: boolean;
}

export function getAppointmentStatusDisplay(item: {
  status?: string | null;
  ops_status?: string | null;
} | null | undefined): AppointmentStatusDisplay {
  const status = item?.status ?? "pendente";
  const ops = item?.ops_status ?? "";
  const isCancelled = status === "cancelado" || ops === "cancelado";
  const isInService = isAppointmentInService(item);
  const isConcluded = status === "concluido" || ops === "finalizado" || ops === "pet_entregue";

  if (isCancelled) {
    return {
      label: "Cancelado",
      bannerText: "🔴 Agendamento cancelado pela loja",
      bannerTag: "Cancelado",
      badgeClass: "bg-rose-600 hover:bg-rose-700 text-white font-bold border-0",
      cardClass: "border-2 border-rose-500 bg-rose-50/95 dark:border-rose-500/80 dark:bg-rose-950/60 ring-2 ring-rose-400/50 shadow-md",
      bannerClass: "border border-rose-500/40 bg-rose-500/20 text-rose-950 dark:text-rose-100 font-bold",
      dotPingClass: "bg-rose-500",
      dotClass: "bg-rose-600",
      titleColorClass: "text-rose-950 dark:text-rose-50 font-bold",
      timeColorClass: "text-rose-800 dark:text-rose-300 font-medium",
      iconColorClass: "text-rose-600 dark:text-rose-400",
      isCancelled: true,
      isPending: false,
      isConfirmed: false,
      isInService: false,
      isConcluded: false,
    };
  }

  if (isInService) {
    return {
      label: "Em Atendimento ✂️",
      bannerText: "🛁 Atendimento iniciado com carinho! (Banho & Tosa) 🥳",
      bannerTag: "Em Andamento",
      badgeClass: "bg-cyan-600 hover:bg-cyan-700 text-white font-bold border-0 animate-pulse",
      cardClass: "border-2 border-cyan-500/90 bg-cyan-50/90 dark:border-cyan-500/80 dark:bg-cyan-950/50 ring-2 ring-cyan-400/40 shadow-md",
      bannerClass: "border border-cyan-500/30 bg-cyan-500/20 text-cyan-950 dark:text-cyan-100 font-bold",
      dotPingClass: "bg-cyan-500",
      dotClass: "bg-cyan-600",
      titleColorClass: "text-cyan-950 dark:text-cyan-50 font-bold",
      timeColorClass: "text-cyan-800 dark:text-cyan-300 font-medium",
      iconColorClass: "text-cyan-600 dark:text-cyan-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: false,
      isInService: true,
      isConcluded: false,
    };
  }

  // Fases operacionais ativas de Táxi Pet: nunca devem exibir "Aguardando confirmação da loja"
  if (ops === "em_deslocamento_retirada") {
    return {
      label: "A Caminho da Retirada",
      bannerText: "🚗 Táxi Pet a caminho da sua casa para buscar seu pet!",
      bannerTag: "A Caminho",
      badgeClass: "bg-blue-600 hover:bg-blue-700 text-white font-bold border-0 animate-pulse",
      cardClass: "border-2 border-blue-500/90 bg-blue-50/90 dark:border-blue-500/80 dark:bg-blue-950/50 ring-2 ring-blue-400/40 shadow-md",
      bannerClass: "border border-blue-500/30 bg-blue-500/20 text-blue-950 dark:text-blue-100 font-bold",
      dotPingClass: "bg-blue-500",
      dotClass: "bg-blue-600",
      titleColorClass: "text-blue-950 dark:text-blue-50 font-bold",
      timeColorClass: "text-blue-800 dark:text-blue-300 font-medium",
      iconColorClass: "text-blue-600 dark:text-blue-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  if (ops === "pet_retirado") {
    return {
      label: "A Caminho do Petshop",
      bannerText: "🐾 Pet a bordo a caminho do petshop!",
      bannerTag: "Em Trânsito",
      badgeClass: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-0",
      cardClass: "border-2 border-indigo-500/90 bg-indigo-50/90 dark:border-indigo-500/80 dark:bg-indigo-950/50 ring-2 ring-indigo-400/40 shadow-md",
      bannerClass: "border border-indigo-500/30 bg-indigo-500/20 text-indigo-950 dark:text-indigo-100 font-bold",
      dotPingClass: "bg-indigo-500",
      dotClass: "bg-indigo-600",
      titleColorClass: "text-indigo-950 dark:text-indigo-50 font-bold",
      timeColorClass: "text-indigo-800 dark:text-indigo-300 font-medium",
      iconColorClass: "text-indigo-600 dark:text-indigo-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  if (ops === "pet_chegou_petshop") {
    return {
      label: "No Petshop",
      bannerText: "🏬 Pet recebido no petshop para banho e tosa!",
      bannerTag: "Na Loja",
      badgeClass: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0",
      cardClass: "border-2 border-emerald-500/90 bg-emerald-50/90 dark:border-emerald-500/80 dark:bg-emerald-950/50 ring-2 ring-emerald-400/40 shadow-md",
      bannerClass: "border border-emerald-500/30 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 font-bold",
      dotPingClass: "bg-emerald-500",
      dotClass: "bg-emerald-600",
      titleColorClass: "text-emerald-950 dark:text-emerald-50 font-bold",
      timeColorClass: "text-emerald-800 dark:text-emerald-300 font-medium",
      iconColorClass: "text-emerald-600 dark:text-emerald-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  if (ops === "em_rota_devolucao") {
    return {
      label: "A Caminho de Casa",
      bannerText: "🏡 Pet limpinho e cheiroso voltando para casa!",
      bannerTag: "Em Devolução",
      badgeClass: "bg-purple-600 hover:bg-purple-700 text-white font-bold border-0 animate-pulse",
      cardClass: "border-2 border-purple-500/90 bg-purple-50/90 dark:border-purple-500/80 dark:bg-purple-950/50 ring-2 ring-purple-400/40 shadow-md",
      bannerClass: "border border-purple-500/30 bg-purple-500/20 text-purple-950 dark:text-purple-100 font-bold",
      dotPingClass: "bg-purple-500",
      dotClass: "bg-purple-600",
      titleColorClass: "text-purple-950 dark:text-purple-50 font-bold",
      timeColorClass: "text-purple-800 dark:text-purple-300 font-medium",
      iconColorClass: "text-purple-600 dark:text-purple-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  if (ops === "servico_concluido") {
    return {
      label: "Serviço Pronto",
      bannerText: "✨ Banho e tosa concluídos! Aguardando transporte para devolução",
      bannerTag: "Pronto",
      badgeClass: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0",
      cardClass: "border-2 border-emerald-500/90 bg-emerald-50/90 dark:border-emerald-500/80 dark:bg-emerald-950/50 ring-2 ring-emerald-400/40 shadow-md",
      bannerClass: "border border-emerald-500/30 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 font-bold",
      dotPingClass: "bg-emerald-500",
      dotClass: "bg-emerald-600",
      titleColorClass: "text-emerald-950 dark:text-emerald-50 font-bold",
      timeColorClass: "text-emerald-800 dark:text-emerald-300 font-medium",
      iconColorClass: "text-emerald-600 dark:text-emerald-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  if (ops === "motorista_designado") {
    return {
      label: "Motorista Designado",
      bannerText: "🚗 Motorista designado para a rota de coleta!",
      bannerTag: "Confirmado",
      badgeClass: "bg-blue-600 hover:bg-blue-700 text-white font-bold border-0",
      cardClass: "border-2 border-blue-500/90 bg-blue-50/90 dark:border-blue-500/80 dark:bg-blue-950/50 ring-2 ring-blue-400/40 shadow-md",
      bannerClass: "border border-blue-500/30 bg-blue-500/20 text-blue-950 dark:text-blue-100 font-bold",
      dotPingClass: "bg-blue-500",
      dotClass: "bg-blue-600",
      titleColorClass: "text-blue-950 dark:text-blue-50 font-bold",
      timeColorClass: "text-blue-800 dark:text-blue-300 font-medium",
      iconColorClass: "text-blue-600 dark:text-blue-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  const isConfirmed = status === "confirmado";
  const isPending = status === "pendente";

  if (isConfirmed) {
    return {
      label: "Confirmado ✓",
      bannerText: "🟢 Agendamento confirmado pela loja!",
      bannerTag: "Garantido",
      badgeClass: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0",
      cardClass: "border-2 border-emerald-500/90 bg-emerald-50/90 dark:border-emerald-500/80 dark:bg-emerald-950/50 ring-2 ring-emerald-400/40 shadow-md",
      bannerClass: "border border-emerald-500/30 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 font-bold",
      dotPingClass: "bg-emerald-500",
      dotClass: "bg-emerald-600",
      titleColorClass: "text-emerald-950 dark:text-emerald-50 font-bold",
      timeColorClass: "text-emerald-800 dark:text-emerald-300 font-medium",
      iconColorClass: "text-emerald-600 dark:text-emerald-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: true,
      isInService: false,
      isConcluded: false,
    };
  }

  if (isPending) {
    return {
      label: "Aguardando Loja",
      bannerText: "🟡 Agendamento enviado · Aguardando confirmação da loja",
      bannerTag: "Pendente",
      badgeClass: "bg-amber-500 hover:bg-amber-600 text-white font-bold border-0",
      cardClass: "border-2 border-amber-500/80 bg-amber-50/90 dark:border-amber-500/60 dark:bg-amber-950/40 ring-2 ring-amber-400/30 shadow-md",
      bannerClass: "border border-amber-500/40 bg-amber-500/20 text-amber-950 dark:text-amber-100 font-bold",
      dotPingClass: "bg-amber-500",
      dotClass: "bg-amber-600",
      titleColorClass: "text-amber-950 dark:text-amber-50 font-bold",
      timeColorClass: "text-amber-800 dark:text-amber-300 font-medium",
      iconColorClass: "text-amber-600 dark:text-amber-400",
      isCancelled: false,
      isPending: true,
      isConfirmed: false,
      isInService: false,
      isConcluded: false,
    };
  }

  if (isConcluded) {
    return {
      label: "Concluído",
      bannerText: "🎉 Atendimento concluído com sucesso!",
      bannerTag: "Finalizado",
      badgeClass: "bg-emerald-700 hover:bg-emerald-800 text-white font-bold border-0",
      cardClass: "border-2 border-emerald-600/80 bg-emerald-50/80 dark:border-emerald-600/60 dark:bg-emerald-950/40 ring-1 ring-emerald-500/30 shadow-md",
      bannerClass: "border border-emerald-600/30 bg-emerald-600/20 text-emerald-950 dark:text-emerald-100 font-bold",
      dotPingClass: "bg-emerald-600",
      dotClass: "bg-emerald-700",
      titleColorClass: "text-emerald-950 dark:text-emerald-50 font-bold",
      timeColorClass: "text-emerald-800 dark:text-emerald-300 font-medium",
      iconColorClass: "text-emerald-600 dark:text-emerald-400",
      isCancelled: false,
      isPending: false,
      isConfirmed: false,
      isInService: false,
      isConcluded: true,
    };
  }

  return {
    label: status,
    bannerText: "🔵 Agendamento ativo",
    bannerTag: "Ativo",
    badgeClass: "bg-primary text-primary-foreground font-bold border-0",
    cardClass: "border-2 border-primary/50 bg-secondary/50 shadow-md",
    bannerClass: "border border-primary/20 bg-primary/10 text-primary font-bold",
    dotPingClass: "bg-primary",
    dotClass: "bg-primary",
    titleColorClass: "text-foreground font-bold",
    timeColorClass: "text-muted-foreground font-medium",
    iconColorClass: "text-primary",
    isCancelled: false,
    isPending: false,
    isConfirmed: false,
    isInService: false,
    isConcluded: false,
  };
}

/**
 * Retorna true se o pedido estiver em atendimento / em preparo.
 */
export function isOrderInService(order: {
  status?: string | null;
} | null | undefined): boolean {
  if (!order) return false;
  return order.status === "em_preparo" || order.status === "em_atendimento";
}

/**
 * Reordena uma lista de itens mantendo os itens "Em Atendimento" no início da fila (topo),
 * preservando a ordem relativa original entre itens da mesma prioridade (ordenação estável).
 */
export function sortInServiceFirst<T>(
  items: T[],
  isInService: (item: T) => boolean,
): T[] {
  if (!items || items.length <= 1) return items ?? [];
  return [...items].sort((a, b) => {
    const aInService = isInService(a) ? 1 : 0;
    const bInService = isInService(b) ? 1 : 0;
    return bInService - aInService;
  });
}

/** 
 * Tom de um alerta (vacina/retorno) conforme proximidade do evento:
 * - days <= 1 (atrasado, hoje ou 1 dia/amanhã): "danger" (vermelho)
 * - days === 2 (em 2 dias): "pending" (amarelo)
 * - days > 2 (mais de 2 dias até 30 dias): "info" (azul/informativo)
 */
export function alertTone(days: number): StatusTone {
  if (days <= 1) return "danger";
  if (days === 2) return "pending";
  return "info";
}

/** Rótulo padronizado do badge de proximidade de um alerta */
export function alertBadgeLabel(days: number): string {
  if (days < 0) return `Atrasado há ${Math.abs(days)}d`;
  if (days === 0) return "HOJE!";
  if (days === 1) return "Amanhã";
  if (days === 2) return "Em 2 dias";
  return `Em ${days} dias`;
}

/**
 * Percentual de desconto da campanha de aniversário — fonte única usada tanto
 * nos textos (banners, mensagens de WhatsApp) quanto no cálculo real do
 * desconto em /agendar. Mudar aqui muda em todo lugar; nunca hardcode "20%"
 * de novo num texto novo — foi exatamente essa duplicação que causou o preço
 * exibido não bater com o desconto prometido.
 */
export const BIRTHDAY_DISCOUNT_PERCENT = 20;

/**
 * Código do cupom da campanha de aniversário (20% em banho/tosa ou na loja),
 * derivado do nome do pet ou tutor pra parecer pessoal (ex.: "Shana" -> "ANIVSHANA20").
 * Determinístico e sem acento/espaço pra caber num badge e ser fácil de digitar/conferir.
 *
 * IMPORTANTE: esse código NUNCA foi (e não é) validado contra a tabela
 * transport_coupons — ele não existe no banco. Em /agendar o desconto de
 * BIRTHDAY_DISCOUNT_PERCENT é aplicado diretamente no preço do serviço
 * sempre que a página é aberta com ?campanha=niver (ver isBirthdayOffer em
 * agendar.tsx), sem depender do texto do código em si. Em /loja e /carrinho
 * o cupom continua só informativo — a equipe confere e desconta manualmente
 * pelo WhatsApp, já que ali não há um preço único e óbvio pra descontar
 * automaticamente (é o carrinho inteiro, com produtos variados).
 */
export function birthdayCouponCode(name: string | null | undefined): string {
  const base = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 10);
  return `ANIV${base || "PET"}20`;
}
