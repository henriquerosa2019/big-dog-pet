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
  name: "PetCura",
  fullName: "Consultório Veterinário PetCura",
  address: "Rua Uruguai, 283 - loja A - Tijuca, Rio de Janeiro",
  phoneDisplay: "(21) 99379-3746",
  whatsapp: "5521993793746",
  email: "petcuraveterinaria@gmail.com",
  instagram: "@PetcuraVet",
  responsible: "Dr. Rafael Barbi - CRMV-RJ 19329",
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
