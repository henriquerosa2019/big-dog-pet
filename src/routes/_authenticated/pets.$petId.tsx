import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Syringe } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CLINIC, daysUntil, formatDate, formatDateTime, whatsappLink } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pets/$petId")({
  head: () => ({
    meta: [
      { title: "Ficha do pet | PetCura" },
      {
        name: "description",
        content:
          "Ficha completa do pet com temperamento, alergias, controle de vacinas e histórico clínico no PetCura.",
      },
      { property: "og:title", content: "Ficha do pet | PetCura" },
      {
        property: "og:description",
        content: "Temperamento, alergias, vacinas e prontuário veterinário do seu pet.",
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
        .select("id, visit_at, reason, diagnosis, treatment, prescription, weight_kg, vet_name")
        .eq("pet_id", petId)
        .order("visit_at", { ascending: false });
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

  const alerts = (vaccines ?? []).filter(
    (v) => v.next_due_at && daysUntil(v.next_due_at) <= 30,
  );

  return (
    <div className="p-4">
      <Link to="/conta" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para a conta
      </Link>
      <h1 className="mt-2 font-display text-2xl">{pet?.name ?? "Ficha do pet"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Temperamento, alergias, vacinas e histórico clínico.
      </p>

      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {alerts.map((v) => {
            const days = daysUntil(v.next_due_at!);
            return (
              <div
                key={v.id}
                className="flex items-start gap-2 rounded-2xl border-2 border-primary/30 bg-secondary p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold">
                    {days < 0
                      ? `Reforço de ${v.vaccine_name} atrasado`
                      : `Reforço de ${v.vaccine_name} em ${days} dia(s)`}
                  </p>
                  <p className="text-muted-foreground">Retorno: {formatDate(v.next_due_at!)}</p>
                  <a
                    className="mt-1 inline-block font-semibold text-primary underline"
                    href={whatsappLink(
                      `Olá, ${CLINIC.name}! Gostaria de agendar o reforço da vacina ${v.vaccine_name} do meu pet ${pet?.name ?? ""} (retorno previsto para ${formatDate(v.next_due_at!)}).`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Agendar reforço no WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-6 rounded-2xl bg-card p-3 shadow-card">
        <h2 className="font-display text-lg">Ficha do pet</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
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
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg">Carteira de vacinas</h2>
        <ul className="mt-3 space-y-2">
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

        <div className="mt-3 rounded-2xl bg-card p-3 shadow-card">
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
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg">Prontuário veterinário</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Registros preenchidos pela equipe clínica do {CLINIC.name}.
        </p>
        <ul className="mt-3 space-y-2">
          {(records ?? []).map((r) => (
            <li key={r.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <p className="min-w-0 truncate text-sm font-semibold">{r.reason}</p>
                <Badge variant="secondary" className="shrink-0">
                  {formatDateTime(r.visit_at)}
                </Badge>
              </div>
              {r.diagnosis && (
                <p className="mt-1 text-xs text-muted-foreground">Diagnóstico: {r.diagnosis}</p>
              )}
              {r.treatment && (
                <p className="text-xs text-muted-foreground">Tratamento: {r.treatment}</p>
              )}
              {r.prescription && (
                <p className="text-xs text-muted-foreground">Prescrição: {r.prescription}</p>
              )}
              {(r.weight_kg != null || r.vet_name) && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.weight_kg != null ? `${r.weight_kg} kg` : ""}
                  {r.weight_kg != null && r.vet_name ? " · " : ""}
                  {r.vet_name ?? ""}
                </p>
              )}
            </li>
          ))}
          {(records ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              Nenhum atendimento registrado ainda.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
