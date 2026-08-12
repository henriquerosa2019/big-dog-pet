import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Paperclip,
  Printer,
  Scissors,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CLINIC, daysUntil, formatDate, formatDateTime, whatsappLink } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pets/$petId")({
  head: () => ({
    meta: [
      { title: "Ficha do pet | PetCura" },
      {
        name: "description",
        content:
          "Clínica médica do pet: ficha, carteira de vacinas, lembretes de retorno e prontuário veterinário no PetCura.",
      },
      { property: "og:title", content: "Ficha do pet | PetCura" },
      {
        property: "og:description",
        content: "Temperamento, alergias, vacinas, retornos e prontuário veterinário do seu pet.",
      },
    ],
  }),
  component: PetFicha,
});

const fichaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do pet").max(60),
  species: z.string().trim().min(2, "Informe a espécie").max(30),
  breed: z.string().trim().max(60),
  sex: z.string().trim().max(20),
  birth_date: z.string().trim().max(10),
  weight_kg: z.string().trim().max(10),
  temperament: z.string().trim().max(300),
  allergies: z.string().trim().max(300),
  notes: z.string().trim().max(500),
});

const vaccineSchema = z.object({
  vaccine_name: z.string().trim().min(2, "Informe a vacina").max(80),
  dose: z.string().trim().max(40),
  applied_at: z.string().min(10, "Informe a data de aplicação"),
  next_due_at: z.string().trim().max(10),
});

const reminderTypes = ["retirada_pontos", "exame", "retorno", "outro"] as const;

const reminderTypeLabels: Record<(typeof reminderTypes)[number], string> = {
  retirada_pontos: "Retirada de pontos",
  exame: "Exame de retorno",
  retorno: "Consulta de retorno",
  outro: "Outro",
};

const reminderSchema = z.object({
  reminder_type: z.enum(reminderTypes),
  title: z.string().trim().min(2, "Descreva o lembrete").max(120),
  due_date: z.string().min(10, "Informe a data do retorno"),
  notes: z.string().trim().max(300),
});

const recordTypes = ["consulta", "exame", "cirurgia", "retorno", "emergencia", "vacina"] as const;

const recordTypeLabels: Record<(typeof recordTypes)[number], string> = {
  consulta: "Consulta",
  exame: "Exame",
  cirurgia: "Cirurgia",
  retorno: "Retorno",
  emergencia: "Emergência",
  vacina: "Vacina",
};

function WeightChart({ points }: { points: { date: string; weight: number }[] }) {
  if (points.length < 2) return null;
  const width = 280;
  const height = 56;
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.weight - min) / range) * (height - 12) - 6;
    return { x, y };
  });
  const pointsAttr = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Evolução de peso
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full text-primary">
        <polyline points={pointsAttr} fill="none" stroke="currentColor" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2.5" className="fill-primary" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>
          {formatDate(points[0].date)} · {points[0].weight}kg
        </span>
        <span>
          {formatDate(points[points.length - 1].date)} · {points[points.length - 1].weight}kg
        </span>
      </div>
    </div>
  );
}

function PetFicha() {
  const { petId } = useParams({ from: "/_authenticated/pets/$petId" });
  const queryClient = useQueryClient();

  const { data: pet } = useQuery({
    queryKey: ["pet", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select(
          "id, name, species, breed, sex, birth_date, weight_kg, temperament, allergies, notes",
        )
        .eq("id", petId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: vaccines } = useQuery({
    queryKey: ["vaccinations", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccinations")
        .select("id, vaccine_name, dose, applied_at, next_due_at, vet_name, notes")
        .eq("pet_id", petId)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: records } = useQuery({
    queryKey: ["medical_records", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select(
          "id, visit_at, reason, diagnosis, treatment, prescription, weight_kg, vet_name, record_type, medication, dosage, duration, attachments, next_return_date",
        )
        .eq("pet_id", petId)
        .order("visit_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: reminders } = useQuery({
    queryKey: ["care_reminders", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_reminders")
        .select("id, reminder_type, title, due_date, notes, completed")
        .eq("pet_id", petId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    name: "",
    species: "",
    breed: "",
    sex: "",
    birth_date: "",
    weight_kg: "",
    temperament: "",
    allergies: "",
    notes: "",
  });

  useEffect(() => {
    if (!pet) return;
    setForm({
      name: pet.name ?? "",
      species: pet.species ?? "",
      breed: pet.breed ?? "",
      sex: pet.sex ?? "",
      birth_date: pet.birth_date ?? "",
      weight_kg: pet.weight_kg != null ? String(pet.weight_kg) : "",
      temperament: pet.temperament ?? "",
      allergies: pet.allergies ?? "",
      notes: pet.notes ?? "",
    });
  }, [pet]);

  const saveFicha = useMutation({
    mutationFn: async () => {
      const parsed = fichaSchema.parse(form);
      const { error } = await supabase
        .from("pets")
        .update({
          name: parsed.name,
          species: parsed.species,
          breed: parsed.breed || null,
          sex: parsed.sex || null,
          birth_date: parsed.birth_date || null,
          weight_kg: parsed.weight_kg ? Number(parsed.weight_kg.replace(",", ".")) : null,
          temperament: parsed.temperament || null,
          allergies: parsed.allergies || null,
          notes: parsed.notes || null,
        })
        .eq("id", petId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pet", petId] });
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Ficha atualizada");
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError ? error.issues[0]!.message : "Não foi possível salvar a ficha",
      );
    },
  });

  const [vaccine, setVaccine] = useState({
    vaccine_name: "",
    dose: "",
    applied_at: new Date().toISOString().slice(0, 10),
    next_due_at: "",
  });

  const addVaccine = useMutation({
    mutationFn: async () => {
      const parsed = vaccineSchema.parse(vaccine);
      const { error } = await supabase.from("vaccinations").insert({
        pet_id: petId,
        vaccine_name: parsed.vaccine_name,
        dose: parsed.dose || null,
        applied_at: parsed.applied_at,
        next_due_at: parsed.next_due_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccinations"] });
      setVaccine({
        vaccine_name: "",
        dose: "",
        applied_at: new Date().toISOString().slice(0, 10),
        next_due_at: "",
      });
      toast.success("Vacina registrada");
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError ? error.issues[0]!.message : "Não foi possível registrar",
      );
    },
  });

  const removeVaccine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vaccinations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccinations"] });
      toast.success("Registro removido");
    },
    onError: () => toast.error("Não foi possível remover"),
  });

  const [reminder, setReminder] = useState({
    reminder_type: "retorno" as (typeof reminderTypes)[number],
    title: "",
    due_date: "",
    notes: "",
  });

  const addReminder = useMutation({
    mutationFn: async () => {
      const parsed = reminderSchema.parse(reminder);
      const { error } = await supabase.from("care_reminders").insert({
        pet_id: petId,
        reminder_type: parsed.reminder_type,
        title: parsed.title,
        due_date: parsed.due_date,
        notes: parsed.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care_reminders"] });
      setReminder({ reminder_type: "retorno", title: "", due_date: "", notes: "" });
      toast.success("Lembrete de retorno criado");
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError ? error.issues[0]!.message : "Não foi possível registrar",
      );
    },
  });

  const completeReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("care_reminders")
        .update({ completed: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care_reminders"] });
      toast.success("Retorno concluído");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const removeReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("care_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care_reminders"] });
      toast.success("Lembrete removido");
    },
    onError: () => toast.error("Não foi possível remover"),
  });

  const [recordFilter, setRecordFilter] = useState<"todos" | (typeof recordTypes)[number]>(
    "todos",
  );
  const [recordSearch, setRecordSearch] = useState("");

  const filteredRecords = (records ?? []).filter((r) => {
    const matchesType = recordFilter === "todos" || r.record_type === recordFilter;
    const haystack = [r.reason, r.diagnosis, r.treatment, r.medication, r.prescription]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !recordSearch.trim() || haystack.includes(recordSearch.trim().toLowerCase());
    return matchesType && matchesSearch;
  });

  const weightPoints = (records ?? [])
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ date: r.visit_at, weight: Number(r.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage
      .from("medical-attachments")
      .createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const vaccineAlerts = (vaccines ?? [])
    .filter((v) => v.next_due_at && daysUntil(v.next_due_at) <= 30)
    .map((v) => ({
      key: `vaccine-${v.id}`,
      days: daysUntil(v.next_due_at!),
      dueDate: v.next_due_at!,
      title:
        daysUntil(v.next_due_at!) < 0
          ? `Reforço de ${v.vaccine_name} atrasado`
          : `Reforço de ${v.vaccine_name} em ${daysUntil(v.next_due_at!)} dia(s)`,
      whatsappMsg: `Olá, ${CLINIC.name}! Gostaria de agendar o reforço da vacina ${v.vaccine_name} do meu pet ${pet?.name ?? ""} (retorno previsto para ${formatDate(v.next_due_at!)}).`,
    }));

  const reminderAlerts = (reminders ?? [])
    .filter((r) => !r.completed && daysUntil(r.due_date) <= 30)
    .map((r) => ({
      key: `reminder-${r.id}`,
      days: daysUntil(r.due_date),
      dueDate: r.due_date,
      title:
        daysUntil(r.due_date) < 0
          ? `${r.title} atrasado(a)`
          : `${r.title} em ${daysUntil(r.due_date)} dia(s)`,
      whatsappMsg: `Olá, ${CLINIC.name}! Gostaria de agendar "${r.title}" (${reminderTypeLabels[r.reminder_type as (typeof reminderTypes)[number]]}) do meu pet ${pet?.name ?? ""} (previsto para ${formatDate(r.due_date)}).`,
    }));

  const allAlerts = [...vaccineAlerts, ...reminderAlerts].sort((a, b) => a.days - b.days);

  const selectedReminderLabel = reminderTypeLabels[reminder.reminder_type];

  return (
    <div className="p-4">
      <Link to="/conta" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para a conta
      </Link>
      <h1 className="mt-2 font-display text-2xl">{pet?.name ?? "Ficha do pet"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Temperamento, alergias, vacinas, retornos e histórico clínico.
      </p>

      {allAlerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {allAlerts.map((a) => (
            <div
              key={a.key}
              className="flex items-start gap-2 rounded-2xl border-2 border-primary/30 bg-secondary p-3"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 text-xs">
                <p className="font-semibold">{a.title}</p>
                <p className="text-muted-foreground">Retorno: {formatDate(a.dueDate)}</p>
                <a
                  className="mt-1 inline-block font-semibold text-primary underline"
                  href={whatsappLink(a.whatsappMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Agendar no WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="mt-6">
        <div className="flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg">Clínica Médica</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ficha, carteira de vacinas, lembretes de retorno e prontuário do seu pet, tudo em um só
          lugar.
        </p>

        <Tabs defaultValue="ficha" className="mt-3">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ficha">Ficha</TabsTrigger>
            <TabsTrigger value="vacinas">Vacinas</TabsTrigger>
            <TabsTrigger value="retornos">Retornos</TabsTrigger>
            <TabsTrigger value="prontuario">Prontuário</TabsTrigger>
          </TabsList>

          <TabsContent value="ficha" className="mt-3">
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    maxLength={60}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="species">Espécie</Label>
                  <Input
                    id="species"
                    value={form.species}
                    maxLength={30}
                    onChange={(e) => setForm({ ...form, species: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="breed">Raça</Label>
                  <Input
                    id="breed"
                    value={form.breed}
                    maxLength={60}
                    onChange={(e) => setForm({ ...form, breed: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="sex">Sexo</Label>
                  <Input
                    id="sex"
                    placeholder="Macho / Fêmea"
                    value={form.sex}
                    maxLength={20}
                    onChange={(e) => setForm({ ...form, sex: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="birth">Nascimento</Label>
                  <Input
                    id="birth"
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="weight">Peso (kg)</Label>
                  <Input
                    id="weight"
                    inputMode="decimal"
                    value={form.weight_kg}
                    maxLength={10}
                    onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="temperament">Temperamento</Label>
                  <Textarea
                    id="temperament"
                    placeholder="Dócil, agitado, medroso com barulho, não gosta de secador..."
                    value={form.temperament}
                    maxLength={300}
                    onChange={(e) => setForm({ ...form, temperament: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="allergies">Alergias</Label>
                  <Textarea
                    id="allergies"
                    placeholder="Alergia a shampoo neutro, frango, medicamentos..."
                    value={form.allergies}
                    maxLength={300}
                    onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="petnotes">Observações</Label>
                  <Textarea
                    id="petnotes"
                    value={form.notes}
                    maxLength={500}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 rounded-xl"
                  />
                </div>
              </div>
              <Button
                className="mt-3 h-11 w-full rounded-xl"
                disabled={saveFicha.isPending}
                onClick={() => saveFicha.mutate()}
              >
                {saveFicha.isPending ? "Salvando..." : "Salvar ficha"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="vacinas" className="mt-3 space-y-2">
            <ul className="space-y-2">
              {(vaccines ?? []).map((v) => (
                <li key={v.id} className="rounded-2xl bg-card p-3 shadow-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        <Syringe className="mr-1 inline h-3.5 w-3.5 text-primary" />
                        {v.vaccine_name}
                        {v.dose ? ` · ${v.dose}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Aplicada em {formatDate(v.applied_at)}
                        {v.next_due_at ? ` · retorno ${formatDate(v.next_due_at)}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => removeVaccine.mutate(v.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
              {(vaccines ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhuma vacina registrada.</li>
              )}
            </ul>

            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Registrar vacina
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Vacina (ex: V10)"
                  value={vaccine.vaccine_name}
                  maxLength={80}
                  onChange={(e) => setVaccine({ ...vaccine, vaccine_name: e.target.value })}
                  className="col-span-2 h-11 rounded-xl"
                />
                <Input
                  placeholder="Dose (opcional)"
                  value={vaccine.dose}
                  maxLength={40}
                  onChange={(e) => setVaccine({ ...vaccine, dose: e.target.value })}
                  className="col-span-2 h-11 rounded-xl"
                />
                <div>
                  <Label htmlFor="applied">Aplicação</Label>
                  <Input
                    id="applied"
                    type="date"
                    value={vaccine.applied_at}
                    onChange={(e) => setVaccine({ ...vaccine, applied_at: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="due">Retorno</Label>
                  <Input
                    id="due"
                    type="date"
                    value={vaccine.next_due_at}
                    onChange={(e) => setVaccine({ ...vaccine, next_due_at: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                className="mt-2 h-11 w-full rounded-xl"
                disabled={addVaccine.isPending}
                onClick={() => addVaccine.mutate()}
              >
                Salvar vacina
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="retornos" className="mt-3 space-y-2">
            <ul className="space-y-2">
              {(reminders ?? []).map((r) => (
                <li key={r.id} className="rounded-2xl bg-card p-3 shadow-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        <Scissors className="mr-1 inline h-3.5 w-3.5 text-primary" />
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reminderTypeLabels[r.reminder_type as (typeof reminderTypes)[number]]} ·{" "}
                        {r.completed ? "concluído" : formatDate(r.due_date)}
                      </p>
                      {r.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!r.completed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => completeReminder.mutate(r.id)}
                        >
                          Concluir
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => removeReminder.mutate(r.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
              {(reminders ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Nenhum lembrete de retorno.</li>
              )}
            </ul>

            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novo lembrete de retorno
              </p>
              <div className="mt-2 space-y-2">
                <Select
                  value={reminder.reminder_type}
                  onValueChange={(value) =>
                    setReminder({
                      ...reminder,
                      reminder_type: value as (typeof reminderTypes)[number],
                    })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={selectedReminderLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {reminderTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Título (ex: Retirada de pontos da castração)"
                  value={reminder.title}
                  maxLength={120}
                  onChange={(e) => setReminder({ ...reminder, title: e.target.value })}
                  className="h-11 rounded-xl"
                />
                <div>
                  <Label htmlFor="reminder-due">Data prevista</Label>
                  <Input
                    id="reminder-due"
                    type="date"
                    value={reminder.due_date}
                    onChange={(e) => setReminder({ ...reminder, due_date: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <Textarea
                  placeholder="Observações (opcional)"
                  value={reminder.notes}
                  maxLength={300}
                  onChange={(e) => setReminder({ ...reminder, notes: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <Button
                variant="secondary"
                className="mt-2 h-11 w-full rounded-xl"
                disabled={addReminder.isPending}
                onClick={() => addReminder.mutate()}
              >
                Salvar lembrete
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="prontuario" className="mt-3 space-y-3 print:mt-0">
            <div className="flex items-center justify-between gap-2 print:hidden">
              <p className="text-xs text-muted-foreground">
                Registros preenchidos pela equipe clínica do {CLINIC.name}.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1 text-xs"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                Exportar
              </Button>
            </div>

            <WeightChart points={weightPoints} />

            <div className="flex gap-2 print:hidden">
              <Select
                value={recordFilter}
                onValueChange={(value) =>
                  setRecordFilter(value as "todos" | (typeof recordTypes)[number])
                }
              >
                <SelectTrigger className="h-10 flex-1 rounded-xl text-xs">
                  <SelectValue
                    placeholder={
                      recordFilter === "todos" ? "Todos os tipos" : recordTypeLabels[recordFilter]
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {recordTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {recordTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Buscar no histórico..."
              value={recordSearch}
              onChange={(e) => setRecordSearch(e.target.value)}
              className="h-10 rounded-xl text-xs print:hidden"
            />

            <ul className="space-y-2">
              {filteredRecords.map((r) => (
                <li key={r.id} className="rounded-2xl bg-card p-3 shadow-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="mb-1 text-[10px]">
                        {recordTypeLabels[r.record_type as (typeof recordTypes)[number]] ??
                          r.record_type}
                      </Badge>
                      <p className="truncate text-sm font-semibold">{r.reason}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {formatDateTime(r.visit_at)}
                    </Badge>
                  </div>
                  {r.diagnosis && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Diagnóstico: {r.diagnosis}
                    </p>
                  )}
                  {r.treatment && (
                    <p className="text-xs text-muted-foreground">Tratamento: {r.treatment}</p>
                  )}
                  {r.prescription && (
                    <p className="text-xs text-muted-foreground">Prescrição: {r.prescription}</p>
                  )}
                  {r.medication && (
                    <p className="text-xs text-muted-foreground">
                      Medicação: {r.medication}
                      {r.dosage ? ` · ${r.dosage}` : ""}
                      {r.duration ? ` · ${r.duration}` : ""}
                    </p>
                  )}
                  {r.next_return_date && (
                    <p className="text-xs text-muted-foreground">
                      Retorno previsto: {formatDate(r.next_return_date)}
                    </p>
                  )}
                  {(r.weight_kg != null || r.vet_name) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.weight_kg != null ? `${r.weight_kg} kg` : ""}
                      {r.weight_kg != null && r.vet_name ? " · " : ""}
                      {r.vet_name ?? ""}
                    </p>
                  )}
                  {(r.attachments ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                      {(r.attachments ?? []).map((path, i) => (
                        <Button
                          key={path}
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 rounded-lg text-[11px]"
                          onClick={() => openAttachment(path)}
                        >
                          <Paperclip className="h-3 w-3" />
                          Anexo {i + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {filteredRecords.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {(records ?? []).length === 0
                    ? "Nenhum atendimento registrado ainda."
                    : "Nenhum registro encontrado para esse filtro."}
                </li>
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
