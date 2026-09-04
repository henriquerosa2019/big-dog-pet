import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import {
  CLOSING_OPS_STATUS,
  opsStatusLabels,
  opsStatusTimestampColumn,
  opsStatusTutorMessage,
  type OpsStatus,
} from "@/lib/transport";
import type { DriverLocationPayload } from "@/lib/driverLocation";

/**
 * Ponto de referência do Petshop Big Dog Pet
 * Rua Rangel Pestana, 56 - Vila Bazú, Franco da Rocha - SP
 */
export const SHOP_LOCATION = {
  name: "Big Dog Pet - Loja 3",
  address: "Rua Rangel Pestana, 56 - Vila Bazú, Franco da Rocha - SP",
  lat: -23.32185,
  lng: -46.7262,
} as const;

/**
 * Ponto de referência da Residência do Tutor
 * Rua Nelson Rodrigues, 120 - Parque Vitória, Franco da Rocha - SP
 */
export const TUTOR_HOME_LOCATION = {
  name: "Residência do Tutor",
  address: "Rua Nelson Rodrigues, 120 - Parque Vitória, Franco da Rocha - SP",
  lat: -23.3315,
  lng: -46.721,
} as const;

/**
 * Waypoints pelas ruas de Franco da Rocha ligando a Loja à Casa do Tutor.
 */
const ROUTE_WAYPOINTS: [number, number][] = [
  [-23.32185, -46.7262], // 1. Saída da Loja (Rua Rangel Pestana)
  [-23.3229, -46.7258], // 2. Rua Rangel Pestana x Av. dos Expedicionários
  [-23.3242, -46.7252], // 3. Av. dos Expedicionários
  [-23.3255, -46.7243], // 4. Viaduto / Centro de Franco da Rocha
  [-23.3268, -46.7234], // 5. Av. Sete de Setembro
  [-23.3282, -46.7226], // 6. Av. Sete de Setembro x Rua Cavalheiro Ângelo Sestini
  [-23.3298, -46.7218], // 7. Acesso ao Parque Vitória
  [-23.3315, -46.721], // 8. Chegada na Residência do Tutor
];

/**
 * Gera pontos intermediários suaves ao longo dos waypoints com cálculo de direção e velocidade.
 */
function generateInterpolatedRoute(
  waypoints: [number, number][],
  stepsPerSegment: number = 4,
): DriverLocationPayload[] {
  const points: DriverLocationPayload[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i]!;
    const end = waypoints[i + 1]!;

    for (let s = 0; s < stepsPerSegment; s++) {
      const ratio = s / stepsPerSegment;
      const lat = start[0] + (end[0] - start[0]) * ratio;
      const lng = start[1] + (end[1] - start[1]) * ratio;

      // Direção em graus (heading)
      const dLng = end[1] - start[1];
      const dLat = end[0] - start[0];
      const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

      // Velocidade estimada da via em m/s (25-35 km/h)
      const speedKmh = 28 + Math.sin(ratio * Math.PI) * 8;
      const speedMs = (speedKmh * 1000) / 3600;

      points.push({
        lat,
        lng,
        heading: Math.round(heading >= 0 ? heading : heading + 360),
        speed: Math.round(speedMs),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Ponto final
  const last = waypoints[waypoints.length - 1]!;
  points.push({
    lat: last[0],
    lng: last[1],
    heading: 0,
    speed: 0,
    updatedAt: new Date().toISOString(),
  });

  return points;
}

/** Rota da Loja até a Casa do Tutor (Ida) */
export const OUTBOUND_ROUTE = generateInterpolatedRoute(ROUTE_WAYPOINTS);

/** Rota da Casa do Tutor até a Loja (Volta) */
export const INBOUND_ROUTE = generateInterpolatedRoute([...ROUTE_WAYPOINTS].reverse());

/** Canal de broadcast local no navegador para sincronizar abas instantaneamente sem latência de rede */
export const SIMULATOR_BROADCAST_CHANNEL = "driver-location-simulated";

/**
 * Transmite a posição simulada tanto para o Supabase Realtime quanto para o canal local do navegador.
 */
export function broadcastSimulatedPosition(
  appointmentId: string,
  payload: DriverLocationPayload,
) {
  // 1. Canal local do navegador (BroadcastChannel) — sincroniza abas e janelas locais a 60fps
  if (typeof window !== "undefined") {
    try {
      const bc = new BroadcastChannel(SIMULATOR_BROADCAST_CHANNEL);
      bc.postMessage({ appointmentId, payload });
      bc.close();
    } catch {
      // Fallback para navegadores legados
    }
    // Evento na janela atual
    window.dispatchEvent(
      new CustomEvent(SIMULATOR_BROADCAST_CHANNEL, {
        detail: { appointmentId, payload },
      }),
    );
  }

  // 2. Supabase Realtime broadcast privado (para quem estiver em outro dispositivo ou rede)
  try {
    const channel = supabase.channel(`driver-location:${appointmentId}`, {
      config: { private: true },
    });
    void channel.send({
      type: "broadcast",
      event: "location_update",
      payload,
    });
  } catch {
    // Ignora erro se canal não estiver pronto
  }
}

/**
 * Sequência completa de simulação em 9 etapas
 */
export const SIMULATION_STEPS: {
  status: OpsStatus;
  label: string;
  tutorMessage: string;
  isMoving: boolean;
  routeType?: "outbound" | "inbound";
  description: string;
}[] = [
  {
    status: "motorista_designado",
    label: opsStatusLabels.motorista_designado,
    tutorMessage: opsStatusTutorMessage.motorista_designado,
    isMoving: false,
    description: "Atendimento compartilhado com o motorista e rota aceita.",
  },
  {
    status: "em_deslocamento_retirada",
    label: opsStatusLabels.em_deslocamento_retirada,
    tutorMessage: opsStatusTutorMessage.em_deslocamento_retirada,
    isMoving: true,
    routeType: "outbound",
    description: "Motorista se desloca até a residência do tutor. GPS ativo no mapa.",
  },
  {
    status: "pet_retirado",
    label: opsStatusLabels.pet_retirado,
    tutorMessage: opsStatusTutorMessage.pet_retirado,
    isMoving: false,
    description: "Motorista chega na residência e acomoda o pet com segurança.",
  },
  {
    status: "pet_chegou_petshop",
    label: opsStatusLabels.pet_chegou_petshop,
    tutorMessage: opsStatusTutorMessage.pet_chegou_petshop,
    isMoving: true,
    routeType: "inbound",
    description: "Transporte do pet até a loja. Chegada confirmada na recepção.",
  },
  {
    status: "em_atendimento",
    label: opsStatusLabels.em_atendimento,
    tutorMessage: opsStatusTutorMessage.em_atendimento,
    isMoving: false,
    description: "Pet no salão de banho e tosa recebendo os cuidados contratados.",
  },
  {
    status: "servico_concluido",
    label: opsStatusLabels.servico_concluido,
    tutorMessage: opsStatusTutorMessage.servico_concluido,
    isMoving: false,
    description: "Banho e tosa finalizados, pet cheiroso e pronto para retornar.",
  },
  {
    status: "em_rota_devolucao",
    label: opsStatusLabels.em_rota_devolucao,
    tutorMessage: opsStatusTutorMessage.em_rota_devolucao,
    isMoving: true,
    routeType: "outbound",
    description: "Motorista a caminho da casa do tutor para devolver o pet.",
  },
  {
    status: "pet_entregue",
    label: opsStatusLabels.pet_entregue,
    tutorMessage: opsStatusTutorMessage.pet_entregue,
    isMoving: false,
    description: "Pet entregue com carinho nos braços do tutor.",
  },
  {
    status: "finalizado",
    label: opsStatusLabels.finalizado,
    tutorMessage: opsStatusTutorMessage.finalizado,
    isMoving: false,
    description: "Atendimento concluído com sucesso e arquivado.",
  },
];

/**
 * Atualiza o status de um agendamento no Supabase durante a simulação
 */
export async function updateSimulatedStatus({
  appointmentId,
  transportOrderId,
  status,
  userId,
}: {
  appointmentId: string;
  transportOrderId: string;
  status: OpsStatus;
  userId?: string;
}) {
  const isClosing = CLOSING_OPS_STATUS.includes(status);

  // 1. Atualiza o status do agendamento
  const { error: apptError } = await supabase
    .from("appointments")
    .update({
      ops_status: status,
      ...(isClosing ? { status: "concluido" } : {}),
    })
    .eq("id", appointmentId);
  if (apptError) throw apptError;

  // 2. Registra o timestamp correspondente na ordem de transporte
  const timestampCol = opsStatusTimestampColumn[status];
  if (timestampCol) {
    const { error: transportError } = await supabase
      .from("transport_orders")
      .update({
        [timestampCol]: new Date().toISOString(),
      } as TablesUpdate<"transport_orders">)
      .eq("id", transportOrderId);
    if (transportError) console.warn("Erro ao atualizar timestamp de transporte:", transportError);
  }

  // 3. Registra entrada no histórico de status do pet
  const { error: historyError } = await supabase.from("pet_status_history").insert({
    appointment_id: appointmentId,
    status,
    created_by: userId ?? null,
    note: `Simulação de delivery: ${opsStatusLabels[status]}`,
  });
  if (historyError) console.warn("Erro ao inserir histórico:", historyError);
}

/**
 * Cria ou recupera um agendamento de teste com serviço e transporte completo
 * para que qualquer pessoa possa simular o delivery em 1 clique.
 */
export async function createDemoTransportAppointment(userId: string) {
  // 1. Garante ou busca pet de teste
  let petId: string | null = null;
  const { data: existingPets } = await supabase
    .from("pets")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  if (existingPets && existingPets.length > 0 && existingPets[0]) {
    petId = existingPets[0].id;
  } else {
    const { data: newPet, error: petError } = await supabase
      .from("pets")
      .insert({
        owner_id: userId,
        name: "Thor (Simulação)",
        species: "cachorro",
        breed: "Golden Retriever",
        size: "medio",
        weight_kg: 28.5,
      })
      .select("id")
      .single();
    if (petError) throw petError;
    petId = newPet.id;
  }

  // 2. Garante ou busca endereço em Franco da Rocha
  let addressId: string | null = null;
  const { data: existingAddresses } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existingAddresses && existingAddresses.length > 0 && existingAddresses[0]) {
    addressId = existingAddresses[0].id;
  } else {
    const { data: newAddr, error: addrError } = await supabase
      .from("addresses")
      .insert({
        user_id: userId,
        label: "Casa",
        street: "Rua Nelson Rodrigues",
        number: "120",
        district: "Parque Vitória",
        city: "Franco da Rocha",
        state: "SP",
        reference: "Próximo à praça",
      })
      .select("id")
      .single();
    if (addrError) throw addrError;
    addressId = newAddr.id;
  }

  // 3. Busca serviço de Banho e Tosa
  const { data: services } = await supabase
    .from("services")
    .select("id, price_cents")
    .eq("active", true)
    .limit(1);

  const serviceId = services && services[0] ? services[0].id : null;
  const servicePrice = services && services[0] ? services[0].price_cents : 6500;

  // 4. Cria agendamento com logística buscar_e_devolver
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: newAppt, error: apptError } = await supabase
    .from("appointments")
    .insert({
      user_id: userId,
      pet_id: petId,
      service_id: serviceId,
      address_id: addressId,
      scheduled_at: scheduledAt,
      status: "confirmado",
      ops_status: "agendado",
      logistics_type: "buscar_e_devolver",
      service_price_cents: servicePrice,
      transport_price_cents: 2000,
      total_cents: servicePrice + 2000,
      payment_status: "pendente",
      notes: "Atendimento gerado para simulação de delivery",
    })
    .select("id")
    .single();
  if (apptError) throw apptError;

  // 5. Cria ordem de transporte vinculada
  const code = Math.floor(1000 + Math.random() * 9000);
  const { data: transportOrder, error: transportError } = await supabase
    .from("transport_orders")
    .insert({
      appointment_id: newAppt.id,
      address_id: addressId,
      driver_id: userId,
      assigned_at: new Date().toISOString(),
      code,
      price_cents: 2000,
      pickup_lat: TUTOR_HOME_LOCATION.lat,
      pickup_lng: TUTOR_HOME_LOCATION.lng,
      return_lat: TUTOR_HOME_LOCATION.lat,
      return_lng: TUTOR_HOME_LOCATION.lng,
      pickup_notes: "Simulação de delivery Táxi Pet",
    })
    .select("id, code")
    .single();
  if (transportError) throw transportError;

  return {
    appointmentId: newAppt.id,
    transportOrderId: transportOrder.id,
    code: transportOrder.code,
  };
}
