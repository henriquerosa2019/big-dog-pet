import React, { useState } from "react";
import {
  Stethoscope,
  Syringe,
  Pill,
  Heart,
  Thermometer,
  Scale,
  Calendar,
  Clock,
  Printer,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDate, capitalizeWords } from "@/lib/format";
import { toast } from "sonner";

export interface ClinicalVitals {
  weightKg?: string | number | null;
  temperatureC?: string | number | null;
  heartRateBpm?: string | number | null;
  ageYears?: string | number | null;
}

export interface VaccineTimelineItem {
  id: string;
  name: string;
  appliedAt: string;
  nextDueAt?: string | null;
  vetName?: string | null;
  status: "applied" | "scheduled" | "overdue";
  dose?: string | null;
}

export interface ClinicalConsultationItem {
  id: string;
  date: string;
  reason: string;
  diagnosis?: string | null;
  observations?: string | null;
  vetName: string;
  crmv?: string | null;
}

export interface PrescriptionMedicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface VetEhrRecordProps {
  pet: {
    id: string;
    name: string;
    species: string;
    breed?: string | null;
    birthDate?: string | null;
    sex?: string | null;
    photoUrl?: string | null;
    weightKg?: string | number | null;
    temperament?: string | null;
    allergies?: string | null;
  };
  tutor?: {
    name: string;
    phone?: string | null;
  };
  vitals?: ClinicalVitals;
  vaccines?: VaccineTimelineItem[];
  consultations?: ClinicalConsultationItem[];
  prescriptions?: PrescriptionMedicine[];
  onAddConsultation?: (data: any) => Promise<void> | void;
  onAddPrescription?: (data: PrescriptionMedicine) => Promise<void> | void;
  onAddVaccine?: (data: any) => Promise<void> | void;
}

export function VetEhrRecord({
  pet,
  tutor,
  vitals = { weightKg: "12.4", temperatureC: "38.5", heartRateBpm: "110", ageYears: "3" },
  vaccines = [
    {
      id: "v1",
      name: "V10 Múltipla Canina",
      appliedAt: "2026-08-15",
      nextDueAt: "2027-08-15",
      vetName: "Dra. Camila Nogueira",
      status: "applied",
      dose: "Dose Anual",
    },
    {
      id: "v2",
      name: "Antirrábica (Raiva)",
      appliedAt: "2026-08-15",
      nextDueAt: "2027-08-15",
      vetName: "Dra. Camila Nogueira",
      status: "applied",
      dose: "Dose Única",
    },
    {
      id: "v3",
      name: "Giárdia Canina",
      appliedAt: "2026-09-10",
      nextDueAt: "2027-09-10",
      vetName: "Dr. Rodrigo Castro",
      status: "applied",
      dose: "Reforço",
    },
    {
      id: "v4",
      name: "Bronchi-Shield (Gripe Canina)",
      appliedAt: "2026-11-20",
      nextDueAt: "2026-11-20",
      status: "scheduled",
      dose: "Previsão",
    },
  ],
  consultations = [
    {
      id: "c1",
      date: "2026-10-04",
      reason: "Consulta de Rotina & Avaliação Dermatológica",
      diagnosis: "Dermatite alérgica leve por contato na região abdominal. Mucosas normais, hidratação adequada.",
      observations: "Paciente calmo e colaborativo. Recomendado banho terapêutico com shampoo hipoalergênico e medicação anti-histamínica por 7 dias.",
      vetName: "Dra. Camila Nogueira",
      crmv: "SP-45892",
    },
    {
      id: "c2",
      date: "2026-08-15",
      reason: "Vacinação Anual & Check-up Geral",
      diagnosis: "Ectoparasitas negativos. Ausculta cardiopulmonar límpida e sem sopros. Dentição hígida grau 1.",
      observations: "Aplicadas V10 e Antirrábica sem reações adversas imediatas.",
      vetName: "Dra. Camila Nogueira",
      crmv: "SP-45892",
    },
  ],
  prescriptions = [
    {
      id: "p1",
      name: "Apoquel 5.4mg",
      dosage: "1 comprimido via oral",
      frequency: "A cada 12 horas",
      duration: "7 dias seguidos",
      notes: "Administrar junto com o alimento matinal e noturno.",
    },
    {
      id: "p2",
      name: "Shampoo Douxo S3 Calm",
      dosage: "Banho terapêutico",
      frequency: "2 vezes por semana",
      duration: "3 semanas",
      notes: "Deixar agir por 10 minutos na pele antes de enxaguar com água morna.",
    },
    {
      id: "p3",
      name: "Ômega 3 Pet 500mg",
      dosage: "1 cápsula via oral",
      frequency: "1 vez ao dia",
      duration: "Uso contínuo (30 dias)",
      notes: "Suplementação nutricional para barreira cutânea.",
    },
  ],
  onAddConsultation,
  onAddPrescription,
  onAddVaccine,
}: VetEhrRecordProps) {
  const [activeTab, setActiveTab] = useState<"prontuario" | "receitas" | "vacinas">("prontuario");
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);

  // Form states
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  const [medDuration, setMedDuration] = useState("");
  const [medNotes, setMedNotes] = useState("");

  const handlePrint = () => {
    window.print();
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) {
      toast.error("Informe o nome do medicamento.");
      return;
    }
    const newMed: PrescriptionMedicine = {
      id: `p-${Date.now()}`,
      name: medName.trim(),
      dosage: medDosage.trim() || "1 dose",
      frequency: medFrequency.trim() || "A cada 24h",
      duration: medDuration.trim() || "Uso contínuo",
      notes: medNotes.trim() || undefined,
    };
    if (onAddPrescription) {
      await onAddPrescription(newMed);
    }
    toast.success("Medicamento adicionado à prescrição!");
    setMedName("");
    setMedDosage("");
    setMedFrequency("");
    setMedDuration("");
    setMedNotes("");
    setIsPrescriptionModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header do Paciente & Sinais Vitais (Estilo VetConnect) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {pet.photoUrl ? (
              <img
                src={pet.photoUrl}
                alt={pet.name}
                className="h-14 w-14 rounded-2xl object-cover border-2 border-primary/20 shadow-xs"
              />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-linear-to-tr from-primary to-primary/70 text-primary-foreground font-black text-xl flex items-center justify-center shadow-xs">
                {pet.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  {pet.name}
                </h2>
                <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30 bg-primary/5">
                  {capitalizeWords(pet.species || "Canino")}
                </Badge>
                {pet.sex && (
                  <Badge variant="secondary" className="text-xs font-bold">
                    {capitalizeWords(pet.sex)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Raça: <span className="font-semibold text-foreground">{pet.breed || "SRD (Sem raça definida)"}</span>
                {tutor?.name && (
                  <>
                    {" "}• Tutor: <span className="font-semibold text-foreground">{tutor.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 flex-1 sm:flex-initial"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Ficha / Receita
            </Button>
            <Button
              size="sm"
              onClick={() => setIsPrescriptionModalOpen(true)}
              className="h-8 rounded-xl text-xs font-bold gap-1.5 flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Prescrição
            </Button>
          </div>
        </div>

        {/* Barra de Sinais Vitais em Destaque */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/60">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Peso Atual</p>
              <p className="text-sm font-black text-foreground">
                {pet.weightKg || vitals.weightKg || "--"} kg
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
              <Thermometer className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Temperatura</p>
              <p className="text-sm font-black text-foreground">
                {vitals.temperatureC || "38.5"} °C
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Heart className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Freq. Cardíaca</p>
              <p className="text-sm font-black text-foreground">
                {vitals.heartRateBpm || "110"} bpm
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Idade Estimada</p>
              <p className="text-sm font-black text-foreground">
                {vitals.ageYears || "3"} anos
              </p>
            </div>
          </div>
        </div>

        {/* Alertas de Alergias e Temperamento se existirem */}
        {(pet.allergies || pet.temperament) && (
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            {pet.allergies && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2.5 py-1 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Alergias: {pet.allergies}
              </div>
            )}
            {pet.temperament && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2.5 py-1 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Temperamento: {pet.temperament}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Grid Clínico: Vacinas + Consultas Clínicas + Prescrição Digital */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna 1: Linha do Tempo de Vacinação */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-black text-foreground">Carteira de Vacinação</h3>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                {vaccines.filter((v) => v.status === "applied").length} aplicadas
              </Badge>
            </div>

            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
              {vaccines.map((v) => (
                <div key={v.id} className="relative pl-7 group">
                  <div
                    className={cn(
                      "absolute left-1.5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-card flex items-center justify-center -translate-x-1/2",
                      v.status === "applied" ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  >
                    {v.status === "applied" && <CheckCircle2 className="h-2 w-2 text-white" />}
                  </div>
                  <div className="rounded-xl border border-border/70 p-2.5 bg-muted/20 group-hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-black text-foreground">{v.name}</p>
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md",
                          v.status === "applied"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        )}
                      >
                        {v.status === "applied" ? "Aplicada" : "Próxima"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {v.status === "applied"
                        ? `Aplicada em: ${formatDate(v.appliedAt)}`
                        : `Previsão: ${formatDate(v.nextDueAt || v.appliedAt)}`}
                    </p>
                    {v.vetName && (
                      <p className="text-[10px] text-muted-foreground/80 font-medium">
                        Resp: {v.vetName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 rounded-xl text-xs font-bold gap-1 text-emerald-700 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={() => toast.info("Use o formulário de vacinas para registrar nova dose.")}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Vacina
          </Button>
        </div>

        {/* Coluna 2: Consultas & Evolução Clínica */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-black text-foreground">Consultas & Evolução</h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold">
                {consultations.length} atendimentos
              </Badge>
            </div>

            <div className="space-y-3">
              {consultations.map((c) => (
                <div key={c.id} className="rounded-xl border border-border/80 p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-foreground">{c.reason}</p>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {formatDate(c.date)}
                    </span>
                  </div>

                  {c.diagnosis && (
                    <div className="bg-card rounded-lg p-2 border border-border/50 text-[11px] text-foreground leading-relaxed">
                      <span className="font-bold text-primary block text-[10px] uppercase">
                        Diagnóstico / Achados:
                      </span>
                      {c.diagnosis}
                    </div>
                  )}

                  {c.observations && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Conduta: </strong>
                      {c.observations}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground pt-1 border-t border-border/40">
                    <span>{c.vetName}</span>
                    {c.crmv && <span>CRMV: {c.crmv}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 rounded-xl text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
            onClick={() => toast.info("Registrar nova consulta clínica.")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Anotação Clínica
          </Button>
        </div>

        {/* Coluna 3: Prescrição Digital Estruturada */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-black text-foreground">Receituário Digital</h3>
              </div>
              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                {prescriptions.length} ativos
              </Badge>
            </div>

            <div className="space-y-2.5">
              {prescriptions.map((p, idx) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-600 text-white text-[9px] font-bold">
                        {idx + 1}
                      </span>
                      {p.name}
                    </p>
                    <Badge variant="outline" className="text-[9px] font-bold border-blue-500/30 text-blue-700 dark:text-blue-300">
                      {p.duration}
                    </Badge>
                  </div>

                  <p className="text-[11px] font-semibold text-foreground/90 pl-5.5">
                    {p.dosage} • <span className="text-blue-700 dark:text-blue-300">{p.frequency}</span>
                  </p>

                  {p.notes && (
                    <p className="text-[10px] text-muted-foreground pl-5.5 italic">
                      Obs: {p.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Button
              size="sm"
              onClick={() => setIsPrescriptionModalOpen(true)}
              className="w-full h-8 rounded-xl text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Medicamento
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="w-full h-8 rounded-xl text-xs font-bold gap-1"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Receituário Timbrado
            </Button>
          </div>
        </div>
      </div>

      {/* Modal: Adicionar Medicamento */}
      <Dialog open={isPrescriptionModalOpen} onOpenChange={setIsPrescriptionModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Pill className="h-5 w-5 text-blue-600" />
              Nova Prescrição Digital
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione medicamento estruturado com posologia e tempo de tratamento para o paciente {pet.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePrescription} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Nome do Medicamento *</Label>
              <Input
                placeholder="Ex: Amoxicilina + Clavulanato 250mg"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="h-8 rounded-xl text-xs font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Dosagem</Label>
                <Input
                  placeholder="Ex: 1 comprimido via oral"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  className="h-8 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Frequência</Label>
                <Input
                  placeholder="Ex: A cada 12 horas"
                  value={medFrequency}
                  onChange={(e) => setMedFrequency(e.target.value)}
                  className="h-8 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Duração do Tratamento</Label>
              <Input
                placeholder="Ex: Por 10 dias seguidos"
                value={medDuration}
                onChange={(e) => setMedDuration(e.target.value)}
                className="h-8 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Recomendações e Instruções</Label>
              <Textarea
                placeholder="Ex: Administrar com alimentos para evitar desconforto gástrico."
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
                className="rounded-xl text-xs min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-semibold"
                onClick={() => setIsPrescriptionModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Salvar na Prescrição
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
