import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC, formatBRL, formatDateTime, whatsappLink } from "@/lib/format";
import {
  computeTransportFeeCents,
  findZoneForDistrict,
  logisticsTypeLabels,
  needsAddress,
  type LogisticsType,
} from "@/lib/transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agendar")({
  validateSearch: (search: Record<string, unknown>): { campanha?: string } =>
    typeof search["campanha"] === "string" ? { campanha: search["campanha"] as string } : {},
  head: () => ({
    meta: [
      { title: "Agendar serviço | PetCura" },
      {
        name: "description",
        content:
          "Escolha banho, tosa ou atendimento veterinário, selecione data e horário e confirme o agendamento no PetCura.",
      },
      { property: "og:title", content: "Agendar serviço | PetCura" },
      {
        property: "og:description",
        content: "Agende banho, tosa e consultas veterinárias em poucos toques.",
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
  breed: z.string().trim().max(60).optional(),
  temperament: z.string().trim().max(300).optional(),
  allergies: z.string().trim().max(300).optional(),
});

const addressSchema = z.object({
  label: z.string().trim().max(40).optional(),
  cep: z.string().trim().max(12).optional(),
  street: z.string().trim().min(3, "Informe a rua"),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(60).optional(),
  district: z.string().trim().min(2, "Informe o bairro"),
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

function isPastSlot(date: string, hour: string) {
  return new Date(`${date}T${hour}:00`).getTime() < Date.now();
}

function Agendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { campanha } = useSearch({ from: "/_authenticated/agendar" });
  const isBirthdayOffer = campanha === "niver";

  const [category, setCategory] = useState("banho");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState(
    isBirthdayOffer ? "Cliente veio pela oferta de aniversário (20% de desconto)." : "",
  );

  const availableHours = useMemo(() => hours.filter((h) => !isPastSlot(date, h)), [date]);

  useEffect(() => {
    if (availableHours.length > 0 && !availableHours.includes(time)) {
      setTime(availableHours[0]!);
    }
  }, [availableHours, time]);

  const [newPet, setNewPet] = useState({
    name: "",
    species: "cachorro",
    breed: "",
    temperament: "",
    allergies: "",
  });

  const [logisticsType, setLogisticsType] = useState<LogisticsType>("levar");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({
    label: "Casa",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    reference: "",
  });

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
        .select("id, name, species, breed")
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
        .select("id, label, street, number, district, is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const createPet = useMutation({
    mutationFn: async () => {
      const parsed = petSchema.parse(newPet);
      const { data, error } = await supabase
        .from("pets")
        .insert({
          owner_id: user!.id,
          name: parsed.name,
          species: parsed.species,
          breed: parsed.breed || null,
          temperament: parsed.temperament || null,
          allergies: parsed.allergies || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      setPetId(data.id);
      setNewPet({ name: "", species: "cachorro", breed: "", temperament: "", allergies: "" });
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
      const parsed = addressSchema.parse(newAddress);
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: user!.id,
          label: parsed.label || "Casa",
          cep: parsed.cep || null,
          street: parsed.street,
          number: parsed.number || null,
          complement: parsed.complement || null,
          district: parsed.district,
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
  const zone = useMemo(
    () => findZoneForDistrict(zones, selectedAddress?.district),
    [zones, selectedAddress],
  );
  const feeResult = useMemo(() => {
    if (!needsAddress(logisticsType)) return { feeCents: 0, freeApplied: false };
    return computeTransportFeeCents(zone, selectedService?.price_cents ?? 0);
  }, [logisticsType, zone, selectedService]);
  const outOfArea = needsAddress(logisticsType) && Boolean(selectedAddress) && !zone;

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!serviceId) throw new Error("Escolha um serviço");
      const scheduled = new Date(`${date}T${time}:00`);
      if (Number.isNaN(scheduled.getTime())) throw new Error("Data inválida");
      if (scheduled.getTime() < Date.now())
        throw new Error("Esse horário já passou. Escolha outro horário ou outra data.");

      const wantsTransport = needsAddress(logisticsType);
      if (wantsTransport) {
        if (!addressId) throw new Error("Escolha ou cadastre um endereço para retirada/devolução");
        if (!feeResult)
          throw new Error(
            "Ainda não atendemos esse bairro para retirada/devolução. Fale com a gente pelo WhatsApp.",
          );
      }

      const servicePriceCents = selectedService?.price_cents ?? 0;
      const transportPriceCents = feeResult?.feeCents ?? 0;

      const { data: appt, error } = await supabase
        .from("appointments")
        .insert({
          user_id: user!.id,
          service_id: serviceId,
          pet_id: petId,
          scheduled_at: scheduled.toISOString(),
          notes: notes.trim().slice(0, 500) || null,
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
        const { error: transportError } = await supabase.from("transport_orders").insert({
          appointment_id: appt.id,
          address_id: addressId,
          zone_id: zone?.id ?? null,
          price_cents: transportPriceCents,
        });
        if (transportError) throw transportError;
      }

      // Best-effort: an initial history row so the tutor's timeline has a starting
      // point. Not critical to the booking itself, so a failure here doesn't block it.
      const { error: historyError } = await supabase.from("pet_status_history").insert({
        appointment_id: appt.id,
        status: "agendado",
        created_by: user!.id,
      });
      if (historyError) console.error(historyError);

      return { scheduled, transportPriceCents, wantsTransport };
    },
    onSuccess: ({ scheduled, transportPriceCents, wantsTransport }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const serviceName = (services ?? []).find((s) => s.id === serviceId)?.name ?? "serviço";
      const petName = (pets ?? []).find((p) => p.id === petId)?.name;
      const addressLine =
        wantsTransport && selectedAddress
          ? `\n• Retirada: ${selectedAddress.street}${selectedAddress.number ? `, ${selectedAddress.number}` : ""} - ${selectedAddress.district}\n• Modalidade: ${logisticsTypeLabels[logisticsType]}\n• Taxa: ${formatBRL(transportPriceCents)}`
          : "";
      const message = `Olá, ${CLINIC.name}! Solicito a liberação/autorização do agendamento:\n• Serviço: ${serviceName}\n• Pet: ${petName ?? "não informado"}\n• Data: ${formatDateTime(scheduled)}${addressLine}${notes.trim() ? `\n• Observações: ${notes.trim()}` : ""}`;
      window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
      toast.success("Agendamento enviado! Confirme a liberação pelo WhatsApp.");
      navigate({ to: "/conta" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível agendar");
    },
  });

  const filteredServices = (services ?? []).filter((s) => s.category === category);

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl">Agendar serviço</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o serviço, o pet e o melhor horário.
      </p>

      {isBirthdayOffer && (
        <div className="mt-3 rounded-2xl border-2 border-gold/50 bg-secondary p-3">
          <p className="text-sm font-semibold">🎉 Oferta de aniversário</p>
          <p className="mt-1 text-xs text-muted-foreground">
            20% de desconto em banho ou tosa hoje. A equipe confirma o valor com desconto ao liberar
            o agendamento pelo WhatsApp.
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => {
              setCategory(c.value);
              setServiceId(null);
            }}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
              category === c.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {filteredServices.map((service) => (
          <li key={service.id}>
            <button
              onClick={() => setServiceId(service.id)}
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border-2 bg-card p-3 text-left shadow-card transition-colors",
                serviceId === service.id ? "border-primary" : "border-transparent",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{service.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {service.duration_min} minutos
                </span>
              </span>
              <span className="shrink-0 font-display text-sm text-primary">
                {formatBRL(service.price_cents)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <section className="mt-6">
        <h2 className="font-display text-lg">Pet</h2>
        {(pets ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {(pets ?? []).map((pet) => (
              <button
                key={pet.id}
                onClick={() => setPetId(pet.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold",
                  petId === pet.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {pet.name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 rounded-2xl bg-card p-3 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cadastrar novo pet
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
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
            className="mt-2 h-10 w-full rounded-xl"
            disabled={createPet.isPending}
            onClick={() => createPet.mutate()}
          >
            Salvar pet
          </Button>
        </div>
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
        <div className="flex flex-wrap gap-2">
          {availableHours.map((h) => (
            <button
              key={h}
              onClick={() => setTime(h)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold",
                time === h
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {h}
            </button>
          ))}
          {availableHours.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Não há mais horários hoje. Escolha outra data acima.
            </p>
          )}
        </div>
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
        <div className="grid grid-cols-2 gap-2">
          {logisticsOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setLogisticsType(option.value)}
              className={cn(
                "rounded-xl px-3 py-2 text-left text-xs font-semibold",
                logisticsType === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <span className="mr-1">{option.icon}</span>
              {logisticsTypeLabels[option.value]}
            </button>
          ))}
        </div>

        {needsAddress(logisticsType) && (
          <div className="space-y-3">
            {(addresses ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(addresses ?? []).map((address) => (
                  <button
                    key={address.id}
                    onClick={() => setAddressId(address.id)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-left text-xs font-semibold",
                      addressId === address.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {address.label}: {address.street}
                    {address.number ? `, ${address.number}` : ""} — {address.district}
                  </button>
                ))}
              </div>
            )}

            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cadastrar novo endereço
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Apelido (ex.: Casa)"
                  value={newAddress.label}
                  maxLength={40}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="col-span-2 h-10 rounded-xl"
                />
                <Input
                  placeholder="Rua"
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

            {selectedAddress && (
              <div className="rounded-2xl border-2 border-primary/30 bg-secondary p-3 text-sm">
                {outOfArea ? (
                  <p className="font-semibold text-destructive">
                    Ainda não atendemos o bairro "{selectedAddress.district}" para
                    retirada/devolução. Fale com a gente pelo WhatsApp para combinar.
                  </p>
                ) : feeResult ? (
                  <p>
                    Taxa de retirada/devolução:{" "}
                    <span className="font-display text-primary">
                      {formatBRL(feeResult.feeCents)}
                    </span>
                    {feeResult.freeApplied && " (grátis para esse valor de serviço!)"}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>

      <Button
        className="mt-5 h-12 w-full rounded-2xl"
        disabled={
          createAppointment.isPending ||
          !serviceId ||
          availableHours.length === 0 ||
          (needsAddress(logisticsType) && (!addressId || !feeResult))
        }
        onClick={() => createAppointment.mutate()}
      >
        {createAppointment.isPending ? "Enviando..." : "Confirmar agendamento"}
      </Button>
    </div>
  );
}
