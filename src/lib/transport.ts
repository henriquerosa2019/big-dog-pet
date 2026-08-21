import type { Tables } from "@/integrations/supabase/types";

/** Modalidade escolhida pelo tutor no agendamento. */
export type LogisticsType = "levar" | "buscar" | "devolver" | "buscar_e_devolver";

export const logisticsTypeLabels: Record<LogisticsType, string> = {
  levar: "Levar ao petshop",
  buscar: "Buscar em casa",
  devolver: "Devolver em casa",
  buscar_e_devolver: "Buscar e devolver",
};

export function needsAddress(mode: LogisticsType): boolean {
  return mode !== "levar";
}

/**
 * Escada canônica de status operacional (appointments.ops_status). Não é um enum
 * do banco (a coluna é texto livre), então esta lista é a fonte da verdade usada
 * pelo app para validar/rotular/ordenar os status.
 */
export const opsStatusOrder = [
  "agendado",
  "motorista_designado",
  "em_deslocamento_retirada",
  "pet_retirado",
  "pet_chegou_petshop",
  "em_atendimento",
  "servico_concluido",
  "em_rota_devolucao",
  "pet_entregue",
  "finalizado",
  "cancelado",
] as const;

export type OpsStatus = (typeof opsStatusOrder)[number];

export const opsStatusLabels: Record<OpsStatus, string> = {
  agendado: "Agendado",
  motorista_designado: "Motorista designado",
  em_deslocamento_retirada: "A caminho da retirada",
  pet_retirado: "Pet retirado",
  pet_chegou_petshop: "Pet chegou ao petshop",
  em_atendimento: "Em atendimento",
  servico_concluido: "Serviço concluído",
  em_rota_devolucao: "A caminho para devolver",
  pet_entregue: "Pet entregue",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/** Mensagens de acompanhamento em 1ª pessoa do pet, para o tutor (seção 7 do briefing). */
export const opsStatusTutorMessage: Record<OpsStatus, string> = {
  agendado: "Seu agendamento foi recebido. Em breve um motorista será designado.",
  motorista_designado: "Um motorista foi designado para buscar seu pet.",
  em_deslocamento_retirada: "Nosso motorista está a caminho para buscar seu pet.",
  pet_retirado: "Seu pet foi retirado e está a caminho do petshop.",
  pet_chegou_petshop: "Seu pet chegou ao petshop.",
  em_atendimento: "Seu pet está sendo atendido.",
  servico_concluido: "O serviço foi concluído!",
  em_rota_devolucao: "Seu pet está voltando para casa.",
  pet_entregue: "Seu pet foi entregue! 🐶❤️",
  finalizado: "Atendimento finalizado. Obrigado por confiar no PetCura!",
  cancelado: "Este agendamento foi cancelado.",
};

export function nextOpsStatus(current: string): OpsStatus | null {
  const idx = opsStatusOrder.indexOf(current as OpsStatus);
  if (idx === -1 || idx >= opsStatusOrder.length - 2) return null; // last non-terminal is "pet_entregue" -> "finalizado"
  return opsStatusOrder[idx + 1]!;
}

/** Carimbo de horário (transport_orders) correspondente a cada avanço de status,
 * usado para popular a coluna de timeline junto com a mudança de ops_status. */
export const opsStatusTimestampColumn: Partial<
  Record<OpsStatus, keyof Tables<"transport_orders">>
> = {
  motorista_designado: "assigned_at",
  em_deslocamento_retirada: "en_route_pickup_at",
  pet_retirado: "picked_up_at",
  pet_chegou_petshop: "arrived_shop_at",
  em_rota_devolucao: "en_route_return_at",
  pet_entregue: "delivered_at",
};

export type DeliveryZone = Tables<"delivery_zones">;

/** Acha a zona de entrega cujo array `districts` contém o bairro informado
 * (comparação sem acento/case, já que endereços são digitados livremente). */
export function findZoneForDistrict(
  zones: DeliveryZone[] | undefined,
  district: string | undefined,
): DeliveryZone | null {
  if (!zones || !district) return null;
  const normalized = normalize(district);
  return (
    zones.find((z) => z.active && z.districts.some((d) => normalize(d) === normalized)) ?? null
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Calcula o valor da retirada/devolução a partir da zona encontrada e do preço
 * do serviço escolhido (para aplicar o "grátis acima de X" da própria zona).
 * Retorna null quando não há zona correspondente (bairro fora de área de
 * atendimento) — a tela deve tratar isso como "fale com a gente pelo WhatsApp"
 * em vez de deixar agendar com um valor errado.
 */
export function computeTransportFeeCents(
  zone: DeliveryZone | null,
  servicePriceCents: number,
): { feeCents: number; freeApplied: boolean } | null {
  if (!zone) return null;
  if (zone.free_above_cents != null && servicePriceCents >= zone.free_above_cents) {
    return { feeCents: 0, freeApplied: true };
  }
  return { feeCents: zone.price_cents, freeApplied: false };
}
