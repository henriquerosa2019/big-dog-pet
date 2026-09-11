import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  MessageCircle,
  Paperclip,
  Printer,
  Scissors,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { playStatusSound } from "@/lib/soundAlerts";
import { PetAvatar } from "@/components/PetAvatar";
import { PetPhotoUpload } from "@/components/PetPhotoUpload";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  alertBadgeLabel,
  alertTone,
  capitalizeWords,
  CLINIC,
  daysUntil,
  formatDate,
  formatDateTime,
  statusToneCardClass,
  statusToneClass,
  statusToneIconClass,
} from "@/lib/format";
import { petSizeLabels, type PetSize } from "@/lib/transport";
import { cn } from "@/lib/utils";
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
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ficha do pet | Big Dog Pet" },
      {
        name: "description",
        content:
          "Ficha do pet na Big Dog Pet: dados, carteira de vacinas, lembretes de retorno e histórico de cuidados.",
      },
      { property: "og:title", content: "Ficha do pet | Big Dog Pet" },
      {
        property: "og:description",
        content: "Temperamento, alergias, vacinas, retornos e histórico de cuidados do seu pet.",
      },
    ],
  }),
  component: PetFicha,
});

const fichaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do pet").max(60),
  species: z.string().trim().min(2, "Informe a espécie").max(30),
  size: z.enum(["pequeno", "medio", "grande"]),
  breed: z.string().trim().max(60),
  sex: z.string().trim().max(20),
  birth_date: z.string().trim().max(10),
  weight_kg: z.string().trim().max(10),
  temperament: z.string().trim().max(300),
  allergies: z.string().trim().max(300),
  notes: z.string().trim().max(500),
  photo_url: z.string().nullable().optional(),
});

const petSizeOptions: PetSize[] = ["pequeno", "medio", "grande"];

const vaccineSchema = z.object({
  vaccine_name: z.string().trim().min(2, "Informe a vacina").max(80),
  dose: z.string().trim().max(40),
  applied_at: z.string().min(10, "Informe a data de aplicação"),
  next_due_at: z.string().trim().max(10),
  vet_name: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
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
          {formatDate(points[0]!.date)} · {points[0]!.weight}kg
        </span>
        <span>
          {formatDate(points[points.length - 1]!.date)} · {points[points.length - 1]!.weight}kg
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
          "id, name, species, size, breed, sex, birth_date, weight_kg, temperament, allergies, notes, photo_url",
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
    size: "medio" as PetSize,
    breed: "",
    sex: "",
    birth_date: "",
    weight_kg: "",
    temperament: "",
    allergies: "",
    notes: "",
    photo_url: "" as string | null,
  });

  useEffect(() => {
    if (!pet) return;
    setForm({
      name: pet.name ?? "",
      species: pet.species ?? "",
      size: (pet.size as PetSize) ?? "medio",
      breed: pet.breed ?? "",
      sex: pet.sex ?? "",
      birth_date: pet.birth_date ?? "",
      weight_kg: pet.weight_kg != null ? String(pet.weight_kg) : "",
      temperament: pet.temperament ?? "",
      allergies: pet.allergies ?? "",
      notes: pet.notes ?? "",
      photo_url: (pet.photo_url as string) || null,
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
          size: parsed.size,
          breed: parsed.breed || null,
          sex: parsed.sex || null,
          birth_date: parsed.birth_date || null,
          weight_kg: parsed.weight_kg ? Number(parsed.weight_kg.replace(",", ".")) : null,
          temperament: parsed.temperament || null,
          allergies: parsed.allergies || null,
          notes: parsed.notes || null,
          photo_url: parsed.photo_url || null,
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

  const updatePetPhoto = useMutation({
    mutationFn: async (photoUrl: string | null) => {
      setForm((prev) => ({ ...prev, photo_url: photoUrl }));
      const { error } = await supabase
        .from("pets")
        .update({ photo_url: photoUrl })
        .eq("id", petId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pet", petId] });
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      toast.success("Foto do pet salva com sucesso!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar foto");
    },
  });

  const [vaccine, setVaccine] = useState({
    vaccine_name: "",
    dose: "",
    applied_at: new Date().toISOString().slice(0, 10),
    next_due_at: "",
    vet_name: "",
    notes: "",
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
        vet_name: parsed.vet_name || null,
        notes: parsed.notes || null,
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
        vet_name: "",
        notes: "",
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

  const [recordFilter, setRecordFilter] = useState<"todos" | (typeof recordTypes)[number]>("todos");
  const [recordSearch, setRecordSearch] = useState("");

  const filteredRecords = (records ?? []).filter((r) => {
    const matchesType = recordFilter === "todos" || r.record_type === recordFilter;
    const haystack = [r.reason, r.diagnosis, r.treatment, r.medication, r.prescription]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      !recordSearch.trim() || haystack.includes(recordSearch.trim().toLowerCase());
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
    .map((v) => {
      const days = daysUntil(v.next_due_at!);
      return {
        key: `vaccine-${v.id}`,
        kind: "vacina" as const,
        days,
        dueDate: v.next_due_at!,
        title:
          days < 0
            ? `Reforço de ${v.vaccine_name} atrasado`
            : days === 0
            ? `Reforço de ${v.vaccine_name} vence HOJE!`
            : days === 1
            ? `Reforço de ${v.vaccine_name} vence AMANHÃ!`
            : days === 2
            ? `Reforço de ${v.vaccine_name} em 2 dias`
            : `Reforço de ${v.vaccine_name} em ${days} dias`,
        whatsappMsg: `Olá, ${CLINIC.name}! Gostaria de agendar o reforço da vacina ${v.vaccine_name} do meu pet ${pet?.name ? capitalizeWords(pet.name) : ""} (retorno previsto para ${formatDate(v.next_due_at!)}).`,
      };
    });

  const reminderAlerts = (reminders ?? [])
    .filter((r) => !r.completed && daysUntil(r.due_date) <= 30)
    .map((r) => {
      const days = daysUntil(r.due_date);
      return {
        key: `reminder-${r.id}`,
        kind: "retorno" as const,
        days,
        dueDate: r.due_date,
        title:
          days < 0
            ? `${r.title} atrasado(a)`
            : days === 0
            ? `${r.title} é HOJE!`
            : days === 1
            ? `${r.title} é AMANHÃ!`
            : days === 2
            ? `${r.title} em 2 dias`
            : `${r.title} em ${days} dias`,
        whatsappMsg: `Olá, ${CLINIC.name}! Gostaria de agendar "${r.title}" (${reminderTypeLabels[r.reminder_type as (typeof reminderTypes)[number]] ?? "Retorno"}) do meu pet ${pet?.name ? capitalizeWords(pet.name) : ""} (previsto para ${formatDate(r.due_date)}).`,
      };
    });

  const medicalAlerts = (records ?? [])
    .filter((r) => r.next_return_date && daysUntil(r.next_return_date) <= 30)
    .filter((r) => {
      return !(reminders ?? []).some((cr) => !cr.completed && cr.due_date === r.next_return_date);
    })
    .map((r) => {
      const days = daysUntil(r.next_return_date!);
      const motivo = r.reason ? ` (${r.reason})` : "";
      return {
        key: `medical-${r.id}`,
        kind: "retorno" as const,
        days,
        dueDate: r.next_return_date!,
        title:
          days < 0
            ? `Retorno médico atrasado${motivo}`
            : days === 0
            ? `Retorno médico HOJE!${motivo}`
            : days === 1
            ? `Retorno médico AMANHÃ!${motivo}`
            : days === 2
            ? `Retorno médico em 2 dias${motivo}`
            : `Retorno médico em ${days} dias${motivo}`,
        whatsappMsg: `Olá, ${CLINIC.name}! Gostaria de agendar o retorno médico do meu pet ${pet?.name ? capitalizeWords(pet.name) : ""} referente a "${r.reason || "Consulta"}" (previsto para ${formatDate(r.next_return_date!)}).`,
      };
    });

  const allAlerts = [...vaccineAlerts, ...reminderAlerts, ...medicalAlerts].sort((a, b) => {
    if (a.days === 0 && b.days !== 0) return -1;
    if (a.days !== 0 && b.days === 0) return 1;
    if (a.days < 0 && b.days >= 0) return -1;
    if (a.days >= 0 && b.days < 0) return 1;
    return a.days - b.days;
  });

  const hasPlayedSoundRef = useRef(false);

  useEffect(() => {
    const hasTodayAlert = allAlerts.some((a) => a.days === 0);
    if (hasTodayAlert && !hasPlayedSoundRef.current) {
      hasPlayedSoundRef.current = true;
      playStatusSound("alerta", 2);
      setTimeout(() => {
        const el = document.getElementById("aviso-hoje");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 400);
    }
  }, [allAlerts]);

  const selectedReminderLabel = reminderTypeLabels[reminder.reminder_type];

  return (
    <div className="p-4">
      <Link
        to="/conta"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para a conta
      </Link>
      <div className="mt-3 flex items-center gap-3.5 bg-card p-4 rounded-3xl border border-border/70 shadow-card">
        <PetAvatar
          photoUrl={form.photo_url || pet?.photo_url}
          name={pet?.name}
          species={pet?.species}
          size="xl"
          className="ring-2 ring-primary/20"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-black text-foreground truncate">
            {pet?.name ? capitalizeWords(pet.name) : "Ficha do pet"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pet?.species ? capitalizeWords(pet.species) : "Pet"}
            {pet?.breed ? ` · ${pet.breed}` : ""}
            {pet?.size ? ` · Porte ${petSizeLabels[pet.size as PetSize]}` : ""}
          </p>
        </div>
      </div>

      {allAlerts.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {allAlerts.map((a) => {
            const isHoje = a.days === 0;
            const tone = alertTone(a.days);
            return (
              <div
                key={a.key}
                id={isHoje ? "aviso-hoje" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border-2 p-3.5 shadow-card transition-all",
                  statusToneCardClass(tone),
                  isHoje && "ring-2 ring-red-500/50 shadow-md",
                )}
              >
                {a.kind === "vacina" ? (
                  <Syringe className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                ) : (
                  <Stethoscope className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                )}
                <div className="min-w-0 flex-1 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground">{a.title}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 whitespace-nowrap text-[10px] font-bold",
                        statusToneClass(tone),
                      )}
                    >
                      {alertBadgeLabel(a.days)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5">
                    Data prevista: {formatDate(a.dueDate)}
                    {a.days < 0 && ` · Atrasado há ${Math.abs(a.days)} dia(s)`}
                    {a.days === 0 && ` · 🔔 Vence HOJE!`}
                    {a.days === 1 && ` · ⚠️ Vence amanhã!`}
                    {a.days === 2 && ` · 🟡 Vence em 2 dias!`}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      onClick={() =>
                        openInAppChat({
                          petId: pet?.id,
                          petName: pet?.name,
                          contextTag: a.title,
                          defaultText: a.whatsappMsg,
                        })
                      }
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      💬 Chat - Falar com Petshop agora!!!
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
            <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-3">
              {/* Seção de Upload da Foto do Pet */}
              <PetPhotoUpload
                value={form.photo_url || pet?.photo_url}
                onChange={(photo_url) => updatePetPhoto.mutate(photo_url)}
                petName={form.name || pet?.name}
                species={form.species || pet?.species}
              />

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
                <div className="col-span-2">
                  <Label>Porte</Label>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Define se pode ser transportado de moto na retirada/devolução.
                  </p>
                  <div className="mt-1 flex gap-2">
                    {petSizeOptions.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setForm({ ...form, size })}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-xs font-semibold",
                          form.size === size
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {petSizeLabels[size]}
                      </button>
                    ))}
                  </div>
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

          <TabsContent value="vacinas" className="mt-3 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Syringe className="h-4 w-4 text-primary" />
                  Linha do Tempo de Vacinas
                </h3>
                <p className="text-xs text-muted-foreground">
                  Registro cronológico de aplicações, retornos e observações no período
                </p>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {(vaccines ?? []).length} registro(s)
              </Badge>
            </div>

            {(vaccines ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground bg-card">
                <Syringe className="mx-auto h-8 w-8 opacity-40 mb-1 text-primary" />
                Nenhuma vacina registrada ainda na carteirinha do pet.
              </div>
            ) : (
              <div className="relative border-l-2 border-primary/25 pl-4 ml-3.5 space-y-3.5 my-2">
                {(vaccines ?? []).map((v) => {
                  const isOverdue = v.next_due_at && daysUntil(v.next_due_at) < 0;
                  const isUpcoming =
                    v.next_due_at &&
                    daysUntil(v.next_due_at) >= 0 &&
                    daysUntil(v.next_due_at) <= 30;

                  return (
                    <div key={v.id} className="relative">
                      {/* Nó da Linha do Tempo */}
                      <div
                        className={cn(
                          "absolute -left-[27px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-sm ring-4 ring-background",
                          v.next_due_at
                            ? alertTone(daysUntil(v.next_due_at)) === "danger"
                              ? "bg-rose-600 text-white"
                              : alertTone(daysUntil(v.next_due_at)) === "pending"
                                ? "bg-amber-500 text-white"
                                : "bg-sky-500 text-white"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        <Syringe className="h-3 w-3" />
                      </div>

                      <div className="rounded-2xl bg-card p-3.5 shadow-card border border-border/50 hover:border-primary/40 transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-foreground">
                                {v.vaccine_name}
                              </span>
                              {v.dose && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium border-primary/30 text-primary"
                                >
                                  {v.dose}
                                </Badge>
                              )}
                              {v.next_due_at && (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] font-bold",
                                    statusToneClass(alertTone(daysUntil(v.next_due_at))),
                                  )}
                                >
                                  Reforço: {alertBadgeLabel(daysUntil(v.next_due_at))} ({formatDate(v.next_due_at)})
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>
                                Aplicada em{" "}
                                <strong className="text-foreground">{formatDate(v.applied_at)}</strong>
                              </span>
                              {v.vet_name && (
                                <>
                                  <span>•</span>
                                  <span>Dr(a). {v.vet_name}</span>
                                </>
                              )}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeVaccine.mutate(v.id)}
                          >
                            Remover
                          </Button>
                        </div>

                        {/* Observações importantes do período para o veterinário */}
                        {v.notes && (
                          <div className="mt-2.5 rounded-xl bg-muted/50 p-2.5 text-xs text-foreground border border-border/50">
                            <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">
                              Observações do Período / Reações:
                            </span>
                            <p className="whitespace-pre-line">{v.notes}</p>
                          </div>
                        )}

                        {/* Botão de Contato em 1 Toque via Chat do App */}
                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            Dúvidas ou agendar reforço?
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs gap-1.5 text-primary bg-primary/10 hover:bg-primary/20 rounded-lg"
                            onClick={() =>
                              openInAppChat({
                                petId: pet?.id,
                                petName: pet?.name,
                                contextTag: `Vacina ${v.vaccine_name}`,
                                defaultText: `Olá! Gostaria de falar sobre a vacina ${v.vaccine_name} do pet ${pet?.name ? capitalizeWords(pet.name) : ""} (aplicada em ${formatDate(v.applied_at)}).`,
                              })
                            }
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Chat no App (1 toque)
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-2xl bg-card p-3.5 shadow-card border border-border/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Syringe className="h-3.5 w-3.5 text-primary" />
                Registrar nova vacina na linha do tempo
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Vacina (ex: V10, Raiva, Gripe)"
                  value={vaccine.vaccine_name}
                  maxLength={80}
                  onChange={(e) => setVaccine({ ...vaccine, vaccine_name: e.target.value })}
                  className="col-span-2 h-10 rounded-xl text-xs"
                />
                <Input
                  placeholder="Dose (ex: 1ª Dose, Reforço Anual)"
                  value={vaccine.dose}
                  maxLength={40}
                  onChange={(e) => setVaccine({ ...vaccine, dose: e.target.value })}
                  className="h-10 rounded-xl text-xs"
                />
                <Input
                  placeholder="Veterinário responsável (opcional)"
                  value={vaccine.vet_name}
                  maxLength={80}
                  onChange={(e) => setVaccine({ ...vaccine, vet_name: e.target.value })}
                  className="h-10 rounded-xl text-xs"
                />
                <div>
                  <Label htmlFor="applied" className="text-xs">Data da Aplicação</Label>
                  <Input
                    id="applied"
                    type="date"
                    value={vaccine.applied_at}
                    onChange={(e) => setVaccine({ ...vaccine, applied_at: e.target.value })}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="due" className="text-xs">Previsão Próxima Dose</Label>
                  <Input
                    id="due"
                    type="date"
                    value={vaccine.next_due_at}
                    onChange={(e) => setVaccine({ ...vaccine, next_due_at: e.target.value })}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="vaccine-notes" className="text-xs">Observações do período (reações, cuidados, lote)</Label>
                  <Textarea
                    id="vaccine-notes"
                    placeholder="Ex: Pet sem reações adversas, vermifugado junto..."
                    value={vaccine.notes}
                    maxLength={500}
                    onChange={(e) => setVaccine({ ...vaccine, notes: e.target.value })}
                    className="mt-1 rounded-xl text-xs"
                    rows={2}
                  />
                </div>
              </div>
              <Button
                variant="default"
                className="mt-3 h-10 w-full rounded-xl text-xs font-semibold"
                disabled={addVaccine.isPending}
                onClick={() => addVaccine.mutate()}
              >
                {addVaccine.isPending ? "Salvando..." : "Adicionar à Linha do Tempo"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="retornos" className="mt-3 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  Linha do Tempo de Retornos e Prazos
                </h3>
                <p className="text-xs text-muted-foreground">
                  Acompanhamento cronológico de retornos clínicos, retiradas de pontos e exames
                </p>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {(reminders ?? []).length} registro(s)
              </Badge>
            </div>

            {(reminders ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground bg-card">
                <Clock className="mx-auto h-8 w-8 opacity-40 mb-1 text-primary" />
                Nenhum retorno ou lembrete agendado para este pet.
              </div>
            ) : (
              <div className="relative border-l-2 border-primary/25 pl-4 ml-3.5 space-y-3.5 my-2">
                {(reminders ?? []).map((r) => {
                  const isDone = r.completed;
                  const days = daysUntil(r.due_date);
                  const isLate = !isDone && days < 0;

                  return (
                    <div key={r.id} className="relative">
                      {/* Nó da Linha do Tempo */}
                      <div
                        className={cn(
                          "absolute -left-[27px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-sm ring-4 ring-background",
                          isDone
                            ? "bg-emerald-600 text-white"
                            : alertTone(days) === "danger"
                              ? "bg-rose-600 text-white"
                              : alertTone(days) === "pending"
                                ? "bg-amber-500 text-white"
                                : "bg-sky-500 text-white",
                        )}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl bg-card p-3.5 shadow-card border transition-colors",
                          isDone
                            ? "border-border/30 opacity-85"
                            : "border-border/60 hover:border-primary/40",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  "text-sm font-bold text-foreground",
                                  isDone && "line-through text-muted-foreground",
                                )}
                              >
                                {r.title}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {reminderTypeLabels[
                                  r.reminder_type as (typeof reminderTypes)[number]
                                ] ?? r.reminder_type}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] font-bold",
                                  isDone
                                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300"
                                    : statusToneClass(alertTone(days)),
                                )}
                              >
                                {isDone
                                  ? "Concluído"
                                  : `${alertBadgeLabel(days)} (${formatDate(r.due_date)})`}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Data prevista:{" "}
                              <strong className="text-foreground">{formatDate(r.due_date)}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isDone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => completeReminder.mutate(r.id)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Concluir
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                              onClick={() => removeReminder.mutate(r.id)}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>

                        {/* Observações clínicas importantes do retorno */}
                        {r.notes && (
                          <div className="mt-2.5 rounded-xl bg-muted/50 p-2.5 text-xs text-foreground border border-border/50">
                            <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-0.5">
                              Observações / O que avaliar no retorno:
                            </span>
                            <p className="whitespace-pre-line">{r.notes}</p>
                          </div>
                        )}

                        {/* Botão de Contato em 1 Toque via Chat do App */}
                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            Confirmar ou reagendar retorno?
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs gap-1.5 text-primary bg-primary/10 hover:bg-primary/20 rounded-lg"
                            onClick={() =>
                              openInAppChat({
                                petId: pet?.id,
                                petName: pet?.name,
                                contextTag: `Retorno: ${r.title}`,
                                defaultText: `Olá! Gostaria de falar sobre o retorno "${r.title}" (${reminderTypeLabels[r.reminder_type as (typeof reminderTypes)[number]] ?? r.reminder_type}) do pet ${pet?.name ? capitalizeWords(pet.name) : ""}, previsto para ${formatDate(r.due_date)}.`,
                              })
                            }
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Chat no App (1 toque)
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-2xl bg-card p-3.5 shadow-card border border-border/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Novo lembrete de retorno na linha do tempo
              </p>
              <div className="mt-2.5 space-y-2">
                <Select
                  value={reminder.reminder_type}
                  onValueChange={(value) =>
                    setReminder({
                      ...reminder,
                      reminder_type: value as (typeof reminderTypes)[number],
                    })
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs">
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
                  placeholder="Título (ex: Retirada de pontos, Exame de sangue)"
                  value={reminder.title}
                  maxLength={120}
                  onChange={(e) => setReminder({ ...reminder, title: e.target.value })}
                  className="h-10 rounded-xl text-xs"
                />
                <div>
                  <Label htmlFor="reminder-due" className="text-xs">Data prevista</Label>
                  <Input
                    id="reminder-due"
                    type="date"
                    value={reminder.due_date}
                    onChange={(e) => setReminder({ ...reminder, due_date: e.target.value })}
                    className="mt-1 h-10 rounded-xl text-xs"
                  />
                </div>
                <Textarea
                  placeholder="Observações clínicas para o veterinário (ex: checar cicatrização, jejum...)"
                  value={reminder.notes}
                  maxLength={300}
                  onChange={(e) => setReminder({ ...reminder, notes: e.target.value })}
                  className="rounded-xl text-xs"
                  rows={2}
                />
              </div>
              <Button
                variant="default"
                className="mt-3 h-10 w-full rounded-xl text-xs font-semibold"
                disabled={addReminder.isPending}
                onClick={() => addReminder.mutate()}
              >
                {addReminder.isPending ? "Salvando..." : "Adicionar à Linha do Tempo"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="prontuario" className="mt-3 space-y-4 print:mt-0">
            <div className="flex items-center justify-between gap-2 print:hidden">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Linha do Tempo do Prontuário Médico
                </h3>
                <p className="text-xs text-muted-foreground">
                  Registros cronológicos de consultas, diagnósticos, tratamentos e evolução clínica
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs rounded-xl"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir / PDF
              </Button>
            </div>

            {/* Resumo do Pet no Prontuário com Foto */}
            <div className="rounded-2xl bg-card p-3.5 shadow-card border border-border/70 flex items-center gap-3.5">
              <PetAvatar
                photoUrl={pet?.photo_url || form.photo_url}
                name={pet?.name}
                species={pet?.species}
                size="lg"
                className="ring-2 ring-primary/20 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-foreground truncate">
                  {pet?.name ? capitalizeWords(pet.name) : "Pet"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pet?.species ? capitalizeWords(pet.species) : "Pet"}
                  {pet?.breed ? ` · ${pet.breed}` : ""}
                  {pet?.size ? ` · Porte ${petSizeLabels[pet.size as PetSize]}` : ""}
                  {pet?.weight_kg != null ? ` · ${pet.weight_kg} kg` : ""}
                </p>
                {(pet?.allergies || pet?.temperament) && (
                  <div className="flex flex-wrap gap-1.5 mt-1 text-[11px]">
                    {pet?.allergies && (
                      <span className="bg-destructive/10 text-destructive font-medium px-2 py-0.5 rounded-md">
                        Alergias: {pet.allergies}
                      </span>
                    )}
                    {pet?.temperament && (
                      <span className="bg-secondary text-secondary-foreground font-medium px-2 py-0.5 rounded-md">
                        {pet.temperament}
                      </span>
                    )}
                  </div>
                )}
              </div>
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
                  <SelectItem value="todos">Todos os tipos de atendimento</SelectItem>
                  {recordTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {recordTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Buscar por sintoma, diagnóstico, medicamento ou motivo..."
              value={recordSearch}
              onChange={(e) => setRecordSearch(e.target.value)}
              className="h-10 rounded-xl text-xs print:hidden"
            />

            {filteredRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground bg-card">
                <Stethoscope className="mx-auto h-8 w-8 opacity-40 mb-1 text-primary" />
                {(records ?? []).length === 0
                  ? "Nenhum atendimento ou consulta registrado ainda na clínica."
                  : "Nenhum registro encontrado para a busca ou filtro selecionado."}
              </div>
            ) : (
              <div className="relative border-l-2 border-primary/25 pl-4 ml-3.5 space-y-3.5 my-2">
                {filteredRecords.map((r) => (
                  <div key={r.id} className="relative">
                    {/* Nó da Linha do Tempo */}
                    <div className="absolute -left-[27px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs shadow-sm ring-4 ring-background">
                      <Stethoscope className="h-3 w-3" />
                    </div>

                    <div className="rounded-2xl bg-card p-3.5 shadow-card border border-border/60 hover:border-primary/40 transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold border-primary/30 text-primary"
                            >
                              {recordTypeLabels[r.record_type as (typeof recordTypes)[number]] ??
                                r.record_type}
                            </Badge>
                            <h4 className="text-sm font-bold text-foreground truncate">
                              {r.reason}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Atendimento em{" "}
                            <strong className="text-foreground">
                              {formatDateTime(r.visit_at)}
                            </strong>
                            {r.vet_name && ` · Dr(a). ${r.vet_name}`}
                            {r.weight_kg != null && ` · Peso: ${r.weight_kg} kg`}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {formatDate(r.visit_at.slice(0, 10))}
                        </Badge>
                      </div>

                      {/* Observações importantes e conduta médica do período */}
                      <div className="mt-2.5 space-y-1.5 text-xs text-foreground bg-muted/40 rounded-xl p-3 border border-border/40">
                        {r.diagnosis && (
                          <p>
                            <strong className="text-primary font-semibold">Diagnóstico:</strong>{" "}
                            {r.diagnosis}
                          </p>
                        )}
                        {r.treatment && (
                          <p>
                            <strong className="text-foreground font-semibold">
                              Tratamento realizado:
                            </strong>{" "}
                            {r.treatment}
                          </p>
                        )}
                        {r.prescription && (
                          <p>
                            <strong className="text-foreground font-semibold">Prescrição:</strong>{" "}
                            {r.prescription}
                          </p>
                        )}
                        {r.medication && (
                          <p>
                            <strong className="text-foreground font-semibold">Medicação:</strong>{" "}
                            {r.medication}
                            {r.dosage ? ` · Dose: ${r.dosage}` : ""}
                            {r.duration ? ` · Duração: ${r.duration}` : ""}
                          </p>
                        )}
                        {r.next_return_date && (
                          <p className="font-semibold text-amber-700 dark:text-amber-400">
                            📅 Retorno previsto pelo veterinário: {formatDate(r.next_return_date)}
                          </p>
                        )}
                      </div>

                      {/* Anexos */}
                      {(r.attachments ?? []).length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 print:hidden">
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

                      {/* Botão de Contato em 1 Toque via Chat do App */}
                      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 print:hidden">
                        <span className="text-[10px] text-muted-foreground">
                          Dúvidas sobre este atendimento ou receita?
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1.5 text-primary bg-primary/10 hover:bg-primary/20 rounded-lg"
                          onClick={() =>
                            openInAppChat({
                              petId: pet?.id,
                              petName: pet?.name,
                              contextTag: `Atendimento: ${r.reason}`,
                              defaultText: `Olá, Dr(a)! Gostaria de tirar uma dúvida sobre o atendimento "${r.reason}" (${recordTypeLabels[r.record_type as (typeof recordTypes)[number]] ?? r.record_type}) do pet ${pet?.name ? capitalizeWords(pet.name) : ""} realizado em ${formatDateTime(r.visit_at)}.`,
                            })
                          }
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Chat no App (1 toque)
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
