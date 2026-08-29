import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { MapPin, MessageCircle, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth, useIsDriver } from "@/hooks/useAuth";
import { AVISO_AUTOMATICO_WHATSAPP, formatDateTime, whatsappLinkTo } from "@/lib/format";
import {
  isVehicleAllowedForPet,
  logisticsTypeLabels,
  nextOpsStatus,
  opsStatusLabels,
  opsStatusTimestampColumn,
  opsStatusTutorMessage,
  petSizeLabels,
  type LogisticsType,
  type OpsStatus,
  type PetSize,
  type VehicleType,
} from "@/lib/transport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransportHistoryList } from "@/components/TransportHistoryList";
import { useDriverLocationBroadcast } from "@/lib/driverLocation";

export const Route = createFileRoute("/_authenticated/motorista")({
  head: () => ({
    meta: [{ title: "Painel do motorista | Big Dog Pet" }],
  }),
  component: Motorista,
});

function Motorista() {
  const { user } = useAuth();
  const isDriver = useIsDriver(user?.id);
  const queryClient = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ["driver-profiles"],
    enabled: isDriver,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, vehicle_type");
      if (error) throw error;
      return data;
    },
  });

  const profileById = useMemo(() => {
    const map = new Map<
      string,
      { full_name: string | null; phone: string | null; vehicle_type: string | null }
    >();
    for (const p of profiles ?? [])
      map.set(p.id, { full_name: p.full_name, phone: p.phone, vehicle_type: p.vehicle_type });
    return map;
  }, [profiles]);

  const { data: routes } = useQuery({
    queryKey: ["driver-routes"],
    enabled: isDriver,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(
          "id, code, appointment_id, driver_id, pickup_notes, appointments(user_id, scheduled_at, ops_status, logistics_type, notes, services(name), pets(name, size)), addresses(label, street, number, complement, district, reference)",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const claimRoute = useMutation({
    mutationFn: async (transportOrderId: string) => {
      const { error } = await supabase
        .from("transport_orders")
        .update({ driver_id: user!.id, assigned_at: new Date().toISOString() })
        .eq("id", transportOrderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
      toast.success("Rota aceita! Avance o status conforme for buscando o pet.");
    },
    onError: () => toast.error("Não foi possível aceitar essa rota"),
  });

  const advanceStatus = useMutation({
    mutationFn: async (vars: {
      appointmentId: string;
      transportOrderId: string;
      status: OpsStatus;
      userId: string;
      petName?: string | null;
    }) => {
      const { error: apptError } = await supabase
        .from("appointments")
        .update({ ops_status: vars.status })
        .eq("id", vars.appointmentId);
      if (apptError) throw apptError;

      const timestampColumn = opsStatusTimestampColumn[vars.status];
      if (timestampColumn) {
        const { error: transportError } = await supabase
          .from("transport_orders")
          .update({
            [timestampColumn]: new Date().toISOString(),
          } as TablesUpdate<"transport_orders">)
          .eq("id", vars.transportOrderId);
        if (transportError) throw transportError;
      }

      const { error: historyError } = await supabase.from("pet_status_history").insert({
        appointment_id: vars.appointmentId,
        status: vars.status,
        created_by: user!.id,
      });
      if (historyError) throw historyError;
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
      toast.success("Status atualizado");
      // Pedido do Henrique 2026-08-29: o tutor só recebe WhatsApp na entrega final,
      // pra não receber mensagem a cada etapa do transporte.
      const notifyOn: OpsStatus[] = ["pet_entregue"];
      if (AVISO_AUTOMATICO_WHATSAPP && notifyOn.includes(vars.status)) {
        const client = profileById.get(vars.userId);
        const message = `Olá${client?.full_name ? `, ${client.full_name}` : ""}! ${opsStatusTutorMessage[vars.status]}${vars.petName ? ` (${vars.petName})` : ""}`;
        const link = whatsappLinkTo(client?.phone, message);
        if (link) window.open(link, "_blank", "noopener,noreferrer");
      }
    },
    onError: () => toast.error("Não foi possível atualizar o status"),
  });

  if (!isDriver) {
    return (
      <div className="p-4">
        <h1 className="font-display text-2xl">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva para motoristas do Big Dog Pet.
        </p>
      </div>
    );
  }

  const myRoutes = (routes ?? []).filter((r) => r.driver_id === user?.id);
  const available = (routes ?? []).filter((r) => r.driver_id === null);
  const myVehicleType = (user?.id ? profileById.get(user.id)?.vehicle_type : null) as
    VehicleType | null | undefined;

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl">Painel do motorista</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suas rotas de retirada e devolução de pets.
      </p>

      <section className="mt-5">
        <h2 className="font-display text-lg">Minhas rotas</h2>
        <div className="mt-2 space-y-2">
          {myRoutes.map((item) => (
            <RouteCard
              key={item.id}
              item={item}
              client={item.appointments ? profileById.get(item.appointments.user_id) : undefined}
              onAdvance={(status) =>
                item.appointments &&
                advanceStatus.mutate({
                  appointmentId: item.appointment_id,
                  transportOrderId: item.id,
                  status,
                  userId: item.appointments.user_id,
                  petName: item.appointments.pets?.name ?? null,
                })
              }
              isPending={advanceStatus.isPending}
            />
          ))}
          {myRoutes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma rota atribuída a você ainda.</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg">Disponíveis para aceitar</h2>
        <div className="mt-2 space-y-2">
          {available.map((item) => {
            const petSize = (item.appointments?.pets?.size as PetSize | undefined) ?? "medio";
            const blocked =
              myVehicleType != null && !isVehicleAllowedForPet(myVehicleType, petSize);
            return (
              <div key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
                <p className="text-sm font-semibold">
                  #{item.code} · {item.appointments?.services?.name ?? "Serviço"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.appointments ? formatDateTime(item.appointments.scheduled_at) : ""}
                  {item.appointments?.pets?.name ? ` · ${item.appointments.pets.name}` : ""}
                  {` · Porte ${petSizeLabels[petSize].toLowerCase()}`}
                </p>
                {item.addresses && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline h-3.5 w-3.5" />
                    {item.addresses.street}
                    {item.addresses.number ? `, ${item.addresses.number}` : ""} —{" "}
                    {item.addresses.district}
                  </p>
                )}
                {blocked && (
                  <p className="mt-1 text-xs font-semibold text-destructive">
                    Seu veículo é moto — esse pet exige carro.
                  </p>
                )}
                <Button
                  size="sm"
                  className="mt-2 h-9 w-full rounded-xl"
                  disabled={claimRoute.isPending || blocked}
                  onClick={() => claimRoute.mutate(item.id)}
                >
                  Aceitar rota
                </Button>
              </div>
            );
          })}
          {available.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma rota disponível no momento.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function RouteCard({
  item,
  client,
  onAdvance,
  isPending,
}: {
  item: {
    id: string;
    code: number;
    appointment_id: string;
    pickup_notes: string | null;
    appointments: {
      user_id: string;
      scheduled_at: string;
      ops_status: string;
      logistics_type: string;
      notes: string | null;
      services: { name: string } | null;
      pets: { name: string; size: string | null } | null;
    } | null;
    addresses: {
      label: string;
      street: string;
      number: string | null;
      complement: string | null;
      district: string;
      reference: string | null;
    } | null;
  };
  client?: { full_name: string | null; phone: string | null } | undefined;
  onAdvance: (status: OpsStatus) => void;
  isPending: boolean;
}) {
  const currentStatus = (item.appointments?.ops_status ?? "agendado") as OpsStatus;
  const next = nextOpsStatus(currentStatus);
  const talkLink = whatsappLinkTo(
    client?.phone,
    `Olá${client?.full_name ? `, ${client.full_name}` : ""}! Aqui é o motorista do Big Dog Pet.`,
  );

  // Compartilha o GPS ao vivo com o tutor/admin só enquanto o motorista
  // estiver de fato em deslocamento (retirada ou devolução) — pedido do
  // Henrique 2026-08-29, canal privado via Supabase Realtime, ver
  // src/lib/driverLocation.ts.
  const isEnRoute =
    currentStatus === "em_deslocamento_retirada" || currentStatus === "em_rota_devolucao";
  const { sharing, error: locationError } = useDriverLocationBroadcast(
    item.appointment_id,
    isEnRoute,
  );

  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            #{item.code} · {item.appointments?.services?.name ?? "Serviço"}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.appointments ? formatDateTime(item.appointments.scheduled_at) : ""}
            {item.appointments?.pets?.name ? ` · ${item.appointments.pets.name}` : ""}
            {client?.full_name ? ` · ${client.full_name}` : ""}
          </p>
        </div>
        <Badge className="shrink-0">{opsStatusLabels[currentStatus]}</Badge>
      </div>

      {isEnRoute && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
          <MapPin className="h-3 w-3 shrink-0" />
          {sharing
            ? "Compartilhando localização ao vivo"
            : locationError
              ? locationError
              : "Ativando GPS..."}
        </p>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        {item.appointments
          ? logisticsTypeLabels[item.appointments.logistics_type as LogisticsType]
          : ""}
        {item.appointments?.pets?.size
          ? ` · Porte ${petSizeLabels[item.appointments.pets.size as PetSize].toLowerCase()}`
          : ""}
      </p>
      {item.addresses && (
        <p className="text-xs text-muted-foreground">
          <Truck className="mr-1 inline h-3.5 w-3.5" />
          {item.addresses.street}
          {item.addresses.number ? `, ${item.addresses.number}` : ""}
          {item.addresses.complement ? ` - ${item.addresses.complement}` : ""} —{" "}
          {item.addresses.district}
          {item.addresses.reference ? ` (${item.addresses.reference})` : ""}
        </p>
      )}
      {item.appointments?.notes && (
        <p className="mt-1 text-xs text-muted-foreground">Obs.: {item.appointments.notes}</p>
      )}

      {talkLink && (
        <a
          href={talkLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Falar com o tutor
        </a>
      )}

      {next && (
        <Button
          size="sm"
          className="mt-2 h-9 w-full rounded-xl"
          disabled={isPending}
          onClick={() => onAdvance(next)}
        >
          Avançar: {opsStatusLabels[next]}
        </Button>
      )}

      <TransportHistoryList appointmentId={item.appointment_id} />
    </div>
  );
}
