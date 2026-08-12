import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC, formatBRL, formatDateTime, whatsappLink } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agendar")({
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

  const [category, setCategory] = useState("banho");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

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

  const createAppointment = useMutation({
    mutationFn: async () => {
      if (!serviceId) throw new Error("Escolha um serviço");
      const scheduled = new Date(`${date}T${time}:00`);
      if (Number.isNaN(scheduled.getTime())) throw new Error("Data inválida");
      if (scheduled.getTime() < Date.now())
        throw new Error("Esse horário já passou. Escolha outro horário ou outra data.");
      const { error } = await supabase.from("appointments").insert({
        user_id: user!.id,
        service_id: serviceId,
        pet_id: petId,
        scheduled_at: scheduled.toISOString(),
        notes: notes.trim().slice(0, 500) || null,
      });
      if (error) throw error;
      return { scheduled };
    },
    onSuccess: ({ scheduled }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const serviceName = (services ?? []).find((s) => s.id === serviceId)?.name ?? "serviço";
      const petName = (pets ?? []).find((p) => p.id === petId)?.name;
      const message = `Olá, ${CLINIC.name}! Solicito a liberação/autorização do agendamento:\n• Serviço: ${serviceName}\n• Pet: ${petName ?? "não informado"}\n• Data: ${formatDateTime(scheduled)}${notes.trim() ? `\n• Observações: ${notes.trim()}` : ""}`;
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

      <Button
        className="mt-5 h-12 w-full rounded-2xl"
        disabled={createAppointment.isPending || !serviceId || availableHours.length === 0}
        onClick={() => createAppointment.mutate()}
      >
        {createAppointment.isPending ? "Enviando..." : "Confirmar agendamento"}
      </Button>
    </div>
  );
}
