import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Gift,
  MapPin,
  MessageCircle,
  Scissors,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Syringe,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import heroImage from "@/assets/hero-pets.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdminStatus } from "@/hooks/useAuth";
import { playStatusSound } from "@/lib/soundAlerts";
import {
  alertBadgeLabel,
  alertTone,
  appointmentStatusTone,
  BIRTHDAY_DISCOUNT_PERCENT,
  birthdayCouponCode,
  capitalizeWords,
  CLINIC,
  daysUntil,
  formatBRL,
  formatDate,
  formatDateTime,
  getAppointmentStatusDisplay,
  getAppointmentCancellationInfo,
  isAppointmentInService,
  isBirthdayToday,
  sortInServiceFirst,
  statusToneCardClass,
  statusToneClass,
  statusToneIconClass,
} from "@/lib/format";
import {
  formatOpsStatusWithPet,
  getOpsStatusTutorMessage,
  logisticsTypeLabels,
  opsStatusTone,
  type LogisticsType,
  type OpsStatus,
} from "@/lib/transport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriverContact } from "@/components/DriverContact";
import { DriverLiveMap } from "@/components/DriverLiveMap";
import { TransportHistoryList } from "@/components/TransportHistoryList";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { PetAvatar } from "@/components/PetAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { preview?: string } => ({
    ...(typeof search["preview"] === "string" ? { preview: search["preview"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Big Dog Pet | Banho, Tosa e Acessórios em Franco da Rocha" },
      {
        name: "description",
        content:
          "Big Dog Pet, em Franco da Rocha: banho, tosa, acessórios e produtos para o seu pet. Acompanhe seus agendamentos e delivery em tempo real.",
      },
      { property: "og:title", content: "Big Dog Pet | Banho e Tosa em Franco da Rocha" },
      {
        property: "og:description",
        content: "Acompanhe seus agendamentos, delivery ao vivo e compre na loja online.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  const [isClientPreview, setIsClientPreview] = useState(() => {
    if (typeof window === "undefined") return search.preview === "cliente";
    return (
      search.preview === "cliente" ||
      sessionStorage.getItem("bigdog_preview_mode") === "cliente"
    );
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdminStatus(user?.id, user?.email);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (search.preview === "cliente") {
      sessionStorage.setItem("bigdog_preview_mode", "cliente");
      setIsClientPreview(true);
      window.dispatchEvent(new CustomEvent("bigdog_preview_change"));
    }
  }, [search.preview]);

  useEffect(() => {
    const handlePreviewChange = () => {
      setIsClientPreview(sessionStorage.getItem("bigdog_preview_mode") === "cliente");
    };
    window.addEventListener("storage", handlePreviewChange);
    window.addEventListener("bigdog_preview_change", handlePreviewChange);
    return () => {
      window.removeEventListener("storage", handlePreviewChange);
      window.removeEventListener("bigdog_preview_change", handlePreviewChange);
    };
  }, []);

  useEffect(() => {
    if (isAdmin && !isClientPreview) {
      navigate({ to: "/admin", replace: true });
    }
  }, [isAdmin, isClientPreview, navigate]);

  // 1. Dados de aniversário do tutor e dos seus pets
  const { data: ownProfile } = useQuery({
    queryKey: ["profile-birthday", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, birth_date")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ownPets } = useQuery({
    queryKey: ["pets-birthday", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("pets").select("id, name, birth_date");
      if (error) throw error;
      return data;
    },
  });

  // 2. Endereço padrão para cálculo da mensagem de Táxi Pet
  const { data: userAddress } = useQuery({
    queryKey: ["user-home-address", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("street, number, district, city")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 3. Agendamentos em andamento / Status de Delivery / Cancelados recentes
  const { data: appointments } = useQuery({
    queryKey: ["home-active-appointments", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, status, ops_status, logistics_type, transport_price_cents, notes, created_at, updated_at, services(name), pets(name, photo_url, species), addresses(street, number, district)",
        )
        .eq("user_id", user!.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      // Filtra apenas em andamento (não finalizados por completo) e cancelados recentes (últimas 48 horas)
      const recentThreshold = Date.now() - 48 * 3600 * 1000;
      return (data ?? []).filter((a) => {
        const isCancelled = a.status === "cancelado" || a.ops_status === "cancelado";
        if (isCancelled) {
          const schedTime = new Date(a.scheduled_at).getTime();
          const updTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const crtTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          return schedTime >= recentThreshold || updTime >= recentThreshold || crtTime >= recentThreshold;
        }
        return a.ops_status !== "finalizado" && (a.status !== "concluido" || a.ops_status === "em_rota_devolucao");
      });
    },
  });

  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("bigdog_dismissed_cancelled");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  function dismissCancelled(id: string) {
    setDismissedCancelledIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem("bigdog_dismissed_cancelled", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const visibleAppointments = useMemo(() => {
    return (appointments ?? []).filter((a) => {
      const isCancelled = a.status === "cancelado" || a.ops_status === "cancelado";
      if (isCancelled && dismissedCancelledIds.includes(a.id)) {
        return false;
      }
      return true;
    });
  }, [appointments, dismissedCancelledIds]);

  const sortedAppointments = useMemo(() => {
    if (!visibleAppointments || visibleAppointments.length <= 1) return visibleAppointments ?? [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const getPriority = (item: (typeof visibleAppointments)[0]) => {
      const isCancelled = item.status === "cancelado" || item.ops_status === "cancelado";
      if (isCancelled) return 100;
      if (isAppointmentInService(item)) return 90;
      // Agendamento pendente recém-feito (aguardando confirmação da loja) fica no topo para o tutor acompanhar
      if (item.status === "pendente") return 80;
      const itemDateStr = item.scheduled_at ? item.scheduled_at.slice(0, 10) : "";
      if (itemDateStr === todayStr) return 70;
      const schedTime = new Date(item.scheduled_at).getTime();
      if (schedTime >= now.getTime()) return 60;
      return 10; // agendamento passado que ainda não foi concluído
    };

    return [...visibleAppointments].sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pB !== pA) return pB - pA;

      // Se ambos forem pendentes, mais recente criado/agendado fica no topo
      if (a.status === "pendente" && b.status === "pendente") {
        const timeA = new Date((a as { created_at?: string }).created_at || a.scheduled_at).getTime();
        const timeB = new Date((b as { created_at?: string }).created_at || b.scheduled_at).getTime();
        return timeB - timeA;
      }

      // Se ambos forem futuros, o mais próximo cronologicamente fica primeiro
      if (pA === 60) {
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      }

      // Para passados ou outros, o mais recente primeiro
      return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
    });
  }, [visibleAppointments]);

  // 4. Avisos de Vacina
  const { data: vaccineAlerts } = useQuery({
    queryKey: ["home-vaccine-alerts", user?.id],
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

  // 5. Lembretes de Retorno, Consultas e Cuidados (care_reminders)
  const { data: careReminders } = useQuery({
    queryKey: ["home-care-reminders", user?.id],
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

  // 6. Prontuários com próximo retorno agendado (medical_records)
  const { data: medicalRecordReturns } = useQuery({
    queryKey: ["home-medical-returns", user?.id],
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

  // Atualização em tempo real dos agendamentos, retornos e vacinas na Home
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`home-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["transport-history"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_reminders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-care-reminders", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vaccinations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-vaccine-alerts", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "medical_records" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-medical-returns", user.id] });
        },
      )
      .subscribe();

    function handleCustomAlert() {
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transport-history"] });
    }
    window.addEventListener("bigdog_status_alert", handleCustomAlert);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("bigdog_status_alert", handleCustomAlert);
    };
  }, [user?.id, queryClient]);

  // Estado e mutação para cancelamento de agendamento pelo tutor (TC-17)
  const [cancellingAppt, setCancellingAppt] = useState<{
    id: string;
    scheduled_at: string;
    notes?: string | null;
    services?: { name?: string | null } | null;
    pets?: { name?: string | null } | null;
  } | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const cancelInfo = useMemo(() => {
    return getAppointmentCancellationInfo(cancellingAppt?.scheduled_at);
  }, [cancellingAppt?.scheduled_at]);

  const isUnder2Hours = cancelInfo.isUnder2Hours;

  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      notes,
      isUnder2h,
    }: {
      appointmentId: string;
      notes?: string | null;
      isUnder2h: boolean;
    }) => {
      const cancelNote = isUnder2h
        ? "• Cancelado pelo tutor com menos de 2h de antecedência"
        : "• Cancelado pelo tutor com antecedência";
      const updatedNotes = notes ? `${notes.trim()}\n${cancelNote}` : cancelNote;

      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cancelado",
          ops_status: "cancelado",
          notes: updatedNotes,
        })
        .eq("id", appointmentId);

      if (error) throw error;

      // Histórico de status
      await supabase.from("pet_status_history").insert({
        appointment_id: appointmentId,
        status: "cancelado",
        notes: cancelNote,
      });
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado com sucesso. A vaga foi liberada na agenda!");
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-capacity"] });
      setIsCancelModalOpen(false);
      setCancellingAppt(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar agendamento";
      toast.error(msg);
    },
  });

  // Junta vacinas + retornos + consultas num único conjunto ordenado com prioridade para hoje
  type HomeAlert = {
    key: string;
    kind: "retorno" | "consulta" | "exame" | "vacina" | "outro";
    typeLabel: string;
    title: string;
    petName: string;
    days: number;
    dueDate: string;
    whatsappMessage: string;
    isHoje: boolean;
    isOverdue: boolean;
  };

  const homeAlerts = useMemo(() => {
    const list: HomeAlert[] = [];
    const seenKeys = new Set<string>();

    // 1. Vacinas
    for (const v of vaccineAlerts ?? []) {
      const days = daysUntil(v.next_due_at!);
      const petNameCap = v.pets?.name ? capitalizeWords(v.pets.name) : "Pet";
      const key = `vacina-${v.id}`;
      seenKeys.add(key);
      list.push({
        key,
        kind: "vacina",
        typeLabel: "Reforço de Vacina",
        title: v.vaccine_name,
        petName: petNameCap,
        days,
        dueDate: v.next_due_at!,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar o reforço da vacina ${v.vaccine_name} de ${petNameCap}.`,
        isHoje: days === 0,
        isOverdue: days < 0,
      });
    }

    // 2. Lembretes de Retorno, Consultas e Cuidados (care_reminders)
    for (const r of careReminders ?? []) {
      const days = daysUntil(r.due_date);
      const petNameCap = r.pets?.name ? capitalizeWords(r.pets.name) : "Pet";
      const key = `care-${r.id}`;
      seenKeys.add(key);
      const rType = (r.reminder_type || "retorno").toLowerCase();
      const typeLabel =
        rType === "consulta"
          ? "Consulta"
          : rType === "exame"
            ? "Exame de Retorno"
            : rType === "retirada_pontos"
              ? "Retirada de Pontos"
              : "Consulta de Retorno";

      list.push({
        key,
        kind: rType === "consulta" ? "consulta" : rType === "exame" ? "exame" : "retorno",
        typeLabel,
        title: r.title,
        petName: petNameCap,
        days,
        dueDate: r.due_date,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar o ${typeLabel.toLowerCase()} (${r.title}) de ${petNameCap}.`,
        isHoje: days === 0,
        isOverdue: days < 0,
      });
    }

    // 3. Prontuários com próximo retorno agendado (evita duplicar com care_reminders)
    for (const m of medicalRecordReturns ?? []) {
      if (!m.next_return_date) continue;
      const petNameCap = m.pets?.name ? capitalizeWords(m.pets.name) : "Pet";
      const dedupeKey = `med-${m.pet_id}-${m.next_return_date}`;
      const alreadyHasReminder = (careReminders ?? []).some(
        (cr) => cr.pet_id === m.pet_id && cr.due_date === m.next_return_date,
      );
      if (alreadyHasReminder || seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const days = daysUntil(m.next_return_date);
      const mType = (m.record_type || "retorno").toLowerCase();
      const typeLabel =
        mType === "consulta"
          ? "Consulta de Retorno"
          : mType === "cirurgia"
            ? "Retorno Pós-Cirúrgico"
            : "Retorno Clínico";

      list.push({
        key: dedupeKey,
        kind: "retorno",
        typeLabel,
        title: m.reason ? `Retorno: ${m.reason}` : typeLabel,
        petName: petNameCap,
        days,
        dueDate: m.next_return_date,
        whatsappMessage: `Olá, ${CLINIC.name}! Gostaria de confirmar o ${typeLabel.toLowerCase()} de ${petNameCap} previsto para ${formatDate(m.next_return_date)}.`,
        isHoje: days === 0,
        isOverdue: days < 0,
      });
    }

    // Ordenação prioritária:
    // 1º: Retornos de Hoje (days === 0) no topo absoluto!
    // 2º: Atrasados (days < 0)
    // 3º: Próximos dias em ordem crescente
    return list.sort((a, b) => {
      if (a.isHoje && !b.isHoje) return -1;
      if (!a.isHoje && b.isHoje) return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.days - b.days;
    });
  }, [vaccineAlerts, careReminders, medicalRecordReturns]);

  const hasPlayedHomeAlertRef = useRef(false);

  useEffect(() => {
    const hasTodayAlert = homeAlerts.some((a) => a.isHoje);
    if (hasTodayAlert && !hasPlayedHomeAlertRef.current) {
      hasPlayedHomeAlertRef.current = true;
      playStatusSound("alerta", 2);
      setTimeout(() => {
        const el = document.getElementById("aviso-hoje");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 400);
    }
  }, [homeAlerts]);

  // Checagem de Aniversário (Pet ou Tutor)
  const birthdayPet = (ownPets ?? []).find((p) => isBirthdayToday(p.birth_date));
  const isOwnerBirthday = isBirthdayToday(ownProfile?.birth_date);
  const rawBirthdayName = birthdayPet
    ? birthdayPet.name
    : isOwnerBirthday
      ? ownProfile?.full_name?.split(" ")[0]
      : null;
  const birthdayName = rawBirthdayName ? capitalizeWords(rawBirthdayName) : null;
  const couponCode = birthdayCouponCode(rawBirthdayName);
  const [couponCopied, setCouponCopied] = useState(false);

  // Mensagem contextual Táxi Pet
  const transportAddressText = userAddress?.street
    ? `${userAddress.street}${userAddress.number ? `, ${userAddress.number}` : ""}${userAddress.district ? ` (${userAddress.district})` : ""}`
    : null;

  const transportMessage = transportAddressText
    ? `Buscamos e devolvemos seu pet em sua casa em ${transportAddressText}.`
    : "Buscamos e devolvemos seu pet em sua casa em Franco da Rocha.";

  async function copyCoupon() {
    try {
      await navigator.clipboard.writeText(couponCode);
      setCouponCopied(true);
      setTimeout(() => setCouponCopied(false), 2000);
    } catch {
      /* clipboard fallback */
    }
  }

  if (isAdmin && !isClientPreview) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          Acessando Painel Administrativo...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 0. Barra de controle: Modo de Visualização do Cliente para Admin */}
      {isClientPreview && (
        <div className="sticky top-0 z-50 flex items-center justify-between bg-slate-900 px-4 py-2.5 text-white text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <span className="font-bold">Modo Visualização do Tutor (Cliente)</span>
          </div>
          <Button
            asChild
            size="sm"
            onClick={() => {
              sessionStorage.removeItem("bigdog_preview_mode");
              setIsClientPreview(false);
              window.dispatchEvent(new CustomEvent("bigdog_preview_change"));
            }}
            className="h-7 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs"
          >
            <Link to="/admin">Voltar ao Painel Admin</Link>
          </Button>
        </div>
      )}

      {/* 1. Hero Seção Principal (Compacto para visualização above-the-fold) */}
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Profissional cuidando de um cão e um gato na Big Dog Pet"
          width={1200}
          height={912}
          className="h-36 sm:h-44 md:h-48 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black shadow-xs mb-1">
            ⭐ {CLINIC.unit} · Franco da Rocha
          </span>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight text-white drop-shadow-sm">
            A vida do seu pet em boas mãos
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-white/90 line-clamp-1">
            {CLINIC.tagline}.
          </p>
        </div>
      </section>

      {/* 2. Ações Rápidas: Banho & Tosa, Táxi Pet, Loja Online (Visíveis Imediatamente Acima da Dobra) */}
      <section className="px-4 -mt-3 sm:-mt-4 relative z-10 mb-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* 1. Agendar Banho & Tosa */}
          <Link
            to="/agendar"
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition active:scale-[0.98] text-center group"
          >
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center mb-1 group-hover:scale-105 transition">
              <Scissors className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xs sm:text-sm leading-tight text-white">
              Banho & Tosa
            </span>
            <span className="text-[10px] text-white/80 mt-0.5 hidden sm:inline">
              Agendar serviço
            </span>
          </Link>

          {/* 2. Táxi Pet */}
          <Link
            to="/agendar"
            search={{ tipo: "buscar_e_devolver" }}
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border-2 border-primary/20 shadow-md hover:border-primary hover:bg-primary/5 transition active:scale-[0.98] text-center group"
          >
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center mb-1 group-hover:scale-105 transition">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-xs sm:text-sm leading-tight text-foreground">
              Táxi Pet
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 hidden sm:inline">
              Busca em casa
            </span>
          </Link>

          {/* 3. Loja Online */}
          <Link
            to="/loja"
            className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl bg-card border border-border shadow-md hover:border-primary hover:bg-primary/5 transition active:scale-[0.98] text-center group"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-1 group-hover:scale-105 transition">
              <ShoppingBag className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-bold text-xs sm:text-sm leading-tight text-foreground">
              Loja Online
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5 hidden sm:inline">
              Rações & mimos
            </span>
          </Link>
        </div>
      </section>

      {/* 2. AGENDAMENTOS DO TUTOR - TOPO DA TELA COM STATUS REFLETIDO EM TEMPO REAL */}
      {user?.id && sortedAppointments.length > 0 && (
        <section className="px-4 pt-4 pb-1 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-80",
                  sortedAppointments[0]?.status === "cancelado" ? "bg-rose-500" :
                  sortedAppointments[0]?.status === "pendente" ? "bg-amber-500" :
                  "bg-emerald-500"
                )}></span>
                <span className={cn(
                  "relative inline-flex rounded-full h-3 w-3",
                  sortedAppointments[0]?.status === "cancelado" ? "bg-rose-600" :
                  sortedAppointments[0]?.status === "pendente" ? "bg-amber-600" :
                  "bg-emerald-600"
                )}></span>
              </span>
              <h2 className="font-display text-lg font-bold text-foreground">
                {sortedAppointments.every(a => a.status === "cancelado")
                  ? "Aviso de cancelamento"
                  : "Seu agendamento ativo"}
              </h2>
            </div>
            <Link to="/conta" className="text-xs font-semibold text-primary underline hover:opacity-80">
              Ver todos ({sortedAppointments.length})
            </Link>
          </div>

          <div className="mt-2.5 space-y-3">
            {sortedAppointments.map((item) => {
              const hasTransport = item.logistics_type && item.logistics_type !== "levar";
              const petNameFormatted = item.pets?.name ? capitalizeWords(item.pets.name) : null;
              const display = getAppointmentStatusDisplay(item);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-3xl p-4 transition-all",
                    display.cardClass
                  )}
                >
                  <div className={cn(
                    "mb-2.5 flex items-center justify-between gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold",
                    display.bannerClass
                  )}>
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", display.dotPingClass)}></span>
                        <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", display.dotClass)}></span>
                      </span>
                      {display.bannerText}
                    </span>
                    {display.isCancelled ? (
                      <button
                        type="button"
                        onClick={() => dismissCancelled(item.id)}
                        className="text-[11px] font-bold uppercase tracking-wider text-rose-800 hover:text-rose-950 underline dark:text-rose-200 dark:hover:text-white"
                        title="Dispensar este aviso da tela inicial"
                      >
                        Dispensar
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                        {display.bannerTag}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <PetAvatar
                      photoUrl={(item.pets as { photo_url?: string | null })?.photo_url}
                      name={petNameFormatted}
                      species={(item.pets as { species?: string | null })?.species}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-base font-bold", display.titleColorClass)}>
                        {item.services?.name ?? "Serviço"}
                        {petNameFormatted ? ` · 🐾 ${petNameFormatted}` : ""}
                      </p>
                      <p className={cn("mt-0.5 flex items-center gap-1.5 text-xs font-medium", display.timeColorClass)}>
                        <Clock className={cn("h-3.5 w-3.5", display.iconColorClass)} />
                        {formatDateTime(item.scheduled_at)}
                      </p>
                    </div>
                    <Badge className={cn("shrink-0 font-bold capitalize shadow-xs border-0", display.badgeClass)}>
                      {display.label}
                    </Badge>
                  </div>

                  {item.notes?.includes("[ENCAIXE") && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 border border-amber-500/30">
                      ⚡ Encaixe / Exceção Autorizada
                    </div>
                  )}

                  {display.isCancelled ? (
                    <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-100/80 p-3 dark:bg-rose-900/40 text-xs text-rose-950 dark:text-rose-100">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-rose-950 dark:text-rose-100">
                            Aviso de Cancelamento pela Loja
                          </p>
                          <p className="mt-0.5 text-xs text-rose-900/90 dark:text-rose-200/90 leading-relaxed">
                            Este horário foi cancelado pela equipe do petshop. Você pode reagendar um novo horário imediatamente ou falar conosco no Chat.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/20">
                        <Button asChild size="sm" className="h-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm">
                          <Link to="/agendar">
                            <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                            Reagendar novo horário
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs gap-1.5 shadow-sm"
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
                    </div>
                  ) : display.isPending ? (
                    <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-100/70 p-2 text-xs text-amber-950 dark:bg-amber-900/30 dark:text-amber-100">
                      <p className="font-medium text-[11px] leading-relaxed">
                        ⏳ <strong>Aguardando confirmação da loja:</strong> Nossa equipe está revisando a agenda e logo você receberá a confirmação aqui na tela!
                      </p>
                    </div>
                  ) : null}

                  {hasTransport && !display.isCancelled && (
                    <div className="mt-3 border-t border-current/15 pt-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold">
                          <Truck className="h-4 w-4" />
                          {logisticsTypeLabels[item.logistics_type as LogisticsType]}
                          {item.transport_price_cents > 0 &&
                            ` · ${formatBRL(item.transport_price_cents)}`}
                        </p>
                        <Badge className="shrink-0 font-bold bg-primary text-primary-foreground border-0 text-[11px]">
                          {formatOpsStatusWithPet(item.ops_status as OpsStatus, item.pets?.name)}
                        </Badge>
                      </div>

                      {item.ops_status && (
                        <p className="mt-1.5 text-xs italic opacity-90">
                          "{getOpsStatusTutorMessage(item.ops_status, item.pets?.name)}"
                        </p>
                      )}

                      {item.ops_status && item.ops_status !== "agendado" && (
                        <div className="mt-2">
                          <DriverContact appointmentId={item.id} />
                        </div>
                      )}

                      <div className="mt-2">
                        <DriverLiveMap
                          appointmentId={item.id}
                          active={
                            item.ops_status === "em_deslocamento_retirada" ||
                            item.ops_status === "em_rota_devolucao"
                          }
                        />
                      </div>

                      <div className="mt-2">
                        <TransportHistoryList
                          appointmentId={item.id}
                          currentStatus={item.ops_status ?? undefined}
                          petName={item.pets?.name}
                        />
                      </div>
                    </div>
                  )}

                  {/* Ações do Tutor no Agendamento Confirmado/Ativo: Chat e Cancelar */}
                  {!display.isCancelled && item.ops_status !== "finalizado" && item.status !== "concluido" && (
                    <div className="mt-3 flex items-center justify-end gap-2 pt-2.5 border-t border-current/15">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-background/80 hover:bg-background border-border/80 shadow-xs"
                        onClick={() =>
                          openInAppChat({
                            contextTag: `Agendamento: ${item.services?.name ?? "Serviço"}`,
                            defaultText: `Olá! Gostaria de falar sobre o agendamento de ${item.services?.name ?? "serviço"}${petNameFormatted ? ` para ${petNameFormatted}` : ""} marcado para ${formatDateTime(item.scheduled_at)}.`,
                          })
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-primary" />
                        Chat da Loja
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50 gap-1.5"
                        onClick={() => {
                          setCancellingAppt(item);
                          setIsCancelModalOpen(true);
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* 3. Destaque Táxi Pet: Busca e Devolução em Casa */}
      <section className="px-4 pb-3">
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 shadow-card transition-all hover:bg-primary/[0.08]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Truck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Táxi Pet Big Dog
              </span>
              <span className="text-[11px] text-muted-foreground">Comodidade no seu lar</span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-snug text-foreground">
              {transportMessage}
            </p>
          </div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 h-8 rounded-xl border-primary/30 text-xs font-semibold hover:bg-primary hover:text-primary-foreground"
          >
            <Link to="/agendar" search={{ tipo: "buscar_e_devolver" }}>
              Agendar
            </Link>
          </Button>
        </div>
      </section>

      {/* 4. Aniversário do Pet e do Tutor */}
      {birthdayName && (
        <section className="px-4 pb-3">
          <div className="rounded-2xl border-2 border-gold/50 bg-secondary p-4 shadow-card">
            <p className="flex items-center gap-1.5 font-display text-lg font-bold">
              <Gift className="h-5 w-5 text-gold" />
              {birthdayPet
                ? `Parabéns pra ${birthdayName}! 🐾`
                : `Parabéns, ${birthdayName}! 🎂`}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              {birthdayPet
                ? `O dia do seu pet merece um mimo especial: ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho, tosa ou nas compras da loja, só hoje.`
                : `O ${CLINIC.name} preparou um presente pra você e seu pet: ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho, tosa ou nas compras da loja, só hoje.`}
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-dashed border-gold/60 bg-background px-3 py-2">
              <span className="flex-1 font-mono text-sm font-bold tracking-wide text-gold">
                {couponCode}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 rounded-lg text-xs font-semibold"
                onClick={copyCoupon}
              >
                {couponCopied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {couponCopied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              Válido só hoje, {formatDate(new Date())}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild size="sm" className="h-9 rounded-xl font-semibold">
                <Link to="/agendar" search={{ campanha: "niver", cupom: couponCode }}>
                  Agendar banho/tosa
                </Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className="h-9 rounded-xl font-semibold">
                <Link to="/loja" search={{ campanha: "niver", cupom: couponCode }}>
                  Ver produtos da loja
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 5. Agendamentos em Andamento e Status de Delivery (Exibido se não houver agendamento ativo no topo) */}
      {(!user?.id || sortedAppointments.length === 0) && (
        <section className="px-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h2 className="font-display text-lg font-bold">Agendamentos e Delivery</h2>
            </div>
            <Link to="/conta" className="text-xs font-semibold text-primary underline">
              Ver todos
            </Link>
          </div>

          {user?.id ? (
            <div className="mt-3">
              <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Nenhum agendamento ativo no momento.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2 h-8 rounded-xl text-xs font-semibold">
                  <Link to="/agendar">Fazer novo agendamento</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <User className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">
                    Acompanhe seus pets e agendamentos
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Faça login para ver o status de delivery ao vivo, histórico e vacinas.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm" className="h-8 rounded-xl text-xs font-semibold flex-1">
                  <Link to="/auth">Entrar na minha conta</Link>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. Avisos de Saúde, Vacinas, Consultas e Retornos */}
      {user?.id && homeAlerts.length > 0 && (
        <section className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-bold">Avisos de Saúde e Retornos</h2>
          </div>
          <div className="space-y-2">
            {homeAlerts.map((item) => {
              const isHoje = item.isHoje;
              const tone = alertTone(item.days);
              const isVaccine = item.kind === "vacina";
              return (
                <div
                  key={item.key}
                  id={isHoje ? "aviso-hoje" : undefined}
                  className={cn(
                    "rounded-2xl border-2 p-3.5 shadow-card transition-all",
                    statusToneCardClass(tone),
                    isHoje && "ring-2 ring-red-500/50 shadow-md",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isVaccine ? (
                        <Syringe className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                      ) : (
                        <Stethoscope className={cn("mt-0.5 h-4 w-4 shrink-0", statusToneIconClass(tone))} />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">
                          {item.typeLabel}: {item.title} · 🐾 {item.petName}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.isOverdue
                            ? `Atrasado há ${Math.abs(item.days)} dia(s)! (${formatDate(item.dueDate)})`
                            : item.isHoje
                              ? "🔔 Retorno previsto para HOJE!"
                              : item.days === 1
                                ? `⚠️ Vence amanhã (${formatDate(item.dueDate)})`
                                : item.days === 2
                                  ? `🟡 Vence em 2 dias (${formatDate(item.dueDate)})`
                                  : `Previsto para ${formatDate(item.dueDate)} (em ${item.days} dias)`}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0 whitespace-nowrap text-[10px] font-bold", statusToneClass(tone))}
                    >
                      {alertBadgeLabel(item.days)}
                    </Badge>
                  </div>

                  <div className="mt-2.5 flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-xl text-xs font-medium border-primary/30 hover:bg-primary/5"
                    >
                      <Link to="/agendar">Agendar</Link>
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 rounded-xl text-xs font-bold gap-1.5 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      onClick={() =>
                        openInAppChat({
                          petName: item.petName,
                          contextTag: item.title,
                          defaultText: item.whatsappMessage,
                        })
                      }
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      💬 Chat - Falar com Petshop agora!!!
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7. Onde nos encontrar */}
      <section className="mt-4 surface-paper px-4 py-5 border-t border-border/40">
        <h2 className="font-display text-lg font-bold">Onde nos encontrar</h2>
        <ul className="mt-2.5 space-y-2.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">{CLINIC.unit}:</strong> {CLINIC.address}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
            <button
              type="button"
              onClick={() =>
                openInAppChat({
                  defaultText: "Olá! Vim pelo app da Big Dog Pet e gostaria de atendimento.",
                })
              }
              className="underline text-foreground font-semibold hover:text-primary transition-colors text-left"
            >
              Falar no Chat do App ({CLINIC.phoneDisplay})
            </button>
          </li>
        </ul>
      </section>

      {/* Modal de Cancelamento de Agendamento pelo Tutor (com crítica de < 2h - TC-17) */}
      <AlertDialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              {isUnder2Hours ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <span>Atenção: Cancelamento com menos de 2h</span>
                </>
              ) : (
                <>
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                  <span>Confirmar Cancelamento do Horário</span>
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground pt-1">
                {isUnder2Hours ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 space-y-2">
                    <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200 text-sm">
                      <span>⚠️</span> Seu atendimento está previsto para {cancelInfo.timeRemainingText}!
                    </p>
                    <div className="text-xs bg-white/70 dark:bg-black/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-1">
                      <p>
                        <strong>Serviço:</strong> {cancellingAppt?.services?.name ?? "Serviço"} {cancellingAppt?.pets?.name ? `(🐾 ${capitalizeWords(cancellingAppt.pets.name)})` : ""}
                      </p>
                      <p>
                        <strong>Horário agendado:</strong> {cancellingAppt?.scheduled_at ? formatDateTime(cancellingAppt.scheduled_at) : "—"}
                      </p>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90 font-medium">
                      Cancelamentos em cima da hora afetam a escala da equipe de banho/tosa e o itinerário dos motoristas do Táxi Pet. Você pode tirar dúvidas e alinhar com nossa recepção pelo <strong>Chat da loja</strong> ou confirmar a liberação da vaga agora.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">
                      Seu atendimento está previsto para {cancelInfo.timeRemainingText}.
                    </p>
                    <p>
                      Deseja realmente cancelar o agendamento de{" "}
                      <strong className="text-foreground">{cancellingAppt?.services?.name ?? "serviço"}</strong> para{" "}
                      <strong className="text-foreground">{cancellingAppt?.pets?.name ? capitalizeWords(cancellingAppt.pets.name) : "seu pet"}</strong>{" "}
                      marcado para <strong>{cancellingAppt?.scheduled_at ? formatDateTime(cancellingAppt.scheduled_at) : ""}</strong>?
                      A vaga será liberada imediatamente na agenda.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <AlertDialogCancel
              disabled={cancelAppointmentMutation.isPending}
              className="rounded-xl text-xs font-semibold"
            >
              Voltar
            </AlertDialogCancel>

            {isUnder2Hours && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  openInAppChat({
                    contextTag: `Cancelamento <2h: ${cancellingAppt?.services?.name ?? "Serviço"}`,
                    defaultText: `Olá! Preciso conversar sobre o cancelamento do agendamento de ${cancellingAppt?.services?.name ?? "serviço"}${cancellingAppt?.pets?.name ? ` para ${cancellingAppt.pets.name}` : ""} marcado para ${cancellingAppt?.scheduled_at ? formatDateTime(cancellingAppt.scheduled_at) : ""} (menos de 2h de antecedência).`,
                  });
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Falar no Chat
              </Button>
            )}

            <AlertDialogAction
              disabled={cancelAppointmentMutation.isPending}
              onClick={() => {
                if (cancellingAppt) {
                  cancelAppointmentMutation.mutate({
                    appointmentId: cancellingAppt.id,
                    notes: cancellingAppt.notes,
                    isUnder2h: isUnder2Hours,
                  });
                }
              }}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {cancelAppointmentMutation.isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
