import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import {
  BIRTHDAY_DISCOUNT_PERCENT,
  capitalizeWords,
  CLINIC,
  formatBRL,
  formatDateTime,
} from "@/lib/format";
import {
  computeTransportFeeCents,
  findZoneForDistrict,
  isCouponUsable,
  logisticsTypeLabels,
  needsAddress,
  petSizeLabels,
  type Coupon,
  type LogisticsType,
  type PetSize,
} from "@/lib/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fetchAddressByCep, maskCep } from "@/lib/navigation";
import { AlertTriangle, Clock, CheckCircle2, Check, Truck } from "lucide-react";
import { PetAvatar } from "@/components/PetAvatar";
import { PetPhotoUpload } from "@/components/PetPhotoUpload";
import { dispatchStatusAlert } from "@/components/StatusAlertNotifier";
import { calculateTripDistanceAndFuel } from "@/lib/distanceCalculator";
import {
  evaluateSlotCapacity,
  findNextAvailableSlot,
  getCapacitySettings,
  isPastSlot,
  type AppointmentSlotItem,
  type CapacitySettings,
  type SlotCapacityInfo,
} from "@/lib/schedulingCapacity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agendar")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { campanha?: string; cupom?: string; tipo?: string } => ({
    ...(typeof search["campanha"] === "string" ? { campanha: search["campanha"] as string } : {}),
    ...(typeof search["cupom"] === "string" ? { cupom: search["cupom"] as string } : {}),
    ...(typeof search["tipo"] === "string" ? { tipo: search["tipo"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Agendar serviço | Big Dog Pet" },
      {
        name: "description",
        content:
          "Escolha o serviço de banho ou tosa, selecione data e horário e confirme o agendamento no Big Dog Pet.",
      },
      { property: "og:title", content: "Agendar serviço | Big Dog Pet" },
      {
        property: "og:description",
        content: "Agende banho e tosa em poucos toques.",
      },
    ],
  }),
  component: Agendar,
});

const categories = [
  { value: "banho", label: "Banho" },
  { value: "tosa", label: "Tosa" },
  { value: "veterinario", label: "Veterinário" },
];

const hours = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const petSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do pet").max(60),
  species: z.string().trim().min(2).max(30),
  size: z.enum(["pequeno", "medio", "grande"]),
  breed: z.string().trim().max(60).optional(),
  temperament: z.string().trim().max(300).optional(),
  allergies: z.string().trim().max(300).optional(),
});

const petSizeOptions: PetSize[] = ["pequeno", "medio", "grande"];

const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  cep: z.string().trim().max(12).optional(),
  street: z.string().trim().min(3, "Informe a rua"),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(60).optional(),
  district: z.string().trim().min(2, "Informe o bairro"),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(10).optional(),
  reference: z.string().trim().max(120).optional(),
});

const logisticsOptions: { value: LogisticsType; icon: string }[] = [
  { value: "levar", icon: "🏪" },
  { value: "buscar", icon: "🚗" },
  { value: "devolver", icon: "🏠" },
  { value: "buscar_e_devolver", icon: "🚗🏠" },
];

// Local calendar date (YYYY-MM-DD) — NOT toISOString(), which reports the UTC date and
// jumps to "tomorrow" during Rio's evening hours (UTC-3), wrongly blocking same-day booking.
function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Agendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { campanha, cupom, tipo } = useSearch({ from: "/_authenticated/agendar" });
  const isBirthdayOffer = campanha === "niver";

  const [category, setCategory] = useState("banho");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState(
    isBirthdayOffer
      ? `Cliente veio pela oferta de aniversário (20% de desconto)${cupom ? ` — cupom ${cupom}` : ""}.`
      : "",
  );

  // Consulta agendamentos do dia para calcular capacidade por horário
  const { data: dayAppointments } = useQuery({
    queryKey: ["appointments-capacity", date],
    queryFn: async () => {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, service_id, services(category)")
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay)
        .neq("status", "cancelado");
      if (error) throw error;
      return (data ?? []) as AppointmentSlotItem[];
    },
  });

  const [capacitySettings, setCapacitySettings] = useState<CapacitySettings>(getCapacitySettings);
  const [allowCapacityException, setAllowCapacityException] = useState(false);

  // Sincroniza configurações de capacidade se forem salvas no Admin
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<CapacitySettings>;
      if (customEvent.detail) setCapacitySettings(customEvent.detail);
    };
    window.addEventListener("bigdog_capacity_updated", handleUpdate);
    return () => window.removeEventListener("bigdog_capacity_updated", handleUpdate);
  }, []);

  // Reseta exceção ao trocar data, horário ou categoria
  useEffect(() => {
    setAllowCapacityException(false);
  }, [date, time, category]);

  // Mapa de capacidade para cada horário (verde, vermelho ou passado)
  const slotsCapacityMap = useMemo(() => {
    const map = new Map<string, SlotCapacityInfo>();
    for (const h of hours) {
      map.set(h, evaluateSlotCapacity(h, date, category, dayAppointments, capacitySettings));
    }
    return map;
  }, [date, category, dayAppointments, capacitySettings]);

  const currentSlotInfo = slotsCapacityMap.get(time);
  const isCurrentSlotExhausted = currentSlotInfo?.status === "exhausted";

  const nextAvailableHour = useMemo(() => {
    if (!isCurrentSlotExhausted) return null;
    return findNextAvailableSlot(time, date, category, hours, dayAppointments, capacitySettings);
  }, [isCurrentSlotExhausted, time, date, category, dayAppointments, capacitySettings]);

  const availableHours = useMemo(() => hours.filter((h) => !isPastSlot(date, h)), [date]);

  useEffect(() => {
    if (availableHours.length > 0 && !availableHours.includes(time)) {
      setTime(availableHours[0]!);
    }
  }, [availableHours, time]);

  const [newPet, setNewPet] = useState({
    name: "",
    species: "cachorro",
    size: "medio" as PetSize,
    breed: "",
    temperament: "",
    allergies: "",
    photo_url: null as string | null,
  });
  const [petSheetOpen, setPetSheetOpen] = useState(false);

  const [logisticsType, setLogisticsType] = useState<LogisticsType>(
    tipo === "buscar_e_devolver" ? "buscar_e_devolver" : "levar",
  );
  const [addressId, setAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({
    label: "Casa",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    reference: "",
  });
  const [isAgendarCepLoading, setIsAgendarCepLoading] = useState(false);

  async function handleAgendarCepChange(val: string) {
    const masked = maskCep(val);
    setNewAddress((prev) => ({ ...prev, cep: masked }));
    const raw = val.replace(/\D/g, "");
    if (raw.length === 8) {
      setIsAgendarCepLoading(true);
      try {
        const info = await fetchAddressByCep(raw);
        if (info) {
          setNewAddress((prev) => ({
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
        setIsAgendarCepLoading(false);
      }
    }
  }

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);


  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, category, price_cents, duration_min")
        .eq("active", true)
        .order("price_cents");
      if (error) throw error;
      return data;
    },
  });

  const { data: pets } = useQuery({
    queryKey: ["pets", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed, size, photo_url")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: addresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, label, street, number, complement, district, city, state, cep, is_default")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Autosseleção do pet só quando há exatamente um cadastrado: poupa um toque
  // sem risco de agendar silenciosamente para o pet errado quando há vários.
  useEffect(() => {
    if (pets && pets.length === 1 && !petId) {
      setPetId(pets[0]!.id);
    }
  }, [pets, petId]);

  // Autosseleção do endereço padrão (ou o mais recente, já que a query acima
  // ordena is_default primeiro) assim que a lista carrega.
  useEffect(() => {
    if (addresses && addresses.length > 0 && !addressId) {
      const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0]!;
      setAddressId(defaultAddress.id);
    }
  }, [addresses, addressId]);

  const { data: zones } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select(
          "id, name, districts, price_cents, free_above_cents, eta_minutes, active, notes, created_at, updated_at",
        )
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: transportSettings } = useQuery({
    queryKey: ["transport-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_settings")
        .select("returning_client_discount_percent")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // "Cliente recorrente": já teve pelo menos um agendamento concluído antes.
  const { data: priorCompletedCount } = useQuery({
    queryKey: ["prior-completed-appointments", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "concluido");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const isReturningClient = (priorCompletedCount ?? 0) > 0;

  const applyCoupon = useMutation({
    mutationFn: async (code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) throw new Error("Informe um código de cupom");
      const { data, error } = await supabase
        .from("transport_coupons")
        .select("*")
        .eq("code", trimmed)
        .maybeSingle();
      if (error) throw error;
      if (!isCouponUsable(data)) throw new Error("Cupom inválido, inativo ou expirado");
      return data;
    },
    onSuccess: (coupon) => {
      setAppliedCoupon(coupon);
      setCouponError(null);
    },
    onError: (error) => {
      setAppliedCoupon(null);
      setCouponError(error instanceof Error ? error.message : "Cupom inválido");
    },
  });

  const createPet = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const parsed = petSchema.parse(newPet);
      const { data, error } = await supabase
        .from("pets")
        .insert({
          owner_id: user.id,
          name: parsed.name,
          species: parsed.species,
          size: parsed.size,
          breed: parsed.breed || null,
          temperament: parsed.temperament || null,
          allergies: parsed.allergies || null,
          photo_url: newPet.photo_url || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      setPetId(data.id);
      setNewPet({
        name: "",
        species: "cachorro",
        size: "medio",
        breed: "",
        temperament: "",
        allergies: "",
        photo_url: null,
      });
      setPetSheetOpen(false);
      toast.success("Pet cadastrado");
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError ? error.issues[0]!.message : "Não foi possível salvar",
      );
    },
  });

  const createAddress = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const parsed = addressSchema.parse(newAddress);
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: user.id,
          label: parsed.label || "Casa",
          cep: parsed.cep || null,
          street: parsed.street,
          number: parsed.number || null,
          complement: parsed.complement || null,
          district: parsed.district,
          city: parsed.city || "Franco da Rocha",
          state: parsed.state || "SP",
          reference: parsed.reference || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setAddressId(data.id);
      setNewAddress({
        label: "Casa",
        cep: "",
        street: "",
        number: "",
        complement: "",
        district: "",
        city: "",
        state: "",
        reference: "",
      });
      toast.success("Endereço cadastrado");
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError
          ? error.issues[0]!.message
          : "Não foi possível salvar o endereço",
      );
    },
  });

  const selectedAddress = (addresses ?? []).find((a) => a.id === addressId) ?? null;
  const selectedService = (services ?? []).find((s) => s.id === serviceId) ?? null;
  const selectedPet = (pets ?? []).find((p) => p.id === petId) ?? null;
  // Preço do serviço já com o desconto de aniversário aplicado, quando a
  // página foi aberta pela oferta (?campanha=niver). Diferente do cupom de
  // /loja e /carrinho (que é só informativo), aqui há um preço único e claro
  // pra descontar, então aplicamos de verdade em vez de deixar só pro
  // WhatsApp — é o que o banner promete.
  const originalServicePriceCents = selectedService?.price_cents ?? 0;
  const discountedServicePriceCents = isBirthdayOffer
    ? Math.round(originalServicePriceCents * (1 - BIRTHDAY_DISCOUNT_PERCENT / 100))
    : originalServicePriceCents;
  const zone = useMemo(
    () => findZoneForDistrict(zones, selectedAddress?.district),
    [zones, selectedAddress],
  );
  const feeResult = useMemo(() => {
    if (!needsAddress(logisticsType)) {
      return { feeCents: 0, freeApplied: false, zoneMatched: true, breakdown: [] };
    }
    return computeTransportFeeCents(zone, discountedServicePriceCents, {
      isReturningClient,
      returningClientDiscountPercent: transportSettings?.returning_client_discount_percent ?? null,
      coupon: appliedCoupon,
    });
  }, [logisticsType, zone, discountedServicePriceCents, isReturningClient, transportSettings, appliedCoupon]);

  // Cálculo da distância do tutor e estimativa de combustível (com regra de dobro para ida e volta)
  const tripDistanceInfo = useMemo(() => {
    return calculateTripDistanceAndFuel(selectedAddress, logisticsType);
  }, [selectedAddress, logisticsType]);

  const outOfArea = needsAddress(logisticsType) && Boolean(selectedAddress) && !zone;
  // Prévia da taxa de transporte, calculada mesmo quando a opção atual é
  // "Levar ao petshop" — usada só para mostrar um valor de referência nos
  // cards de retirada/devolução antes do tutor escolher o endereço.
  const transportFeePreview = useMemo(() => {
    if (!zone) return null;
    return computeTransportFeeCents(zone, discountedServicePriceCents, {
      isReturningClient,
      returningClientDiscountPercent: transportSettings?.returning_client_discount_percent ?? null,
      coupon: appliedCoupon,
    });
  }, [zone, discountedServicePriceCents, isReturningClient, transportSettings, appliedCoupon]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      if (!serviceId) throw new Error("Escolha um serviço");
      const scheduled = new Date(`${date}T${time}:00`);
      if (Number.isNaN(scheduled.getTime())) throw new Error("Data inválida");
      if (scheduled.getTime() < Date.now())
        throw new Error("Esse horário já passou. Escolha outro horário ou outra data.");

      if (isCurrentSlotExhausted && !allowCapacityException) {
        throw new Error(
          `Capacidade máxima de atendimentos para às ${time} atingida. Escolha um horário com vagas livres em verde ou marque a opção de exceção/encaixe.`
        );
      }

      const wantsTransport = needsAddress(logisticsType);
      if (wantsTransport && !addressId) {
        throw new Error("Escolha ou cadastre um endereço para retirada/devolução");
      }

      // Preço do serviço já com o desconto de aniversário aplicado (quando
      // for o caso) — é o valor que realmente é cobrado, salvo no pedido e
      // usado como base pro cálculo da taxa de transporte acima.
      const servicePriceCents = discountedServicePriceCents;
      const transportPriceCents = feeResult.feeCents;
      // Bairro fora das zonas cadastradas: agenda mesmo assim com valor 0 e um
      // aviso no pedido — o petshop confirma/ajusta o valor manualmente (aba
      // "Retirada/Entrega" do admin) em vez de travar o tutor no agendamento.
      const zoneNotCovered = wantsTransport && !feeResult.zoneMatched;

      const notesContent = allowCapacityException
        ? `${notes.trim() ? `${notes.trim()}\n` : ""}• [ENCAIXE / EXCEÇÃO DE CAPACIDADE AUTORIZADA]`.slice(0, 500)
        : notes.trim().slice(0, 500) || null;

      const { data: appt, error } = await supabase
        .from("appointments")
        .insert({
          user_id: user.id,
          service_id: serviceId,
          pet_id: petId,
          scheduled_at: scheduled.toISOString(),
          notes: notesContent,
          // Marca automaticamente como Campanha Niver quando o agendamento
          // veio da oferta de aniversário (link com ?campanha=niver), em vez
          // de depender do admin marcar manualmente depois na aba Agendamentos.
          origin: isBirthdayOffer ? "campanha_niver" : null,
          logistics_type: logisticsType,
          address_id: wantsTransport ? addressId : null,
          service_price_cents: servicePriceCents,
          transport_price_cents: transportPriceCents,
          total_cents: servicePriceCents + transportPriceCents,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (wantsTransport) {
        // Registra na base a distância (dobro na ida e volta) e custo estimado de combustível junto ao frete
        const enrichedBreakdown = {
          steps: feeResult.breakdown,
          distance_km: tripDistanceInfo.distanceKm,
          one_way_km: tripDistanceInfo.oneWayKm,
          round_trip: tripDistanceInfo.isRoundTrip,
          logistics_type: logisticsType,
          fuel_cost_estimate_cents: tripDistanceInfo.fuelCostEstimateCents,
          fuel_price_cents: tripDistanceInfo.fuelPriceCents,
          consumption_km_per_liter: tripDistanceInfo.consumptionKmPerLiter,
          transport_price_cents: transportPriceCents,
        };

        const { error: transportError } = await supabase.from("transport_orders").insert({
          appointment_id: appt.id,
          address_id: addressId,
          zone_id: zone?.id ?? null,
          price_cents: transportPriceCents,
          fee_breakdown: enrichedBreakdown as unknown as Json,
          pickup_notes: zoneNotCovered
            ? `Bairro "${selectedAddress?.district ?? ""}" fora das zonas cadastradas — confirmar valor da retirada/devolução manualmente.`
            : null,
        });
        if (transportError) throw transportError;
      }

      // Best-effort: an initial history row so the tutor's timeline has a starting
      // point. Not critical to the booking itself, so a failure here doesn't block it.
      const { error: historyError } = await supabase.from("pet_status_history").insert({
        appointment_id: appt.id,
        status: "agendado",
        created_by: user.id,
      });
      if (historyError) console.error(historyError);

      return { scheduled, transportPriceCents, servicePriceCents, wantsTransport, zoneNotCovered };
    },
    onSuccess: ({ scheduled }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });

      const rawPetName = (pets ?? []).find((p) => p.id === petId)?.name;
      const petName = rawPetName ? capitalizeWords(rawPetName) : undefined;

      // Alerta sonoro de 3 repetições (3 toques de alarme harmônicos) + Notificação
      dispatchStatusAlert(
        "confirmado",
        `🔔 Agendamento Registrado!${petName ? ` (${petName})` : ""}`,
        `Horário agendado para ${formatDateTime(scheduled)}. Aguardando confirmação da loja. Acompanhe em tempo real na tela inicial!`,
        3
      );

      navigate({ to: "/" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar");
    },
  });

  return (
    <div className="p-4 pb-28">
      <h1 className="font-display text-2xl">Agendar serviço</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o serviço, o pet e o melhor horário.
      </p>

      {isBirthdayOffer && (
        <div className="mt-3 rounded-2xl border-2 border-gold/50 bg-secondary p-3">
          <p className="text-sm font-semibold">🎉 Oferta de aniversário</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho ou tosa hoje. O desconto já é aplicado
            automaticamente no valor abaixo ao escolher o serviço.
          </p>
          {cupom && (
            <p className="mt-2 inline-block rounded-lg border-2 border-dashed border-gold/60 bg-background px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-gold">
              Cupom aplicado: {cupom}
            </p>
          )}
        </div>
      )}

      <Tabs
        value={category}
        onValueChange={(value) => {
          setCategory(value);
          setServiceId(null);
        }}
        className="mt-4"
      >
        <TabsList className="grid w-full grid-cols-3 h-11 p-1 bg-muted/80 rounded-2xl">
          {categories.map((c) => (
            <TabsTrigger
              key={c.value}
              value={c.value}
              className="rounded-xl py-2 text-xs font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-sm"
            >
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {categories.map((c) => (
          <TabsContent key={c.value} value={c.value} className="mt-3">
            <ul className="space-y-2">
              {(services ?? [])
                .filter((s) => s.category === c.value)
                .map((service) => {
                  const isSelected = serviceId === service.id;
                  return (
                    <li key={service.id}>
                      <button
                        type="button"
                        onClick={() => setServiceId(service.id)}
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                            : "border-border/60 bg-card text-card-foreground shadow-card hover:border-primary/40",
                        )}
                      >
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block truncate text-sm",
                              isSelected ? "font-bold text-white" : "font-semibold text-foreground",
                            )}
                          >
                            {service.name}
                          </span>
                          <span
                            className={cn(
                              "block text-[11px] mt-0.5",
                              isSelected ? "text-white/85 font-medium" : "text-muted-foreground",
                            )}
                          >
                            {service.duration_min} minutos
                          </span>
                        </span>
                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={cn(
                              "font-display text-sm",
                              isSelected ? "font-bold text-white" : "font-bold text-primary",
                            )}
                          >
                            {formatBRL(service.price_cents)}
                          </span>
                          {isSelected && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow-xs">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              {(services ?? []).filter((s) => s.category === c.value).length === 0 && (
                <li className="text-xs text-muted-foreground">
                  Nenhum serviço nessa categoria no momento.
                </li>
              )}
            </ul>
          </TabsContent>
        ))}
      </Tabs>

      <section className="mt-6">
        <h2 className="font-display text-lg font-bold">Pet</h2>
        {(pets ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2.5">
            {(pets ?? []).map((pet) => {
              const isSelected = petId === pet.id;
              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => setPetId(pet.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl p-2 pr-4 text-xs font-semibold transition-all border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/25 font-bold"
                      : "bg-card text-foreground border-border hover:bg-muted/30",
                  )}
                >
                  <PetAvatar
                    photoUrl={(pet as { photo_url?: string | null })?.photo_url}
                    name={pet.name}
                    species={pet.species}
                    size="sm"
                  />
                  <div className="text-left">
                    <p className="leading-tight">{capitalizeWords(pet.name)}</p>
                    <p className="text-[10px] opacity-75">{pet.breed || pet.species || "Pet"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <Sheet open={petSheetOpen} onOpenChange={setPetSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl border-2 border-dashed border-muted-foreground/30 p-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/20 transition"
            >
              + Adicionar novo pet
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Cadastrar novo pet</SheetTitle>
            </SheetHeader>
            <div className="mt-2 space-y-3">
              <PetPhotoUpload
                value={newPet.photo_url}
                onChange={(photo_url) => setNewPet({ ...newPet, photo_url })}
                petName={newPet.name}
                species={newPet.species}
              />
              <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nome"
                value={newPet.name}
                maxLength={60}
                onChange={(e) => setNewPet({ ...newPet, name: e.target.value })}
                className="h-10 rounded-xl"
              />
              <Input
                placeholder="Espécie"
                value={newPet.species}
                maxLength={30}
                onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
                className="h-10 rounded-xl"
              />
              <div className="col-span-2">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Porte</p>
                <div className="flex gap-2">
                  {petSizeOptions.map((size) => {
                    const isSelected = newPet.size === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setNewPet({ ...newPet, size })}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 font-bold"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                        )}
                      >
                        {petSizeLabels[size]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Input
                placeholder="Raça (opcional)"
                value={newPet.breed}
                maxLength={60}
                onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })}
                className="col-span-2 h-10 rounded-xl"
              />
              <Input
                placeholder="Temperamento (opcional)"
                value={newPet.temperament}
                maxLength={300}
                onChange={(e) => setNewPet({ ...newPet, temperament: e.target.value })}
                className="col-span-2 h-10 rounded-xl"
              />
              <Input
                placeholder="Alergias (opcional)"
                value={newPet.allergies}
                maxLength={300}
                onChange={(e) => setNewPet({ ...newPet, allergies: e.target.value })}
                className="col-span-2 h-10 rounded-xl"
              />
            </div>
            <Button
              variant="secondary"
              className="mt-3 h-10 w-full rounded-xl"
              disabled={createPet.isPending}
              onClick={() => createPet.mutate()}
            >
              Salvar pet
            </Button>
          </div>
        </SheetContent>
        </Sheet>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-lg">Data e horário</h2>
        <div>
          <Label htmlFor="date">Data</Label>
          <Input
            id="date"
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Horários de atendimento</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Vagas livres
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Lotado
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {hours.map((h) => {
              const slot = slotsCapacityMap.get(h);
              const disabled = slot?.isPast ?? isPastSlot(date, h);
              const isExhausted = !disabled && slot?.status === "exhausted";
              const isSelected = time === h;

              return (
                <button
                  key={h}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTime(h)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl p-2.5 transition-all border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    disabled &&
                      "cursor-not-allowed border-border/40 bg-muted/30 text-muted-foreground/40 line-through opacity-60",
                    !disabled &&
                      !isExhausted &&
                      (isSelected
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50"
                        : "border-emerald-500/40 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-700/60 dark:text-emerald-200"),
                    !disabled &&
                      isExhausted &&
                      (isSelected
                        ? "border-rose-600 bg-rose-600 text-white shadow-md ring-2 ring-rose-400/50"
                        : "border-rose-400/50 bg-rose-50/70 text-rose-800 hover:bg-rose-100 hover:border-rose-500 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300"),
                  )}
                >
                  <span className="text-sm font-bold tracking-tight">{h}</span>
                  <span
                    className={cn(
                      "text-[10px] font-medium mt-0.5",
                      disabled && "text-muted-foreground/40",
                      !disabled &&
                        isExhausted &&
                        (isSelected ? "text-rose-100" : "text-rose-700 dark:text-rose-300"),
                      !disabled &&
                        !isExhausted &&
                        (isSelected
                          ? "text-emerald-100"
                          : "text-emerald-700 dark:text-emerald-400"),
                    )}
                  >
                    {disabled
                      ? "Passado"
                      : isExhausted
                        ? "Lotado"
                        : `${slot?.remainingSlots ?? 1} vaga${(slot?.remainingSlots ?? 1) > 1 ? "s" : ""}`}
                  </span>
                </button>
              );
            })}
          </div>

          {availableHours.length === 0 && (
            <p className="w-full text-xs text-muted-foreground pt-1">
              Não há mais horários hoje. Escolha outra data acima.
            </p>
          )}
        </div>

        {/* Alerta de Capacidade Atingida + Sugestão + Abertura de Exceção */}
        {isCurrentSlotExhausted && (
          <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-50/90 p-4 text-amber-950 dark:bg-amber-950/40 dark:border-amber-700/60 dark:text-amber-200 space-y-3 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-sm text-amber-950 dark:text-amber-100">
                  Capacidade máxima atingida às {time}h ({currentSlotInfo?.currentCount}/{currentSlotInfo?.maxAllowed} vagas de {category || "atendimento"} ocupadas)
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/90">
                  Para garantir o bem-estar e o atendimento sem espera do seu pet, sugerimos escolher um horário com vagas livres.
                </p>
              </div>
            </div>

            {nextAvailableHour && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/90 p-3 border border-amber-300/60 dark:border-amber-800/70">
                <div className="text-xs">
                  <span className="font-medium text-foreground">Próximo horário com vaga:</span>{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-bold">{nextAvailableHour}h</strong>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTime(nextAvailableHour)}
                  className="h-8 rounded-lg border-emerald-500/50 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold shadow-xs"
                >
                  <Clock className="mr-1 h-3.5 w-3.5" /> Mudar para {nextAvailableHour}
                </Button>
              </div>
            )}

            <div className="pt-2 border-t border-amber-300/50 dark:border-amber-800/60">
              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={allowCapacityException}
                  onChange={(e) => setAllowCapacityException(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span className="leading-snug">
                  <strong className="text-amber-950 dark:text-amber-100 font-semibold">
                    Abrir exceção e agendar neste horário mesmo assim
                  </strong>
                  <span className="block text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    (O atendimento será registrado como Encaixe prioritário / Sujeito a espera para não deixar seu pet sem atendimento)
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 rounded-xl"
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-lg">Retirada e devolução (opcional)</h2>
        <p className="text-xs text-muted-foreground">
          Comodidade: buscamos seu pet em casa e entregamos de volta após o atendimento.
        </p>
        {selectedPet && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-[11px] text-secondary-foreground">
            Porte de {capitalizeWords(selectedPet.name)}:{" "}
            <span className="font-semibold">{petSizeLabels[selectedPet.size as PetSize]}</span> —
            pets de porte médio ou grande exigem carro na retirada/devolução (moto só é permitida
            para porte pequeno).
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {logisticsOptions.map((option) => {
            const requiresAddress = needsAddress(option.value);
            const isSelected = logisticsType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setLogisticsType(option.value);
                  if (!requiresAddress) {
                    // Sem transporte, o cupom não tem efeito nenhum — limpa pra
                    // não reaparecer "magicamente" aplicado se o tutor voltar
                    // para um modo com retirada/devolução mais tarde.
                    setAppliedCoupon(null);
                    setCouponCode("");
                    setCouponError(null);
                  }
                }}
                className={cn(
                  "rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 font-bold"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                <span className="mr-1">{option.icon}</span>
                {logisticsTypeLabels[option.value]}
                <span
                  className={cn(
                    "mt-0.5 block text-[10px] font-normal",
                    isSelected ? "text-white/85 font-medium" : "opacity-80",
                  )}
                >
                  {!requiresAddress
                    ? "Sem taxa"
                    : transportFeePreview
                      ? `Taxa: ${formatBRL(transportFeePreview.feeCents)}`
                      : "Taxa calculada pelo bairro"}
                </span>
              </button>
            );
          })}
        </div>

        {needsAddress(logisticsType) && (
          <div className="space-y-3">
            {(addresses ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(addresses ?? []).map((address) => {
                  const isSelected = addressId === address.id;
                  return (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => setAddressId(address.id)}
                      className={cn(
                        "rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 font-bold"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                      )}
                    >
                      {address.label}: {address.street}
                      {address.number ? `, ${address.number}` : ""} — {address.district}
                      {address.city ? `, ${address.city}` : ""}{address.state ? ` - ${address.state}` : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Resumo de Distância Calculada e Custo Estimado de Combustível */}
            {selectedAddress && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-primary" />
                    Distância estimada ({tripDistanceInfo.isRoundTrip ? "Ida e Volta - Dobro" : "1 Trecho"}):
                  </span>
                  <span className="font-bold text-primary text-sm">{tripDistanceInfo.formattedDistance}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Custo estimado de combustível ({tripDistanceInfo.consumptionKmPerLiter} km/l):</span>
                  <span className="font-medium text-foreground">{tripDistanceInfo.formattedFuelCost}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-primary/10">
                  <span className="font-medium text-muted-foreground">Frete calculado:</span>
                  <span className="font-bold text-foreground">
                    {feeResult.feeCents > 0 ? formatBRL(feeResult.feeCents) : "Grátis"}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-card p-3 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cadastrar novo endereço
                </p>
                {isAgendarCepLoading && (
                  <span className="text-[11px] font-semibold text-primary animate-pulse">
                    Buscando CEP...
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Apelido (ex.: Casa)"
                  value={newAddress.label}
                  maxLength={40}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="col-span-2 h-10 rounded-xl"
                />
                <Input
                  placeholder="CEP (ex.: 07800-000)"
                  value={newAddress.cep}
                  maxLength={9}
                  onChange={(e) => handleAgendarCepChange(e.target.value)}
                  className="col-span-2 h-10 rounded-xl"
                />
                <Input
                  placeholder="Rua / Logradouro"
                  value={newAddress.street}
                  onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                  className="col-span-2 h-10 rounded-xl"
                />
                <Input
                  placeholder="Número"
                  value={newAddress.number}
                  maxLength={20}
                  onChange={(e) => setNewAddress({ ...newAddress, number: e.target.value })}
                  className="h-10 rounded-xl"
                />
                <Input
                  placeholder="Complemento (opcional)"
                  value={newAddress.complement}
                  maxLength={60}
                  onChange={(e) => setNewAddress({ ...newAddress, complement: e.target.value })}
                  className="h-10 rounded-xl"
                />
                <Input
                  placeholder="Bairro"
                  value={newAddress.district}
                  onChange={(e) => setNewAddress({ ...newAddress, district: e.target.value })}
                  className="col-span-2 h-10 rounded-xl"
                />
                <Input
                  placeholder="Cidade"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="h-10 rounded-xl"
                />
                <Input
                  placeholder="UF (ex: SP)"
                  maxLength={2}
                  value={newAddress.state}
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, state: e.target.value.toUpperCase() })
                  }
                  className="h-10 rounded-xl uppercase"
                />
                <Input
                  placeholder="Ponto de referência (opcional)"
                  value={newAddress.reference}
                  maxLength={120}
                  onChange={(e) => setNewAddress({ ...newAddress, reference: e.target.value })}
                  className="col-span-2 h-10 rounded-xl"
                />
              </div>
              <Button
                variant="secondary"
                className="mt-2 h-10 w-full rounded-xl"
                disabled={createAddress.isPending}
                onClick={() => createAddress.mutate()}
              >
                Salvar endereço
              </Button>
            </div>

            {selectedAddress && !outOfArea && (
              <div className="rounded-2xl bg-card p-3 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cupom de desconto (opcional)
                </p>
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Código do cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="h-10 flex-1 rounded-xl uppercase"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 shrink-0 rounded-xl px-4"
                    disabled={applyCoupon.isPending || !couponCode.trim()}
                    onClick={() => applyCoupon.mutate(couponCode)}
                  >
                    Aplicar
                  </Button>
                </div>
                {appliedCoupon && (
                  <p className="mt-1.5 text-xs font-semibold text-primary">
                    Cupom {appliedCoupon.code} aplicado!
                  </p>
                )}
                {couponError && (
                  <p className="mt-1.5 text-xs font-semibold text-destructive">{couponError}</p>
                )}
              </div>
            )}

            {selectedAddress && (
              <div className="rounded-2xl border-2 border-primary/30 bg-secondary p-3 text-sm">
                {outOfArea ? (
                  <p className="font-semibold text-primary">
                    Ainda não temos uma zona cadastrada para o bairro "{selectedAddress.district}
                    ". Pode agendar normalmente — vamos confirmar o valor da retirada/devolução com
                    você antes do atendimento.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {feeResult.breakdown.map((step, i) => (
                      <p
                        key={i}
                        className={cn(
                          "flex justify-between text-xs",
                          i === 0 ? "text-muted-foreground" : "text-primary",
                        )}
                      >
                        <span>{step.label}</span>
                        <span>
                          {step.deltaCents > 0 ? "" : step.deltaCents < 0 ? "− " : ""}
                          {formatBRL(Math.abs(step.deltaCents))}
                        </span>
                      </p>
                    ))}
                    <p className="flex justify-between border-t border-primary/20 pt-1 font-display text-primary">
                      <span>Taxa de retirada/devolução</span>
                      <span>{formatBRL(feeResult.feeCents)}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="sticky bottom-16 z-20 mt-6 -mx-4 border-t-2 border-primary/20 bg-background/95 p-4 shadow-lg backdrop-blur">
        {selectedService && (
          <div className="mb-2 space-y-0.5 text-xs">
            <p className="flex justify-between text-muted-foreground">
              <span>{selectedService.name}</span>
              {isBirthdayOffer ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60 line-through">
                    {formatBRL(originalServicePriceCents)}
                  </span>
                  <span className="font-semibold text-gold">
                    {formatBRL(discountedServicePriceCents)}
                  </span>
                </span>
              ) : (
                <span>{formatBRL(selectedService.price_cents)}</span>
              )}
            </p>
            {isBirthdayOffer && (
              <p className="flex justify-between text-gold">
                <span>Desconto de aniversário ({BIRTHDAY_DISCOUNT_PERCENT}%)</span>
              </p>
            )}
            {needsAddress(logisticsType) && feeResult.feeCents > 0 && (
              <p className="flex justify-between text-muted-foreground">
                <span>Taxa de retirada/devolução</span>
                <span>{formatBRL(feeResult.feeCents)}</span>
              </p>
            )}
            <p className="flex justify-between font-display text-sm text-primary">
              <span>Total</span>
              <span>
                {formatBRL(
                  discountedServicePriceCents +
                    (needsAddress(logisticsType) ? feeResult.feeCents : 0),
                )}
              </span>
            </p>
          </div>
        )}
        <Button
          className="h-12 w-full rounded-2xl font-semibold"
          disabled={
            createAppointment.isPending ||
            !serviceId ||
            availableHours.length === 0 ||
            (needsAddress(logisticsType) && !addressId) ||
            (isCurrentSlotExhausted && !allowCapacityException)
          }
          onClick={() => {
            createAppointment.mutate();
          }}
        >
          {createAppointment.isPending
            ? "Enviando..."
            : isCurrentSlotExhausted && allowCapacityException
              ? "Confirmar com Encaixe / Exceção"
              : isCurrentSlotExhausted
                ? "Horário Lotado (Abra exceção acima)"
                : "Confirmar agendamento"}
        </Button>
      </div>
    </div>
  );
}
