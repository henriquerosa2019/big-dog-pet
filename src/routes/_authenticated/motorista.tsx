import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  CreditCard,
  DollarSign,
  Fuel,
  MapPin,
  MessageCircle,
  Navigation,
  QrCode,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth, useIsAdminStatus, useIsDriver } from "@/hooks/useAuth";
import { getAllManagedDrivers } from "@/lib/driversManager";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVISO_AUTOMATICO_WHATSAPP,
  capitalizeWords,
  formatBRL,
  formatDateTime,
  isAppointmentInService,
  sortInServiceFirst,
  statusToneClass,
  whatsappLinkTo,
} from "@/lib/format";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { formatFullAddress, getGoogleMapsUrl, getWazeUrl } from "@/lib/navigation";
import {
  CLOSING_OPS_STATUS,
  formatOpsStatusWithPet,
  isVehicleAllowedForPet,
  logisticsTypeLabels,
  nextOpsStatus,
  opsStatusLabels,
  opsStatusTimestampColumn,
  opsStatusTone,
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
import { playStatusSound } from "@/lib/soundAlerts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/motorista")({
  validateSearch: (search: Record<string, unknown>) => ({
    driverId: typeof search.driverId === "string" ? search.driverId : undefined,
  }),
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel do motorista | Big Dog Pet" }],
  }),
  component: Motorista,
});

function Motorista() {
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdminStatus(user?.id, user?.email);
  const isDriver = useIsDriver(user?.id, user?.email);
  const hasAccess = isDriver || isAdmin;
  const isCheckingAccess = authLoading || (Boolean(user?.id) && adminLoading && !isDriver);
  const queryClient = useQueryClient();

  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    search.driverId || (isAdmin ? "todos" : user?.id ?? "todos"),
  );

  useEffect(() => {
    if (search.driverId) {
      setSelectedDriverId(search.driverId);
    }
  }, [search.driverId]);

  const { data: profiles } = useQuery({
    queryKey: ["driver-profiles"],
    enabled: hasAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, vehicle_type");
      if (error) throw error;
      return data;
    },
  });

  const allDrivers = useMemo(() => {
    return getAllManagedDrivers(profiles ?? []);
  }, [profiles]);

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
    enabled: hasAccess,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(
          "id, code, appointment_id, driver_id, pickup_notes, price_cents, fee_breakdown, appointments(id, user_id, scheduled_at, ops_status, logistics_type, notes, service_price_cents, transport_price_cents, total_cents, payment_status, payment_method, paid_at, services(name), pets(name, size)), addresses(label, street, number, complement, district, city, state, cep, reference)",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Atualização em tempo real de novas rotas ou avanços de status
  useEffect(() => {
    if (!hasAccess) return;
    const channel = supabase
      .channel("driver-routes-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transport_orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
          playStatusSound("alerta");
          toast.info("🔔 Nova corrida de Táxi Pet disponível! Clique em 'Iniciar Retirada'.");
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transport_orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hasAccess, queryClient]);

  const registerPayment = useMutation({
    mutationFn: async ({
      appointmentId,
      method,
    }: {
      appointmentId: string;
      method: "credito" | "debito" | "pix" | "dinheiro";
    }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          payment_status: "pago",
          payment_method: method,
          paid_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);
      if (error) throw error;
      return method;
    },
    onSuccess: (method) => {
      queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      toast.success(`Pagamento registrado via ${method.toUpperCase()} com sucesso!`);
      playStatusSound("confirmado", 1);
    },
    onError: () => toast.error("Não foi possível registrar o pagamento"),
  });

  const claimRoute = useMutation({
    mutationFn: async (vars: {
      transportOrderId: string;
      appointmentId: string;
      userId?: string;
      petName?: string | null;
    }) => {
      const assignedId =
        isAdmin && selectedDriverId !== "todos"
          ? selectedDriverId
          : (allDrivers[0]?.id || user!.id);

      const nowIso = new Date().toISOString();

      // 1. Atribui motorista na ordem de transporte e grava horário de início de retirada
      const { error: transportError } = await supabase
        .from("transport_orders")
        .update({
          driver_id: assignedId,
          assigned_at: nowIso,
          en_route_pickup_at: nowIso,
        })
        .eq("id", vars.transportOrderId);
      if (transportError) throw transportError;

      // 2. Atualiza o status do agendamento para em_deslocamento_retirada e confirmado
      const { error: apptError } = await supabase
        .from("appointments")
        .update({
          ops_status: "em_deslocamento_retirada",
          status: "confirmado",
        })
        .eq("id", vars.appointmentId);
      if (apptError) throw apptError;

      // 3. Registra no histórico de status do pet
      const { error: historyError } = await supabase.from("pet_status_history").insert({
        appointment_id: vars.appointmentId,
        status: "em_deslocamento_retirada",
        created_by: user!.id,
      });
      if (historyError) throw historyError;

      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["driver-routes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });

      playStatusSound("transporte");
      toast.success(
        `Retirada iniciada! O tutor foi notificado que o motorista está a caminho para buscar ${vars.petName ? capitalizeWords(vars.petName) : "o pet"}.`
      );
    },
    onError: () => toast.error("Não foi possível iniciar a retirada dessa rota"),
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
        .update({
          ops_status: vars.status,
          status: CLOSING_OPS_STATUS.includes(vars.status) ? "concluido" : "confirmado",
        })
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
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });
      toast.success("Status atualizado");

      // Alerta sonoro correspondente à etapa da viagem
      const st = vars.status as string;
      if (st === "em_deslocamento_retirada" || st === "em_rota_devolucao") {
        playStatusSound("transporte");
      } else if (st === "chegou_local_retirada" || st === "chegou_local_entrega") {
        playStatusSound("portao");
      } else if (st === "pet_retirado") {
        playStatusSound("transporte");
      } else if (st === "pet_chegou_petshop") {
        playStatusSound("confirmado");
      } else if (st === "pet_entregue" || st === "finalizado") {
        playStatusSound("concluido");
      }

      // Notificação ao tutor na entrega final
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

  const myRoutes = useMemo(() => {
    const list = (routes ?? []).filter((r) => {
      if (isAdmin) {
        if (selectedDriverId === "todos") return r.driver_id !== null;
        return r.driver_id === selectedDriverId;
      }
      return r.driver_id === user?.id;
    });
    return sortInServiceFirst(list, (r) => isAppointmentInService(r.appointments));
  }, [routes, user?.id, isAdmin, selectedDriverId]);

  const available = useMemo(() => (routes ?? []).filter((r) => r.driver_id === null), [routes]);

  const activeDriver = allDrivers.find((d) => d.id === selectedDriverId);
  const myVehicleType = (
    activeDriver?.vehicle_type ||
    (user?.id ? profileById.get(user.id)?.vehicle_type : null) ||
    "carro"
  ) as VehicleType;

  if (isCheckingAccess) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <div className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Carregando permissões do painel do motorista...
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-3">
        <h1 className="font-display text-2xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é exclusiva para motoristas e administradores do Big Dog Pet.
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">Voltar ao Início</Link>
          </Button>
          <Button asChild className="rounded-xl">
            <Link to="/admin">Painel Admin</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-5">
      {/* 1. SELETOR DE SIMULAÇÃO PARA ADMIN */}
      {isAdmin && (
        <div className="rounded-2xl border-2 border-amber-500/80 bg-amber-500/10 p-3.5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold shadow-xs">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-950 dark:text-amber-200">
                  Modo Administrador & Simulação
                </p>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                  Você pode visualizar e avançar o status das rotas de qualquer motorista para testar os reflexos na tela do tutor e do admin.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="h-9 w-52 rounded-xl text-xs bg-card font-bold border-amber-500/40">
                  <SelectValue placeholder="Visualizar como..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">👁️ Todos os Motoristas</SelectItem>
                  {allDrivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.vehicle_type === "moto" ? "🏍️" : "🚗"} {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1 bg-card">
                <Link to="/admin">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar ao Admin
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CABEÇALHO DA TELA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-3xl border border-border/70 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Táxi Pet & Logística
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5 text-foreground">
            Painel do Motorista
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAdmin && selectedDriverId !== "todos"
              ? `Visualizando rotas de: ${activeDriver?.full_name ?? "Motorista"}`
              : "Suas rotas de retirada e devolução de pets."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-2.5 rounded-xl gap-1.5 font-bold">
            <Truck className="h-3.5 w-3.5 text-primary" />
            {myVehicleType === "moto" ? "🏍️ Veículo Moto" : "🚗 Veículo Carro"}
          </Badge>
        </div>
      </div>

      {/* 3. ROTAS ATRIBUÍDAS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2">
            <span>Rotas Atribuídas</span>
            <Badge className="text-xs font-black px-2 py-0.5 bg-primary text-primary-foreground">
              {myRoutes.length}
            </Badge>
          </h2>
          {myRoutes.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Avance o status para refletir em tempo real para o tutor e a loja.
            </span>
          )}
        </div>

        <div className="space-y-3">
          {myRoutes.map((item) => {
            const assignedDriver = allDrivers.find((d) => d.id === item.driver_id);
            return (
              <RouteCard
                key={item.id}
                item={item}
                driverName={assignedDriver?.full_name || (item.driver_id ? profileById.get(item.driver_id)?.full_name : null)}
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
                onRegisterPayment={(appointmentId, method) =>
                  registerPayment.mutate({ appointmentId, method })
                }
                isPaying={registerPayment.isPending}
              />
            );
          })}
          {myRoutes.length === 0 && (
            <div className="p-6 text-center rounded-2xl border border-dashed border-border bg-card/60">
              <p className="text-sm font-semibold text-muted-foreground">
                Nenhuma rota atribuída no momento.
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                Clique em "Iniciar Retirada" na corrida disponível abaixo para começar o trajeto.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4. ROTAS DISPONÍVEIS PARA ACEITAR */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2">
            <span>Novas Corridas & Rotas Disponíveis</span>
            <Badge variant="secondary" className="text-xs font-black px-2 py-0.5 bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
              {available.length} {available.length === 1 ? "corrida" : "corridas"}
            </Badge>
          </h2>
        </div>

        <div className="space-y-2.5">
          {available.map((item) => {
            const petSize = (item.appointments?.pets?.size as PetSize | undefined) ?? "medio";
            const blocked =
              myVehicleType != null && !isVehicleAllowedForPet(myVehicleType, petSize);
            return (
              <div key={item.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      #{item.code} · {item.appointments?.services?.name ?? "Serviço"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.appointments ? formatDateTime(item.appointments.scheduled_at) : ""}
                      {item.appointments?.pets?.name ? ` · 🐾 ${item.appointments.pets.name}` : ""}
                      {` · Porte ${petSizeLabels[petSize].toLowerCase()}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    Aguardando Início da Retirada
                  </Badge>
                </div>

                {item.addresses && (
                  <p className="text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline h-3.5 w-3.5 text-primary" />
                    {item.addresses.street}
                    {item.addresses.number ? `, ${item.addresses.number}` : ""} —{" "}
                    {item.addresses.district}
                    {item.addresses.city && item.addresses.city.toLowerCase() !== item.addresses.district?.toLowerCase()
                      ? `, ${item.addresses.city}`
                      : ""}
                    {item.addresses.state ? ` - ${item.addresses.state}` : ""}
                  </p>
                )}

                {blocked && (
                  <p className="text-xs font-semibold text-destructive">
                    ⚠️ Seu veículo selecionado é moto — esse pet exige carro.
                  </p>
                )}

                <Button
                  size="sm"
                  className="mt-2 h-10 w-full rounded-xl font-black text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  disabled={claimRoute.isPending || blocked}
                  onClick={() =>
                    claimRoute.mutate({
                      transportOrderId: item.id,
                      appointmentId: item.appointment_id,
                      userId: item.appointments?.user_id,
                      petName: item.appointments?.pets?.name,
                    })
                  }
                >
                  <Truck className="h-4 w-4 shrink-0" />
                  <span>
                    Iniciar Retirada
                    {item.appointments?.pets?.name
                      ? ` · 🐾 ${capitalizeWords(item.appointments.pets.name)}`
                      : ""}
                  </span>
                  {isAdmin && selectedDriverId !== "todos" && activeDriver?.full_name && (
                    <span className="text-[10px] font-semibold opacity-90 hidden sm:inline">
                      ({activeDriver.full_name})
                    </span>
                  )}
                </Button>
              </div>
            );
          })}
          {available.length === 0 && (
            <div className="p-4 text-center rounded-2xl border border-border/60 bg-muted/30">
              <p className="text-xs text-muted-foreground">Nenhuma rota sem motorista no momento.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getDriverActionButtonLabel(nextStatus: OpsStatus, petName?: string | null): string {
  const name = petName ? capitalizeWords(petName) : "Pet";
  switch (nextStatus) {
    case "em_deslocamento_retirada":
      return `🚗 Iniciar Retirada (${name})`;
    case "pet_retirado":
      return `🐾 Confirmar Embarque de ${name}`;
    case "pet_chegou_petshop":
      return `🏬 Confirmar Chegada no Petshop (${name})`;
    case "em_atendimento":
      return `✂️ Iniciar Atendimento de ${name}`;
    case "servico_concluido":
      return `✨ Concluir Atendimento de ${name}`;
    case "em_rota_devolucao":
      return `🚗 Iniciar Devolução (Levar ${name} para Casa)`;
    case "pet_entregue":
      return `🏡 Confirmar Entrega ao Tutor (${name})`;
    case "finalizado":
      return `✅ Finalizar Viagem (${name})`;
    default:
      return `Avançar: ${formatOpsStatusWithPet(nextStatus, petName)}`;
  }
}

function RouteCard({
  item,
  driverName,
  client,
  onAdvance,
  isPending,
  onRegisterPayment,
  isPaying,
}: {
  item: {
    id: string;
    code: number;
    appointment_id: string;
    pickup_notes: string | null;
    price_cents?: number | null;
    fee_breakdown?: unknown;
    appointments: {
      id?: string;
      user_id: string;
      scheduled_at: string;
      ops_status: string;
      logistics_type: string;
      notes: string | null;
      service_price_cents?: number | null;
      transport_price_cents?: number | null;
      total_cents?: number | null;
      payment_status?: string | null;
      payment_method?: string | null;
      paid_at?: string | null;
      services: { name: string } | null;
      pets: { name: string; size: string | null } | null;
    } | null;
    addresses: {
      label: string;
      street: string;
      number: string | null;
      complement: string | null;
      district: string;
      city?: string | null;
      state?: string | null;
      cep?: string | null;
      reference: string | null;
    } | null;
  };
  driverName?: string | null;
  client?: { full_name: string | null; phone: string | null } | undefined;
  onAdvance: (status: OpsStatus) => void;
  isPending: boolean;
  onRegisterPayment: (appointmentId: string, method: "credito" | "debito" | "pix" | "dinheiro") => void;
  isPaying: boolean;
}) {
  const currentStatus = (item.appointments?.ops_status ?? "agendado") as OpsStatus;
  const next = nextOpsStatus(currentStatus);
  const talkLink = whatsappLinkTo(
    client?.phone,
    `Olá${client?.full_name ? `, ${client.full_name}` : ""}! Aqui é o motorista do Big Dog Pet.`,
  );

  const fullAddress = item.addresses ? formatFullAddress(item.addresses) : "";
  const wazeUrl = fullAddress ? getWazeUrl(fullAddress) : "";
  const gmapsUrl = fullAddress ? getGoogleMapsUrl(fullAddress) : "";

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

  const inService = isAppointmentInService(item.appointments);
  const appt = item.appointments;
  const paymentStatus = appt?.payment_status ?? "pendente";
  const isPaid = paymentStatus === "pago";
  const totalCents =
    appt?.total_cents ??
    ((appt?.service_price_cents ?? 0) + (appt?.transport_price_cents ?? item.price_cents ?? 0));
  const rawBreakdown = item.fee_breakdown as
    | { distance_km?: number; fuel_cost_estimate_cents?: number; round_trip?: boolean }
    | undefined
    | null;
  const distanceKm = rawBreakdown?.distance_km;
  const fuelCostCents = rawBreakdown?.fuel_cost_estimate_cents;

  return (
    <div
      className={cn(
        "rounded-2xl p-3 shadow-card transition-all",
        inService
          ? "border-2 border-emerald-500/80 bg-emerald-50/50 dark:border-emerald-500/60 dark:bg-emerald-950/30 ring-1 ring-emerald-400/40 shadow-md"
          : "bg-card",
      )}
    >
      {inService && (
        <div className="mb-2 flex items-center justify-between gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            🟢 Pet em atendimento no petshop
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Início da fila
          </span>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            #{item.code} · {item.appointments?.services?.name ?? "Serviço"}
            {item.appointments?.pets?.name ? ` ${capitalizeWords(item.appointments.pets.name)}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.appointments ? formatDateTime(item.appointments.scheduled_at) : ""}
            {item.appointments?.pets?.name ? ` · ${capitalizeWords(item.appointments.pets.name)}` : ""}
            {client?.full_name ? ` · ${client.full_name}` : ""}
          </p>
          {driverName && (
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 bg-secondary/80 gap-1 border-primary/20">
                <Truck className="h-3 w-3 text-primary" />
                Motorista: {driverName}
              </Badge>
            </div>
          )}
        </div>
        <Badge
          variant="secondary"
          className={cn("shrink-0 font-semibold", statusToneClass(opsStatusTone(currentStatus)))}
        >
          {formatOpsStatusWithPet(currentStatus, item.appointments?.pets?.name)}
        </Badge>
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
          {item.addresses.city && item.addresses.city.toLowerCase() !== item.addresses.district?.toLowerCase()
            ? `, ${item.addresses.city}`
            : ""}
          {item.addresses.state ? ` - ${item.addresses.state}` : ""}
          {item.addresses.reference ? ` (${item.addresses.reference})` : ""}
        </p>
      )}

      {/* Exibição da Distância e Combustível Calculados */}
      {distanceKm != null && (
        <div className="mt-1.5 flex items-center justify-between rounded-xl bg-secondary/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Fuel className="h-3.5 w-3.5 text-primary" />
            Distância total: {distanceKm} km {rawBreakdown?.round_trip ? "(Ida e Volta)" : ""}
          </span>
          {fuelCostCents != null && (
            <span>Combustível est.: <strong className="text-foreground">{formatBRL(fuelCostCents)}</strong></span>
          )}
        </div>
      )}

      {item.appointments?.notes && (
        <p className="mt-1 text-xs text-muted-foreground">Obs.: {item.appointments.notes}</p>
      )}

      {/* Cobrança na Entrega pelo Motorista com 1 toque */}
      <div className="mt-2.5 rounded-xl border border-border/80 bg-background/70 p-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Pagamento na Entrega
          </span>
          <span className="text-xs font-bold text-primary">
            Total: {formatBRL(totalCents)}
          </span>
        </div>

        {isPaid ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ✓ Pago via {appt?.payment_method?.toUpperCase() ?? "PAGO"}
            </span>
            <span className="text-[10px] text-emerald-600/80">
              {appt?.paid_at ? new Date(appt.paid_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Confirmado"}
            </span>
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              Receber agora do tutor (1 toque para registro contábil):
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPaying}
                className="h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => onRegisterPayment(item.appointment_id, "credito")}
              >
                <CreditCard className="h-3 w-3" />
                Crédito
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPaying}
                className="h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
                onClick={() => onRegisterPayment(item.appointment_id, "debito")}
              >
                <CreditCard className="h-3 w-3" />
                Débito
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPaying}
                className="h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border-teal-500/30 text-teal-700 hover:bg-teal-500/10"
                onClick={() => onRegisterPayment(item.appointment_id, "pix")}
              >
                <QrCode className="h-3 w-3" />
                Pix
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPaying}
                className="h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                onClick={() => onRegisterPayment(item.appointment_id, "dinheiro")}
              >
                <DollarSign className="h-3 w-3" />
                Dinheiro
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Botões de Ação Direta: Contato e Navegação de 1 Toque */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            openInAppChat({
              contextTag: `Entrega #${item.code}`,
              petName: item.appointments?.pets?.name,
              defaultText: `Olá! Aqui é o motorista da van do Big Dog Pet a caminho para ${item.appointments?.pets?.name ?? "o pet"}.`,
            })
          }
          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat no App (1 Toque)
        </button>

        {talkLink && (
          <a
            href={talkLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            WhatsApp
          </a>
        )}

        {fullAddress && (
          <>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-600 hover:bg-sky-500/20 dark:text-sky-400 transition-colors"
              title={`Navegar no Waze até ${fullAddress}`}
            >
              <Navigation className="h-3.5 w-3.5" />
              📍 Waze
            </a>
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 transition-colors"
              title={`Navegar no Google Maps até ${fullAddress}`}
            >
              <Compass className="h-3.5 w-3.5" />
              🗺️ Google Maps
            </a>
          </>
        )}
      </div>

      {next && (
        <Button
          size="sm"
          className={cn(
            "mt-2 h-10 w-full rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2",
            next === "em_deslocamento_retirada"
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : next === "pet_retirado"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : next === "pet_chegou_petshop"
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : next === "em_rota_devolucao"
                    ? "bg-sky-600 hover:bg-sky-700 text-white"
                    : next === "pet_entregue" || next === "finalizado"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-primary text-primary-foreground"
          )}
          disabled={isPending}
          onClick={() => onAdvance(next)}
        >
          {getDriverActionButtonLabel(next, item.appointments?.pets?.name)}
        </Button>
      )}

      <TransportHistoryList
        appointmentId={item.appointment_id}
        currentStatus={currentStatus}
        petName={item.appointments?.pets?.name}
      />
    </div>
  );
}
