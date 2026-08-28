export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
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
  pending: "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
  info: "border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/10",
  success: "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10",
  danger: "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10",
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

/** Cor por status de agendamento (appointments.status: pendente/confirmado/concluido/cancelado). */
export function appointmentStatusTone(status: string): StatusTone {
  switch (status) {
    case "pendente":
      return "pending";
    case "confirmado":
      return "info";
    case "concluido":
      return "success";
    case "cancelado":
      return "danger";
    default:
      return "neutral";
  }
}

/** Cor por status de pedido da loja (orders.status: novo/em_preparo/entregue/cancelado). */
export function orderStatusTone(status: string): StatusTone {
  switch (status) {
    case "novo":
      return "pending";
    case "em_preparo":
      return "info";
    case "entregue":
      return "success";
    case "cancelado":
      return "danger";
    default:
      return "neutral";
  }
}

/** Tom de um alerta (vacina/retorno) conforme já esteja atrasado (days < 0) ou só se aproximando. */
export function alertTone(days: number): StatusTone {
  return days < 0 ? "danger" : "pending";
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
