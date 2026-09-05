import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Gift,
  LogOut,
  MapPin,
  PawPrint,
  Pencil,
  Plus,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchAddressByCep, maskCep } from "@/lib/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  alertTone,
  appointmentStatusTone,
  birthdayCouponCode,
  capitalizeWords,
  CLINIC,
  daysUntil,
  formatBRL,
  formatDate,
  formatDateTime,
  isBirthdayToday,
  isBirthdayTomorrow,
  orderStatusTone,
  statusToneCardClass,
  statusToneClass,
  statusToneIconClass,
  whatsappLink,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransportHistoryList } from "@/components/TransportHistoryList";
import { DriverContact } from "@/components/DriverContact";
import { DriverLiveMap } from "@/components/DriverLiveMap";
import { cn } from "@/lib/utils";
import {
  formatOpsStatusWithPet,
  getOpsStatusTutorMessage,
  logisticsTypeLabels,
  opsStatusLabels,
  opsStatusTone,
  type LogisticsType,
  type OpsStatus,
} from "@/lib/transport";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta | Big Dog Pet" },
      {
        name: "description",
        content:
          "Acompanhe seus agendamentos, pedidos e pets cadastrados no Big Dog Pet.",
      },
      { property: "og:title", content: "Minha conta | Big Dog Pet" },
      { property: "og:description", content: "Seus agendamentos, pedidos e pets em um só lugar." },
    ],
  }),
  component: Conta,
});

function Conta() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, birth_date")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, status, notes, logistics_type, ops_status, transport_price_cents, services(name, price_cents), pets(name)",
        )
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_cents, status, created_at, order_items(product_name, quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  type ApptFilter = "abertos" | "concluidos" | "cancelados" | "todos";
  const [apptFilter, setApptFilter] = useState<ApptFilter>("abertos");

  const apptFilterLabels: Record<ApptFilter, string> = {
    abertos: "Em andamento / Em aberto",
    concluidos: "Concluídos",
    cancelados: "Cancelados",
    todos: "Todos os agendamentos",
  };

  type OrderFilter = "abertos" | "entregues" | "cancelados" | "todos";
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("abertos");

  const orderFilterLabels: Record<OrderFilter, string> = {
    abertos: "Em andamento / Em aberto",
    entregues: "Entregues",
    cancelados: "Cancelados",
    todos: "Todos os pedidos",
  };

  function isAppointmentOpen(item: { status: string; ops_status?: string | null }) {
    if (item.status === "cancelado" || item.ops_status === "cancelado") return false;
    if (item.ops_status === "finalizado" || item.ops_status === "pet_entregue") return false;
    if (item.status === "concluido" && item.ops_status !== "em_rota_devolucao") return false;
    return true;
  }

  function isAppointmentConcluded(item: { status: string; ops_status?: string | null }) {
    if (item.status === "cancelado" || item.ops_status === "cancelado") return false;
    return (
      item.status === "concluido" ||
      item.ops_status === "finalizado" ||
      item.ops_status === "pet_entregue"
    );
  }

  function isAppointmentCancelled(item: { status: string; ops_status?: string | null }) {
    return item.status === "cancelado" || item.ops_status === "cancelado";
  }

  const openAppts = useMemo(() => (appointments ?? []).filter(isAppointmentOpen), [appointments]);
  const concludedAppts = useMemo(
    () => (appointments ?? []).filter(isAppointmentConcluded),
    [appointments],
  );
  const cancelledAppts = useMemo(
    () => (appointments ?? []).filter(isAppointmentCancelled),
    [appointments],
  );

  const filteredAppointments = useMemo(() => {
    switch (apptFilter) {
      case "abertos":
        return openAppts;
      case "concluidos":
        return concludedAppts;
      case "cancelados":
        return cancelledAppts;
      case "todos":
      default:
        return appointments ?? [];
    }
  }, [apptFilter, openAppts, concludedAppts, cancelledAppts, appointments]);

  function isOrderOpen(order: { status: string }) {
    return order.status === "novo" || order.status === "em_preparo";
  }

  function isOrderDelivered(order: { status: string }) {
    return order.status === "entregue";
  }

  function isOrderCancelled(order: { status: string }) {
    return order.status === "cancelado";
  }

  const openOrders = useMemo(() => (orders ?? []).filter(isOrderOpen), [orders]);
  const deliveredOrders = useMemo(() => (orders ?? []).filter(isOrderDelivered), [orders]);
  const cancelledOrders = useMemo(() => (orders ?? []).filter(isOrderCancelled), [orders]);

  const filteredOrders = useMemo(() => {
    switch (orderFilter) {
      case "abertos":
        return openOrders;
      case "entregues":
        return deliveredOrders;
      case "cancelados":
        return cancelledOrders;
      case "todos":
      default:
        return orders ?? [];
    }
  }, [orderFilter, openOrders, deliveredOrders, cancelledOrders, orders]);

  const { data: tutorAddresses } = useQuery({
    queryKey: ["tutor-addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, label, cep, street, number, complement, district, city, state, reference, is_default")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "Franco da Rocha",
    state: "SP",
    reference: "",
  });
  const [isAddressCepLoading, setIsAddressCepLoading] = useState(false);

  async function handleTutorCepChange(val: string) {
    const masked = maskCep(val);
    setAddressForm((prev) => ({ ...prev, cep: masked }));
    const raw = val.replace(/\D/g, "");
    if (raw.length === 8) {
      setIsAddressCepLoading(true);
      try {
        const info = await fetchAddressByCep(raw);
        if (info) {
          setAddressForm((prev) => ({
            ...prev,
            cep: masked,
            street: info.logradouro || prev.street,
            district: info.bairro || prev.district,
            city: info.localidade || prev.city,
            state: info.uf || prev.state,
          }));
          toast.success("Endereço preenchido pelo CEP!");
        }
      } finally {
        setIsAddressCepLoading(false);
      }
    }
  }

  const saveAddress = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Não autenticado");
      if (!addressForm.street.trim()) throw new Error("Informe a rua ou logradouro");
      if (!addressForm.district.trim()) throw new Error("Informe o bairro");

      if (editingAddressId) {
        const { error } = await supabase
          .from("addresses")
          .update({
            cep: addressForm.cep.trim() || null,
            street: addressForm.street.trim(),
            number: addressForm.number.trim() || null,
            complement: addressForm.complement.trim() || null,
            district: addressForm.district.trim(),
            city: addressForm.city.trim() || "Franco da Rocha",
            state: addressForm.state.trim() || "SP",
            reference: addressForm.reference.trim() || null,
          })
          .eq("id", editingAddressId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("addresses").insert({
          user_id: user.id,
          label: "Casa",
          cep: addressForm.cep.trim() || null,
          street: addressForm.street.trim(),
          number: addressForm.number.trim() || null,
          complement: addressForm.complement.trim() || null,
          district: addressForm.district.trim(),
          city: addressForm.city.trim() || "Franco da Rocha",
          state: addressForm.state.trim() || "SP",
          reference: addressForm.reference.trim() || null,
          is_default: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-addresses", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-home-address", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
      toast.success(editingAddressId ? "Endereço atualizado com sucesso!" : "Endereço cadastrado com sucesso!");
      setShowAddressForm(false);
      setEditingAddressId(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar endereço");
    },
  });

  // Atualiza a tela ao vivo quando o motorista ou o admin muda o status de
  // um agendamento (ex.: "a caminho da retirada") — antes só atualizava ao
  // recarregar a página. Pedido do Henrique 2026-08-29, junto do
  // rastreamento por GPS.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`tutor-appointments-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["appointments", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const { data: pets } = useQuery({
    queryKey: ["pets", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed, allergies, birth_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: vaccineAlerts } = useQuery({
    queryKey: ["vaccine-alerts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("vaccinations")
        .select("id, vaccine_name, next_due_at, pet_id, pets(name)")
        .not("next_due_at", "is", null)
        .lte("next_due_at", limit)
        .order("next_due_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: returnAlerts } = useQuery({
    queryKey: ["return-alerts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("care_reminders")
        .select("id, reminder_type, title, due_date, pet_id, pets(name)")
        .eq("completed", false)
        .lte("due_date", limit)
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });

  // Junta vacina + retorno + aniversário (dono e pets) num único painel de
  // avisos, com destaque para "hoje"/"amanhã" — pedido do Henrique 2026-08-14
  // pra o tutor ver tudo relevante assim que loga, num período de 30 dias.
  type Aviso = {
    key: string;
    kind: "vacina" | "retorno" | "aniversario";
    label: string;
    petName?: string | undefined;
    days: number;
    dueDate?: string | undefined;
    whatsappMessage?: string | undefined;
    /** Só presente em avisos de aniversário — leva pro card de aniversário
     * completo (cupom, validade, CTA pra loja) em vez de abrir o WhatsApp direto. */
    couponCode?: string | undefined;
  };

  const avisos = useMemo(() => {
    const items: Aviso[] = [];

    for (const v of vaccineAlerts ?? []) {
      items.push({
        key: `vacina-${v.id}`,
        kind: "vacina",
        label: v.vaccine_name,
        petName: v.pets?.name ? capitalizeWords(v.pets.name) : undefined,
        days: daysUntil(v.next_due_at!),
        dueDate: v.next_due_at!,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar o reforço da vacina ${v.vaccine_name} do meu pet ${v.pets?.name ?? ""}.`,
      });
    }

    for (const r of returnAlerts ?? []) {
      items.push({
        key: `retorno-${r.id}`,
        kind: "retorno",
        label: r.title,
        petName: r.pets?.name ? capitalizeWords(r.pets.name) : undefined,
        days: daysUntil(r.due_date),
        dueDate: r.due_date,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar: ${r.title} do meu pet ${r.pets?.name ?? ""}.`,
      });
    }

    if (isBirthdayToday(profile?.birth_date)) {
      items.push({
        key: "aniversario-dono",
        kind: "aniversario",
        label: "Seu aniversário",
        days: 0,
        couponCode: birthdayCouponCode(profile?.full_name),
      });
    } else if (isBirthdayTomorrow(profile?.birth_date)) {
      items.push({
        key: "aniversario-dono",
        kind: "aniversario",
        label: "Seu aniversário",
        days: 1,
        couponCode: birthdayCouponCode(profile?.full_name),
      });
    }

    for (const pet of pets ?? []) {
      if (isBirthdayToday(pet.birth_date)) {
        items.push({
          key: `aniversario-pet-${pet.id}`,
          kind: "aniversario",
          label: `Aniversário de ${capitalizeWords(pet.name)}`,
          days: 0,
          couponCode: birthdayCouponCode(pet.name),
        });
      } else if (isBirthdayTomorrow(pet.birth_date)) {
        items.push({
          key: `aniversario-pet-${pet.id}`,
          kind: "aniversario",
          label: `Aniversário de ${capitalizeWords(pet.name)}`,
          days: 1,
          couponCode: birthdayCouponCode(pet.name),
        });
      }
    }

    return items.sort((a, b) => a.days - b.days);
  }, [vaccineAlerts, returnAlerts, profile?.birth_date, pets]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Você saiu da sua conta");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl">
            Olá, {profile?.full_name ?? "tutor"}!
          </h1>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="secondary" size="icon" onClick={signOut} aria-label="Sair da conta">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {avisos.length > 0 && (
        <section className="mt-5 space-y-2">
          <h2 className="font-display text-lg">Avisos</h2>
          <p className="text-xs text-muted-foreground">
            Vacinas e retornos dos próximos 30 dias, e aniversários de hoje e amanhã.
          </p>
          {avisos.map((item) => {
            const tone = item.kind === "aniversario" ? "success" : alertTone(item.days);
            return (
              <div
                key={item.key}
                className={cn(
                  "flex items-start gap-2 rounded-2xl border-2 p-3",
                  statusToneCardClass(tone),
                )}
              >
                {item.kind === "aniversario" ? (
                  <Gift className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                ) : (
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                )}
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {item.petName ? `${item.petName} · ` : ""}
                      {item.label}
                    </p>
                    <Badge variant="secondary" className={cn("shrink-0 whitespace-nowrap", statusToneClass(tone))}>
                      {item.days < 0
                        ? "Atrasado"
                        : item.days === 0
                          ? "Hoje"
                          : item.days === 1
                            ? "Amanhã"
                            : `Em ${item.days} dias`}
                    </Badge>
                  </div>
                  {item.dueDate && (
                    <p className="text-muted-foreground">Data: {formatDate(item.dueDate)}</p>
                  )}
                  {item.kind === "aniversario" && item.couponCode && (
                    <>
                      <p className="mt-1.5 inline-block rounded-lg border-2 border-dashed border-gold/60 bg-background px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-gold">
                        {item.couponCode}
                      </p>
                      <Link
                        to="/agendar"
                        search={{ campanha: "niver", cupom: item.couponCode }}
                        className="mt-1 block font-semibold text-primary underline"
                      >
                        Ver cupom de aniversário
                      </Link>
                    </>
                  )}
                  {item.whatsappMessage && (
                    <a
                      className="mt-1 inline-block font-semibold text-primary underline"
                      href={whatsappLink(item.whatsappMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Falar no WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg">Meus agendamentos e serviços</h2>
            <p className="text-xs text-muted-foreground">
              {apptFilter === "abertos"
                ? "Mostrando apenas em andamento / em aberto"
                : `Filtro: ${apptFilterLabels[apptFilter]}`}
            </p>
          </div>
          <Link to="/agendar" className="text-xs font-semibold text-primary underline shrink-0">
            Novo agendamento
          </Link>
        </div>

        {/* Filtros de Agendamento */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setApptFilter("abertos")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              apptFilter === "abertos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Em andamento ({openAppts.length})
          </button>
          <button
            type="button"
            onClick={() => setApptFilter("concluidos")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              apptFilter === "concluidos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Concluídos ({concludedAppts.length})
          </button>
          <button
            type="button"
            onClick={() => setApptFilter("cancelados")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              apptFilter === "cancelados"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Cancelados ({cancelledAppts.length})
          </button>
          <button
            type="button"
            onClick={() => setApptFilter("todos")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              apptFilter === "todos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Todos ({appointments?.length ?? 0})
          </button>
        </div>

        {/* Barra com Botão Fechar Filtro para voltar à posição anterior */}
        {apptFilter !== "abertos" && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <span>
              Visualizando <strong>{apptFilterLabels[apptFilter]}</strong> ({filteredAppointments.length})
            </span>
            <button
              type="button"
              onClick={() => setApptFilter("abertos")}
              className="flex items-center gap-1 font-bold underline hover:opacity-80 transition-opacity"
              title="Voltar para em andamento"
            >
              <X className="h-3.5 w-3.5" />
              Fechar filtro
            </button>
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {filteredAppointments.map((item) => {
            const hasTransport = item.logistics_type && item.logistics_type !== "levar";
            return (
              <li key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.services?.name ?? "Serviço"}
                      {item.pets?.name ? ` ${capitalizeWords(item.pets.name)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.scheduled_at)}
                      {item.pets?.name ? ` · ${capitalizeWords(item.pets.name)}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0 capitalize", statusToneClass(appointmentStatusTone(item.status)))}
                  >
                    {item.status}
                  </Badge>
                </div>
                {hasTransport && (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {logisticsTypeLabels[item.logistics_type as LogisticsType]}
                        {item.transport_price_cents > 0 &&
                          ` · ${formatBRL(item.transport_price_cents)}`}
                      </p>
                      <Badge
                        variant="secondary"
                        className={cn("shrink-0", statusToneClass(opsStatusTone(item.ops_status ?? "agendado")))}
                      >
                        {formatOpsStatusWithPet(item.ops_status as OpsStatus, item.pets?.name)}
                      </Badge>
                    </div>
                    {item.ops_status && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        "{getOpsStatusTutorMessage(item.ops_status, item.pets?.name)}"
                      </p>
                    )}
                    {item.ops_status && item.ops_status !== "agendado" && (
                      <DriverContact appointmentId={item.id} />
                    )}
                    <DriverLiveMap
                      appointmentId={item.id}
                      active={
                        item.ops_status === "em_deslocamento_retirada" ||
                        item.ops_status === "em_rota_devolucao"
                      }
                    />
                    <TransportHistoryList
                      appointmentId={item.id}
                      currentStatus={item.ops_status ?? undefined}
                      petName={item.pets?.name}
                    />
                  </div>
                )}
              </li>
            );
          })}
          {filteredAppointments.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {apptFilter === "abertos"
                  ? "Nenhum agendamento em andamento no momento."
                  : `Nenhum agendamento com status "${apptFilterLabels[apptFilter].toLowerCase()}" encontrado.`}
              </p>
              {apptFilter === "abertos" && (concludedAppts.length > 0 || cancelledAppts.length > 0) && (
                <button
                  type="button"
                  onClick={() => setApptFilter("concluidos")}
                  className="mt-2 inline-block text-xs font-semibold text-primary underline"
                >
                  Ver histórico de agendamentos ({concludedAppts.length} concluído(s))
                </button>
              )}
            </li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg">Meus pedidos</h2>
            <p className="text-xs text-muted-foreground">
              {orderFilter === "abertos"
                ? "Mostrando apenas pedidos em andamento"
                : `Filtro: ${orderFilterLabels[orderFilter]}`}
            </p>
          </div>
          <Link to="/loja" className="text-xs font-semibold text-primary underline shrink-0">
            Ir para a loja
          </Link>
        </div>

        {/* Filtros de Pedidos */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setOrderFilter("abertos")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              orderFilter === "abertos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Em andamento ({openOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderFilter("entregues")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              orderFilter === "entregues"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Entregues ({deliveredOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderFilter("cancelados")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              orderFilter === "cancelados"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Cancelados ({cancelledOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderFilter("todos")}
            className={cn(
              "rounded-full px-3 py-1 font-semibold transition-all shrink-0",
              orderFilter === "todos"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            Todos ({orders?.length ?? 0})
          </button>
        </div>

        {/* Barra com Botão Fechar Filtro para voltar à posição anterior */}
        {orderFilter !== "abertos" && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <span>
              Visualizando <strong>{orderFilterLabels[orderFilter]}</strong> ({filteredOrders.length})
            </span>
            <button
              type="button"
              onClick={() => setOrderFilter("abertos")}
              className="flex items-center gap-1 font-bold underline hover:opacity-80 transition-opacity"
              title="Voltar para em andamento"
            >
              <X className="h-3.5 w-3.5" />
              Fechar filtro
            </button>
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {filteredOrders.map((order) => (
            <li key={order.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                  <Badge
                    variant="secondary"
                    className={cn("capitalize text-[10px] px-1.5 py-0.2", statusToneClass(orderStatusTone(order.status)))}
                  >
                    {order.status === "novo"
                      ? "Novo"
                      : order.status === "em_preparo"
                        ? "Em preparo"
                        : order.status === "entregue"
                          ? "Entregue"
                          : order.status === "cancelado"
                            ? "Cancelado"
                            : order.status}
                  </Badge>
                </div>
                <span className="font-display text-sm text-primary">
                  {formatBRL(order.total_cents)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
              </p>
            </li>
          ))}
          {filteredOrders.length === 0 && (
            <li className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-4">
              <ShoppingBag className="h-6 w-6 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {orderFilter === "abertos"
                    ? "Nenhum pedido em andamento no momento."
                    : `Nenhum pedido com status "${orderFilterLabels[orderFilter].toLowerCase()}" encontrado.`}
                </p>
                {orderFilter === "abertos" && (deliveredOrders.length > 0 || cancelledOrders.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setOrderFilter("entregues")}
                    className="mt-1 text-xs font-semibold text-primary underline block"
                  >
                    Ver pedidos anteriores ({deliveredOrders.length} entregue(s))
                  </button>
                )}
                <Link
                  to="/loja"
                  className="mt-2 inline-block text-xs font-semibold text-primary underline"
                >
                  Ir para a loja
                </Link>
              </div>
            </li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg">Meus pets</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Toque no pet para ver a ficha, vacinas e prontuário.
        </p>
        <ul className="mt-3 space-y-2">
          {(pets ?? []).map((pet) => (
            <li key={pet.id}>
              <Link
                to="/pets/$petId"
                params={{ petId: pet.id }}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <PawPrint className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{capitalizeWords(pet.name)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pet.species}
                    {pet.breed ? ` · ${pet.breed}` : ""}
                    {pet.allergies ? ` · alergias: ${pet.allergies}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {(pets ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              Cadastre seu pet ao fazer o primeiro agendamento.
            </li>
          )}
        </ul>
      </section>

      {/* Seção Meu Endereço (Táxi Pet / Delivery) */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-lg">Meu endereço</h2>
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
              Táxi Pet
            </Badge>
          </div>
          {!showAddressForm && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs gap-1"
              onClick={() => {
                const defaultAddr = tutorAddresses?.[0];
                if (defaultAddr) {
                  setEditingAddressId(defaultAddr.id);
                  setAddressForm({
                    cep: defaultAddr.cep ?? "",
                    street: defaultAddr.street ?? "",
                    number: defaultAddr.number ?? "",
                    complement: defaultAddr.complement ?? "",
                    district: defaultAddr.district ?? "",
                    city: defaultAddr.city ?? "Franco da Rocha",
                    state: defaultAddr.state ?? "SP",
                    reference: defaultAddr.reference ?? "",
                  });
                } else {
                  setEditingAddressId(null);
                  setAddressForm({
                    cep: "",
                    street: "",
                    number: "",
                    complement: "",
                    district: "",
                    city: "Franco da Rocha",
                    state: "SP",
                    reference: "",
                  });
                }
                setShowAddressForm(true);
              }}
            >
              {tutorAddresses && tutorAddresses.length > 0 ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar
                </>
              )}
            </Button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Usado para buscar e devolver seu pet no conforto do seu lar.
        </p>

        {showAddressForm ? (
          <div className="mt-3 rounded-2xl bg-card p-3 shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">
                {editingAddressId ? "Editar endereço" : "Novo endereço"}
              </span>
              {isAddressCepLoading && (
                <span className="text-[10px] font-semibold text-primary animate-pulse">
                  Buscando CEP...
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="tutor-cep" className="text-[11px] text-muted-foreground">
                  CEP
                </Label>
                <Input
                  id="tutor-cep"
                  placeholder="00000-000"
                  maxLength={9}
                  value={addressForm.cep}
                  onChange={(e) => handleTutorCepChange(e.target.value)}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="tutor-street" className="text-[11px] text-muted-foreground">
                  Rua / Logradouro
                </Label>
                <Input
                  id="tutor-street"
                  placeholder="Ex: Rua Nelson Rodrigues"
                  maxLength={150}
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="tutor-num" className="text-[11px] text-muted-foreground">
                  Número
                </Label>
                <Input
                  id="tutor-num"
                  placeholder="Ex: 120"
                  maxLength={20}
                  value={addressForm.number}
                  onChange={(e) => setAddressForm({ ...addressForm, number: e.target.value })}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="tutor-comp" className="text-[11px] text-muted-foreground">
                  Complemento
                </Label>
                <Input
                  id="tutor-comp"
                  placeholder="Ex: Apto 42"
                  maxLength={50}
                  value={addressForm.complement}
                  onChange={(e) => setAddressForm({ ...addressForm, complement: e.target.value })}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="tutor-dist" className="text-[11px] text-muted-foreground">
                  Bairro
                </Label>
                <Input
                  id="tutor-dist"
                  placeholder="Ex: Centro"
                  maxLength={100}
                  value={addressForm.district}
                  onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tutor-ref" className="text-[11px] text-muted-foreground">
                  Ponto de referência
                </Label>
                <Input
                  id="tutor-ref"
                  placeholder="Ex: Portão branco"
                  maxLength={150}
                  value={addressForm.reference}
                  onChange={(e) => setAddressForm({ ...addressForm, reference: e.target.value })}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="h-9 flex-1 rounded-xl"
                disabled={saveAddress.isPending}
                onClick={() => saveAddress.mutate()}
              >
                {saveAddress.isPending ? "Salvando..." : "Salvar endereço"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 rounded-xl"
                onClick={() => {
                  setShowAddressForm(false);
                  setEditingAddressId(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {(tutorAddresses ?? []).map((addr) => (
              <div
                key={addr.id}
                className="flex items-start justify-between gap-2 rounded-2xl bg-card p-3 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">
                      {addr.street}{addr.number ? `, ${addr.number}` : ""}
                    </p>
                    {addr.is_default && (
                      <Badge variant="secondary" className="text-[10px]">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {addr.complement ? `${addr.complement} — ` : ""}{addr.district}, Franco da Rocha
                    {addr.cep ? ` · CEP ${addr.cep}` : ""}
                  </p>
                  {addr.reference && (
                    <p className="text-[11px] text-muted-foreground">
                      Ref.: {addr.reference}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Editar endereço"
                  onClick={() => {
                    setEditingAddressId(addr.id);
                    setAddressForm({
                      cep: addr.cep ?? "",
                      street: addr.street ?? "",
                      number: addr.number ?? "",
                      complement: addr.complement ?? "",
                      district: addr.district ?? "",
                      city: addr.city ?? "Franco da Rocha",
                      state: addr.state ?? "SP",
                      reference: addr.reference ?? "",
                    });
                    setShowAddressForm(true);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            ))}

            {(tutorAddresses ?? []).length === 0 && (
              <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-4">
                <Truck className="h-6 w-6 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Nenhum endereço cadastrado</p>
                  <p className="text-xs text-muted-foreground">
                    Cadastre seu endereço para que a Big Dog busque e devolva seu pet em casa.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddressId(null);
                      setAddressForm({
                        cep: "",
                        street: "",
                        number: "",
                        complement: "",
                        district: "",
                        city: "Franco da Rocha",
                        state: "SP",
                        reference: "",
                      });
                      setShowAddressForm(true);
                    }}
                    className="mt-2 inline-block text-xs font-semibold text-primary underline"
                  >
                    + Cadastrar endereço agora
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
