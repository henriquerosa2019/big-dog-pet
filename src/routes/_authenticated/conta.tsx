import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Gift,
  LogOut,
  MapPin,
  MessageCircle,
  PawPrint,
  Pencil,
  Plus,
  ShoppingBag,
  Stethoscope,
  Syringe,
  Truck,
  X,
} from "lucide-react";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { playStatusSound } from "@/lib/soundAlerts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdminStatus } from "@/hooks/useAuth";
import { fetchAddressByCep, maskCep } from "@/lib/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  alertBadgeLabel,
  alertTone,
  appointmentStatusTone,
  birthdayCouponCode,
  capitalizeWords,
  CLINIC,
  daysUntil,
  formatBRL,
  formatDate,
  formatDateTime,
  getAppointmentStatusDisplay,
  isAppointmentInService,
  isBirthdayToday,
  isBirthdayTomorrow,
  isOrderInService,
  orderStatusTone,
  sortInServiceFirst,
  statusToneCardClass,
  statusToneClass,
  statusToneIconClass,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransportHistoryList } from "@/components/TransportHistoryList";
import { DriverContact } from "@/components/DriverContact";
import { DriverLiveMap } from "@/components/DriverLiveMap";
import { PetAvatar } from "@/components/PetAvatar";
import { PetPhotoUpload } from "@/components/PetPhotoUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  formatOpsStatusWithPet,
  getOpsStatusTutorMessage,
  logisticsTypeLabels,
  opsStatusLabels,
  opsStatusTone,
  petSizeLabels,
  type LogisticsType,
  type OpsStatus,
  type PetSize,
} from "@/lib/transport";

export const Route = createFileRoute("/_authenticated/conta")({
  ssr: false,
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
  const { isAdmin } = useIsAdminStatus(user?.id, user?.email);
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
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, status, notes, logistics_type, ops_status, transport_price_cents, services(name, price_cents), pets(name, photo_url, species)",
        )
        .eq("user_id", user!.id)
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
        .eq("user_id", user!.id)
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
    let list = appointments ?? [];
    switch (apptFilter) {
      case "abertos":
        list = openAppts;
        break;
      case "concluidos":
        list = concludedAppts;
        break;
      case "cancelados":
        list = cancelledAppts;
        break;
      case "todos":
      default:
        list = appointments ?? [];
        break;
    }
    return [...list].sort((a, b) => {
      const aInService = isAppointmentInService(a) ? 1 : 0;
      const bInService = isAppointmentInService(b) ? 1 : 0;
      if (bInService !== aInService) return bInService - aInService;

      const aPending = a.status === "pendente" ? 1 : 0;
      const bPending = b.status === "pendente" ? 1 : 0;
      if (bPending !== aPending) return bPending - aPending;

      return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
    });
  }, [apptFilter, openAppts, concludedAppts, cancelledAppts, appointments]);

  function isOrderOpen(order: { status: string }) {
    return order.status === "novo" || order.status === "em_preparo" || order.status === "em_atendimento";
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
    let list = orders ?? [];
    switch (orderFilter) {
      case "abertos":
        list = openOrders;
        break;
      case "entregues":
        list = deliveredOrders;
        break;
      case "cancelados":
        list = cancelledOrders;
        break;
      case "todos":
      default:
        list = orders ?? [];
        break;
    }
    return sortInServiceFirst(list, isOrderInService);
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
    city: "",
    state: "",
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
            city: info.localidade || prev.city || "",
            state: info.uf || prev.state || "",
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
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["transport-history"] });
        },
      )
      .subscribe();

    function handleStatusAlert() {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transport-history"] });
    }
    window.addEventListener("bigdog_status_alert", handleStatusAlert);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("bigdog_status_alert", handleStatusAlert);
    };
  }, [user?.id, queryClient]);

  const { data: pets } = useQuery({
    queryKey: ["pets", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed, allergies, birth_date, size, photo_url")
        .eq("owner_id", user!.id);
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

  const { data: medicalRecordAlerts } = useQuery({
    queryKey: ["medical-record-alerts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("medical_records")
        .select("id, record_type, reason, next_return_date, pet_id, pets(name)")
        .not("next_return_date", "is", null)
        .lte("next_return_date", limit)
        .order("next_return_date");
      if (error) throw error;
      return data;
    },
  });

  // Junta vacina + retorno + prontuários médicos + aniversário (dono e pets) num único painel de avisos
  type Aviso = {
    key: string;
    kind: "vacina" | "retorno" | "aniversario";
    label: string;
    petId?: string | undefined;
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
      const petNameCap = v.pets?.name ? capitalizeWords(v.pets.name) : undefined;
      items.push({
        key: `vacina-${v.id}`,
        kind: "vacina",
        label: `Reforço de ${v.vaccine_name}`,
        petId: v.pet_id,
        petName: petNameCap,
        days: daysUntil(v.next_due_at!),
        dueDate: v.next_due_at!,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar o reforço da vacina ${v.vaccine_name} do meu pet ${v.pets?.name ?? ""}.`,
      });
    }

    for (const r of returnAlerts ?? []) {
      const petNameCap = r.pets?.name ? capitalizeWords(r.pets.name) : undefined;
      items.push({
        key: `retorno-${r.id}`,
        kind: "retorno",
        label: r.title,
        petId: r.pet_id,
        petName: petNameCap,
        days: daysUntil(r.due_date),
        dueDate: r.due_date,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar: ${r.title} do meu pet ${r.pets?.name ?? ""}.`,
      });
    }

    for (const m of medicalRecordAlerts ?? []) {
      if (!m.next_return_date) continue;
      const alreadyHasReminder = (returnAlerts ?? []).some(
        (cr) => cr.pet_id === m.pet_id && cr.due_date === m.next_return_date,
      );
      if (alreadyHasReminder) continue;

      const days = daysUntil(m.next_return_date);
      const petNameCap = m.pets?.name ? capitalizeWords(m.pets.name) : undefined;
      const typeLabel =
        m.record_type === "cirurgia"
          ? "Retorno Pós-Cirúrgico"
          : "Consulta de Retorno";
      const title = m.reason ? `${typeLabel}: ${m.reason}` : typeLabel;

      items.push({
        key: `med-${m.id}`,
        kind: "retorno",
        label: title,
        petId: m.pet_id,
        petName: petNameCap,
        days,
        dueDate: m.next_return_date,
        whatsappMessage: `Olá, ${CLINIC.name}! Gostaria de confirmar o retorno médico (${title}) do meu pet ${petNameCap ?? ""}.`,
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
          petId: pet.id,
          petName: capitalizeWords(pet.name),
          days: 0,
          couponCode: birthdayCouponCode(pet.name),
        });
      } else if (isBirthdayTomorrow(pet.birth_date)) {
        items.push({
          key: `aniversario-pet-${pet.id}`,
          kind: "aniversario",
          label: `Aniversário de ${capitalizeWords(pet.name)}`,
          petId: pet.id,
          petName: capitalizeWords(pet.name),
          days: 1,
          couponCode: birthdayCouponCode(pet.name),
        });
      }
    }

    return items.sort((a, b) => {
      if (a.days === 0 && b.days !== 0) return -1;
      if (a.days !== 0 && b.days === 0) return 1;
      if (a.days < 0 && b.days >= 0) return -1;
      if (a.days >= 0 && b.days < 0) return 1;
      return a.days - b.days;
    });
  }, [vaccineAlerts, returnAlerts, medicalRecordAlerts, profile?.birth_date, pets]);

  // Mapa de alertas críticos por pet para exibir badges na lista "Meus pets"
  const petCriticalAlertsMap = useMemo(() => {
    const map = new Map<string, Aviso>();
    for (const a of avisos) {
      if (a.kind === "aniversario") continue;
      for (const p of pets ?? []) {
        const matches = a.petId === p.id || (a.petName && a.petName.toLowerCase() === p.name.toLowerCase());
        if (matches) {
          const current = map.get(p.id);
          if (!current || a.days < current.days) {
            map.set(p.id, a);
          }
        }
      }
    }
    return map;
  }, [avisos, pets]);

  const hasPlayedContaAlertRef = useRef(false);

  useEffect(() => {
    const hasTodayAviso = avisos.some((a) => a.days === 0 && a.kind !== "aniversario");
    if (hasTodayAviso && !hasPlayedContaAlertRef.current) {
      hasPlayedContaAlertRef.current = true;
      playStatusSound("alerta", 2);
      setTimeout(() => {
        const el = document.getElementById("aviso-hoje");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 400);
    }
  }, [avisos]);

  const [newPetOpen, setNewPetOpen] = useState(false);
  const [newPet, setNewPet] = useState({
    name: "",
    species: "cachorro",
    size: "medio" as PetSize,
    breed: "",
    birth_date: "",
    allergies: "",
    photo_url: null as string | null,
  });

  const createPetMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!newPet.name.trim()) throw new Error("Informe o nome do pet");
      const { error } = await supabase.from("pets").insert({
        owner_id: user.id,
        name: newPet.name.trim(),
        species: newPet.species.trim() || "Cachorro",
        size: newPet.size,
        breed: newPet.breed.trim() || null,
        birth_date: newPet.birth_date.trim() || null,
        allergies: newPet.allergies.trim() || null,
        photo_url: newPet.photo_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet cadastrado com sucesso!");
      setNewPetOpen(false);
      setNewPet({
        name: "",
        species: "cachorro",
        size: "medio",
        breed: "",
        birth_date: "",
        allergies: "",
        photo_url: null,
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar pet");
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Você saiu da sua conta");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="p-4">
      {isAdmin && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-900 dark:text-amber-300">Modo Tutor / Homologação</span>
            <span className="text-muted-foreground text-[11px]">(Acesso Administrativo Ativo)</span>
          </div>
          <Link
            to="/admin"
            className="rounded-lg bg-primary px-3 py-1 font-semibold text-primary-foreground hover:bg-primary/90 transition text-xs shadow-xs"
          >
            Ir para Painel Loja →
          </Link>
        </div>
      )}
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
            const isHoje = item.days === 0;
            const tone = item.kind === "aniversario" ? "info" : alertTone(item.days);
            return (
              <div
                key={item.key}
                id={isHoje && item.kind !== "aniversario" ? "aviso-hoje" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border-2 p-3.5 shadow-card transition-all",
                  statusToneCardClass(tone),
                  isHoje && item.kind !== "aniversario" && "ring-2 ring-red-500/50 shadow-md",
                )}
              >
                {item.kind === "aniversario" ? (
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                ) : item.kind === "vacina" ? (
                  <Syringe className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                ) : (
                  <Stethoscope className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                )}
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground">
                      {item.petName ? `🐾 ${item.petName} · ` : ""}
                      {item.label}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 whitespace-nowrap text-[10px] font-bold",
                        statusToneClass(tone),
                      )}
                    >
                      {item.kind === "aniversario"
                        ? item.days === 0
                          ? "Hoje 🎂"
                          : "Amanhã 🎂"
                        : alertBadgeLabel(item.days)}
                    </Badge>
                  </div>
                  {item.dueDate && (
                    <p className="text-muted-foreground mt-0.5">
                      Data prevista: {formatDate(item.dueDate)}
                      {item.days < 0 && ` · Atrasado há ${Math.abs(item.days)} dia(s)`}
                      {item.days === 0 && ` · 🔔 Vence HOJE!`}
                      {item.days === 1 && ` · ⚠️ Vence amanhã!`}
                      {item.days === 2 && ` · 🟡 Vence em 2 dias!`}
                    </p>
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
                    <div className="mt-2.5 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        onClick={() =>
                          openInAppChat({
                            petId: item.petId,
                            petName: item.petName,
                            contextTag: item.label,
                            defaultText: item.whatsappMessage,
                          })
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        💬 Chat - Falar com Petshop agora!!!
                      </Button>
                    </div>
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
            const petNameFormatted = item.pets?.name ? capitalizeWords(item.pets.name) : null;
            const display = getAppointmentStatusDisplay(item);
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-2xl p-3.5 shadow-card transition-all",
                  display.cardClass,
                )}
              >
                <div className={cn(
                  "mb-2.5 flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold",
                  display.bannerClass
                )}>
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", display.dotPingClass)}></span>
                      <span className={cn("relative inline-flex rounded-full h-2 w-2", display.dotClass)}></span>
                    </span>
                    {display.bannerText}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                    {display.bannerTag}
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <PetAvatar
                    photoUrl={(item.pets as { photo_url?: string | null })?.photo_url}
                    name={petNameFormatted}
                    species={(item.pets as { species?: string | null })?.species}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-bold", display.titleColorClass)}>
                      {item.services?.name ?? "Serviço"}
                      {petNameFormatted ? ` · 🐾 ${petNameFormatted}` : ""}
                    </p>
                    <p className={cn("text-xs font-medium", display.timeColorClass)}>
                      {formatDateTime(item.scheduled_at)}
                    </p>
                  </div>
                  <Badge
                    className={cn("shrink-0 font-bold capitalize shadow-xs border-0", display.badgeClass)}
                  >
                    {display.label}
                  </Badge>
                </div>

                {display.isCancelled && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20">
                    <Button asChild size="sm" className="h-7 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs">
                      <Link to="/agendar">
                        Reagendar horário
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs gap-1.5 shadow-xs"
                      onClick={() =>
                        openInAppChat({
                          contextTag: `Cancelamento: ${item.services?.name ?? "Serviço"}`,
                          defaultText: `Olá! Meu agendamento de ${item.services?.name ?? "serviço"}${petNameFormatted ? ` para ${petNameFormatted}` : ""} foi cancelado pela loja e gostaria de tirar uma dúvida.`,
                        })
                      }
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Chat
                    </Button>
                  </div>
                )}

                {hasTransport && !display.isCancelled && (
                  <div className="mt-2.5 border-t border-current/15 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {logisticsTypeLabels[item.logistics_type as LogisticsType]}
                        {item.transport_price_cents > 0 &&
                          ` · ${formatBRL(item.transport_price_cents)}`}
                      </p>
                      <Badge
                        variant="secondary"
                        className={cn("shrink-0 font-bold", statusToneClass(opsStatusTone(item.ops_status ?? "agendado")))}
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
                      <div className="mt-1.5">
                        <DriverContact appointmentId={item.id} />
                      </div>
                    )}
                    <div className="mt-1.5">
                      <DriverLiveMap
                        appointmentId={item.id}
                        active={
                          item.ops_status === "em_deslocamento_retirada" ||
                          item.ops_status === "em_rota_devolucao"
                        }
                      />
                    </div>
                    <div className="mt-1.5">
                      <TransportHistoryList
                        appointmentId={item.id}
                        currentStatus={item.ops_status ?? undefined}
                        petName={item.pets?.name}
                      />
                    </div>
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
          {filteredOrders.map((order) => {
            const inService = isOrderInService(order);
            return (
              <li
                key={order.id}
                className={cn(
                  "rounded-2xl p-3 shadow-card transition-all",
                  inService
                    ? "border-2 border-emerald-500/80 bg-emerald-50/60 dark:border-emerald-500/60 dark:bg-emerald-950/30 ring-1 ring-emerald-400/40 shadow-md"
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
                      🟢 Em atendimento (em preparo)
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Início da fila
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                    <Badge
                      variant="secondary"
                      className={cn("capitalize text-[10px] px-1.5 py-0.2", statusToneClass(orderStatusTone(order.status)))}
                    >
                      {order.status === "novo"
                        ? "Novo"
                        : order.status === "em_preparo" || order.status === "em_atendimento"
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
            );
          })}
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Meus pets</h2>
            <p className="text-xs text-muted-foreground">
              Toque no pet para ver a ficha, vacinas e prontuário.
            </p>
          </div>
          <Dialog open={newPetOpen} onOpenChange={setNewPetOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 rounded-xl font-bold text-xs gap-1.5 shadow-xs bg-primary text-primary-foreground">
                <Plus className="h-3.5 w-3.5" />
                Novo Pet
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Pet</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <PetPhotoUpload
                  value={newPet.photo_url}
                  onChange={(photo_url) => setNewPet({ ...newPet, photo_url })}
                  petName={newPet.name}
                  species={newPet.species}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label>Nome do Pet *</Label>
                    <Input
                      placeholder="Ex: Apolo"
                      value={newPet.name}
                      onChange={(e) => setNewPet({ ...newPet, name: e.target.value })}
                      className="h-10 rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Espécie *</Label>
                    <Input
                      placeholder="Cachorro / Gato"
                      value={newPet.species}
                      onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
                      className="h-10 rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <Label>Raça</Label>
                    <Input
                      placeholder="Ex: Golden Retriever"
                      value={newPet.breed}
                      onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })}
                      className="h-10 rounded-xl mt-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Porte</Label>
                    <div className="flex gap-2 mt-1">
                      {(["pequeno", "medio", "grande"] as PetSize[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewPet({ ...newPet, size: s })}
                          className={cn(
                            "flex-1 rounded-xl py-2 text-xs font-semibold border transition",
                            newPet.size === s
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                              : "bg-muted/50 border-border hover:bg-muted"
                          )}
                        >
                          {petSizeLabels[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label>Data de Nascimento</Label>
                    <Input
                      type="date"
                      value={newPet.birth_date}
                      onChange={(e) => setNewPet({ ...newPet, birth_date: e.target.value })}
                      className="h-10 rounded-xl mt-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Alergias ou Cuidados Especiais</Label>
                    <Input
                      placeholder="Ex: Alergia a frango, pele sensível"
                      value={newPet.allergies}
                      onChange={(e) => setNewPet({ ...newPet, allergies: e.target.value })}
                      className="h-10 rounded-xl mt-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => createPetMutation.mutate()}
                  disabled={createPetMutation.isPending}
                  className="w-full h-11 rounded-xl font-bold mt-2 shadow-sm"
                >
                  {createPetMutation.isPending ? "Cadastrando..." : "Salvar Pet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ul className="mt-3 space-y-2">
          {(pets ?? []).map((pet) => {
            const criticalAlert = petCriticalAlertsMap.get(pet.id);
            const tone = criticalAlert ? alertTone(criticalAlert.days) : "neutral";
            return (
              <li key={pet.id}>
                <Link
                  to="/pets/$petId"
                  params={{ petId: pet.id }}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card hover:bg-muted/20 transition"
                >
                  <PetAvatar
                    photoUrl={pet.photo_url}
                    name={pet.name}
                    species={pet.species}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-semibold">{capitalizeWords(pet.name)}</p>
                      {criticalAlert && (
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] font-bold shrink-0 px-1.5 py-0.5", statusToneClass(tone))}
                        >
                          {criticalAlert.days < 0
                            ? "🔴 Reforço atrasado"
                            : criticalAlert.days === 0
                              ? "🔴 Vence HOJE!"
                              : criticalAlert.days === 1
                                ? "🔴 Vence amanhã"
                                : criticalAlert.days === 2
                                  ? "🟡 Em 2 dias"
                                  : `🔵 ${alertBadgeLabel(criticalAlert.days)}`}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">
                      {pet.species}
                      {pet.breed ? ` · ${pet.breed}` : ""}
                      {pet.allergies ? ` · alergias: ${pet.allergies}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
          {(pets ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground p-3 border border-dashed rounded-2xl text-center">
              Nenhum pet cadastrado ainda. Toque em "Novo Pet" acima para começar!
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
                    city: defaultAddr.city ?? "",
                    state: defaultAddr.state ?? "",
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
                    city: "",
                    state: "",
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

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label htmlFor="tutor-city" className="text-[11px] text-muted-foreground">
                  Cidade
                </Label>
                <Input
                  id="tutor-city"
                  placeholder="Ex: Franco da Rocha"
                  maxLength={100}
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  className="mt-1 h-9 rounded-lg text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tutor-state" className="text-[11px] text-muted-foreground">
                  UF
                </Label>
                <Input
                  id="tutor-state"
                  placeholder="SP"
                  maxLength={2}
                  value={addressForm.state}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, state: e.target.value.toUpperCase() })
                  }
                  className="mt-1 h-9 rounded-lg text-xs uppercase"
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
                    {addr.complement ? `${addr.complement} — ` : ""}
                    {addr.district && addr.city && addr.district.toLowerCase() === addr.city.toLowerCase()
                      ? addr.district
                      : `${addr.district ? `${addr.district}, ` : ""}${addr.city || "Franco da Rocha"}`}
                    {addr.state ? ` - ${addr.state}` : ""}
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
                      city: addr.city ?? "",
                      state: addr.state ?? "",
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
                        city: "",
                        state: "",
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
