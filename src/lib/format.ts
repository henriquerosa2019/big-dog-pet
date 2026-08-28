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
