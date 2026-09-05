import type { Tables } from "@/integrations/supabase/types";
import { capitalizeWords, type StatusTone } from "./format";

/** Modalidade escolhida pelo tutor no agendamento. */
export type LogisticsType = "levar" | "buscar" | "devolver" | "buscar_e_devolver";

export const logisticsTypeLabels: Record<LogisticsType, string> = {
  levar: "Levar ao petshop",
  buscar: "Buscar em casa",
  devolver: "Devolver em casa",
  buscar_e_devolver: "Buscar e devolver",
};

/**
 * Etapas que encerram o agendamento. Ao chegar numa delas o app fecha o
 * `appointments.status` como "concluido" - antes o agendamento podia terminar o
 * transporte inteiro e continuar marcado como "pendente", o que sujava a
 * receita e as listas do painel.
 */
export const CLOSING_OPS_STATUS = ["pet_entregue", "finalizado"];

/** Etapas do transporte a partir das quais o servico ja foi de fato executado. */
export const EXECUTED_OPS_STATUS = ["servico_concluido", "pet_entregue", "finalizado"];

/**
 * Um servico conta como executado (= receita realizada) quando a loja marcou o
 * agendamento como "concluido" OU quando o fluxo de transporte ja passou do
 * atendimento. Os dois casos existem porque agendamento sem transporte so muda
 * de `status`, e o com transporte anda pelo `ops_status`. Usado no Dashboard e
 * nos Relatorios pra nao contar como receita o que ainda nem aconteceu.
 */
export function isServiceExecuted(a: { status: string; ops_status?: string | null }): boolean {
  return a.status === "concluido" || EXECUTED_OPS_STATUS.includes(a.ops_status ?? "");
}

/**
 * So essas modalidades geram taxa de transporte. O banco tem registros antigos
 * com `levar_ao_petshop`, que e o mesmo caso de "levar" (o tutor leva o pet) e
 * nao deve entrar na receita de transporte.
 */
export function hasTransportFee(mode: string | null | undefined): boolean {
  return mode === "buscar" || mode === "devolver" || mode === "buscar_e_devolver";
}

export function needsAddress(mode: LogisticsType): boolean {
  return mode !== "levar";
}

/** Porte do pet (pets.size), usado para decidir quais veículos podem
 * transportá-lo na retirada/devolução. */
export type PetSize = "pequeno" | "medio" | "grande";

export const petSizeLabels: Record<PetSize, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

/** Veículo do motorista (profiles.vehicle_type). */
export type VehicleType = "moto" | "carro";

export const vehicleTypeLabels: Record<VehicleType, string> = {
  moto: "Moto",
  carro: "Carro",
};

/**
 * Moto só é permitida para pets de porte pequeno (com caixa de transporte
 * apropriada); médio e grande exigem carro. Um porte desconhecido/inválido é
 * tratado como "não pequeno" — mais seguro exigir carro do que liberar moto
 * por dado ausente.
 */
export function isVehicleAllowedForPet(
  vehicleType: VehicleType,
  petSize: string | null | undefined,
): boolean {
  if (vehicleType === "carro") return true;
  return petSize === "pequeno";
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
  finalizado: "Atendimento finalizado. Obrigado por confiar no Big Dog Pet!",
  cancelado: "Este agendamento foi cancelado.",
};

/**
 * Retorna o rótulo de status operacional personalizado com o nome do pet (quando disponível).
 * Ex: "Agendado (Thor)", "Buscando Thor", "Thor no petshop", "Thor em atendimento", etc.
 */
export function formatOpsStatusWithPet(
  status: OpsStatus | string | null | undefined,
  petName?: string | null,
): string {
  if (!status) return "";
  const base = opsStatusLabels[status as OpsStatus] ?? status;
  if (!petName || !petName.trim()) return base;
  const name = capitalizeWords(petName.trim());

  switch (status) {
    case "agendado":
      return `Agendado (${name})`;
    case "motorista_designado":
      return `Motorista designado (${name})`;
    case "em_deslocamento_retirada":
      return `Buscando ${name}`;
    case "pet_retirado":
      return `${name} a caminho do petshop`;
    case "pet_chegou_petshop":
      return `${name} no petshop`;
    case "em_atendimento":
      return `${name} em atendimento`;
    case "servico_concluido":
      return `Serviço de ${name} concluído`;
    case "em_rota_devolucao":
      return `Levando ${name} para casa`;
    case "pet_entregue":
      return `${name} entregue em casa`;
    case "finalizado":
      return `Atendimento de ${name} finalizado`;
    case "cancelado":
      return `Cancelado (${name})`;
    default:
      return `${base} (${name})`;
  }
}

/**
 * Retorna a mensagem em tempo real para o tutor personalizada com o nome do pet.
 */
export function getOpsStatusTutorMessage(
  status: OpsStatus | string | null | undefined,
  petName?: string | null,
): string {
  if (!status) return "";
  const validStatus = status as OpsStatus;
  if (!petName || !petName.trim()) return opsStatusTutorMessage[validStatus] ?? "";
  const name = capitalizeWords(petName.trim());

  switch (validStatus) {
    case "agendado":
      return `O agendamento de ${name} foi recebido. Em breve um motorista será designado.`;
    case "motorista_designado":
      return `Um motorista foi designado para buscar ${name}.`;
    case "em_deslocamento_retirada":
      return `Nosso motorista está a caminho para buscar ${name}.`;
    case "pet_retirado":
      return `${name} foi retirado(a) e está a caminho do petshop.`;
    case "pet_chegou_petshop":
      return `${name} chegou ao petshop.`;
    case "em_atendimento":
      return `${name} está em atendimento.`;
    case "servico_concluido":
      return `O serviço de ${name} foi concluído!`;
    case "em_rota_devolucao":
      return `${name} está voltando para casa.`;
    case "pet_entregue":
      return `${name} foi entregue em casa! 🐶❤️`;
    case "finalizado":
      return `Atendimento de ${name} finalizado. Obrigado por confiar no Big Dog Pet!`;
    case "cancelado":
      return `O agendamento de ${name} foi cancelado.`;
    default:
      return opsStatusTutorMessage[validStatus] ?? "";
  }
}

/** Cor por etapa operacional de transporte, usada nos badges de status. */
export function opsStatusTone(status: string): StatusTone {
  switch (status as OpsStatus) {
    case "cancelado":
      return "danger";
    case "finalizado":
    case "pet_entregue":
    case "servico_concluido":
    case "em_atendimento":
      return "success";
    case "em_deslocamento_retirada":
    case "em_rota_devolucao":
      return "info";
    default:
      return "pending"; // agendado, motorista_designado, pet_retirado, pet_chegou_petshop
  }
}

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

export type Coupon = Tables<"transport_coupons">;
export type TransportSettings = Tables<"transport_settings">;

export type FeeBreakdownStep = { label: string; deltaCents: number };

export type TransportFeeResult = {
  feeCents: number;
  freeApplied: boolean;
  /** false quando o bairro informado não bate com nenhuma zona cadastrada —
   * o agendamento segue mesmo assim, com o valor a ser confirmado pelo
   * petshop (ajuste manual no painel admin), em vez de travar o tutor. */
  zoneMatched: boolean;
  /** Passo a passo de como o valor final foi calculado (base da zona, desconto
   * de cliente recorrente, cupom) — mostrado ao tutor e salvo em
   * transport_orders.fee_breakdown para transparência e auditoria. */
  breakdown: FeeBreakdownStep[];
};

/** Um cupom é utilizável se estiver ativo e não expirado. */
export function isCouponUsable(coupon: Coupon | null | undefined): coupon is Coupon {
  if (!coupon || !coupon.active) return false;
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return false;
  return true;
}

/**
 * Calcula o valor da retirada/devolução a partir de três fatores, todos
 * configuráveis pelo admin: a zona/bairro (proxy de distância — price_cents e
 * free_above_cents por zona), um desconto padrão para cliente recorrente
 * (transport_settings.returning_client_discount_percent) e um cupom opcional
 * informado pelo tutor (transport_coupons). Quando não há zona correspondente
 * (bairro fora das zonas cadastradas), NÃO bloqueia o agendamento — retorna
 * zoneMatched: false com feeCents: 0, para o petshop confirmar/ajustar o valor
 * manualmente depois (ver TransportPriceEditor em admin.tsx).
 */
export function computeTransportFeeCents(
  zone: DeliveryZone | null,
  servicePriceCents: number,
  options?: {
    isReturningClient?: boolean;
    returningClientDiscountPercent?: number | null;
    coupon?: Coupon | null;
  },
): TransportFeeResult {
  if (!zone) return { feeCents: 0, freeApplied: false, zoneMatched: false, breakdown: [] };

  const breakdown: FeeBreakdownStep[] = [{ label: zone.name, deltaCents: zone.price_cents }];
  let cents = zone.price_cents;

  if (zone.free_above_cents != null && servicePriceCents >= zone.free_above_cents) {
    breakdown.push({ label: "Grátis para esse valor de serviço", deltaCents: -cents });
    return { feeCents: 0, freeApplied: true, zoneMatched: true, breakdown };
  }

  if (options?.isReturningClient && options.returningClientDiscountPercent) {
    const discount = Math.round((cents * options.returningClientDiscountPercent) / 100);
    if (discount > 0) {
      breakdown.push({
        label: `Desconto cliente recorrente (${options.returningClientDiscountPercent}%)`,
        deltaCents: -discount,
      });
      cents -= discount;
    }
  }

  if (isCouponUsable(options?.coupon)) {
    const coupon = options!.coupon!;
    const discount =
      coupon.discount_type === "percent"
        ? Math.round((cents * coupon.discount_value) / 100)
        : coupon.discount_value;
    const applied = Math.min(Math.max(discount, 0), cents);
    if (applied > 0) {
      breakdown.push({ label: `Cupom ${coupon.code}`, deltaCents: -applied });
      cents -= applied;
    }
  }

  return { feeCents: Math.max(0, cents), freeApplied: false, zoneMatched: true, breakdown };
}
