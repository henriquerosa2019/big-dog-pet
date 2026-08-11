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

export const CLINIC = {
  name: "PetCura",
  fullName: "Consultório Veterinário PetCura",
  address: "Rua Uruguai, 283 - loja A - Tijuca, Rio de Janeiro",
  phoneDisplay: "(21) 99034-3434",
  whatsapp: "5521990343434",
  email: "petcuraveterinaria@gmail.com",
  instagram: "@PetcuraVet",
  responsible: "Dr. Rafael Barbi - CRMV-RJ 19329",
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${CLINIC.whatsapp}?text=${encodeURIComponent(message.slice(0, 1500))}`;
}
