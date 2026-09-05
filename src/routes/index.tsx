import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
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
  Sparkles,
  Syringe,
  Truck,
  User,
} from "lucide-react";
import heroImage from "@/assets/hero-pets.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  appointmentStatusTone,
  BIRTHDAY_DISCOUNT_PERCENT,
  birthdayCouponCode,
  capitalizeWords,
  CLINIC,
  daysUntil,
  formatBRL,
  formatDate,
  formatDateTime,
  isAppointmentInService,
  isBirthdayToday,
  sortInServiceFirst,
  statusToneClass,
  whatsappLink,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  // 3. Agendamentos em andamento / Status de Delivery
  const { data: appointments } = useQuery({
    queryKey: ["home-active-appointments", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, status, ops_status, logistics_type, transport_price_cents, services(name), pets(name), addresses(street, number, district)",
        )
        .eq("user_id", user!.id)
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      // Filtra apenas em andamento (não finalizados por completo)
      return (data ?? []).filter(
        (a) => a.ops_status !== "finalizado" && (a.status !== "concluido" || a.ops_status === "em_rota_devolucao"),
      );
    },
  });

  const sortedAppointments = useMemo(
    () => sortInServiceFirst(appointments ?? [], isAppointmentInService),
    [appointments],
  );

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

  // Atualização em tempo real dos agendamentos na Home
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`home-appointments-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["home-active-appointments", user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

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

  return (
    <div>
      {/* 1. Hero Seção Principal */}
      <section className="relative">
        <img
          src={heroImage}
          alt="Profissional cuidando de um cão e um gato na Big Dog Pet"
          width={1200}
          height={912}
          className="h-56 sm:h-64 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="font-display text-2xl sm:text-3xl leading-tight text-primary-foreground">
            A vida do seu pet em boas mãos
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-primary-foreground/90">
            {CLINIC.tagline}.
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
            {CLINIC.unit} · Vila Bazú, Franco da Rocha
          </p>
        </div>
      </section>

      {/* 2. Botões Rápidos: Agendar Serviço e Ir para a Loja */}
      <section className="grid grid-cols-2 gap-3 p-4">
        <Button asChild size="lg" className="h-12 rounded-2xl font-bold shadow-sm">
          <Link to="/agendar">Agendar serviço</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-12 rounded-2xl font-bold shadow-sm">
          <Link to="/loja">Ir para a loja</Link>
        </Button>
      </section>

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

      {/* 5. Agendamentos em Andamento e Status de Delivery */}
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
          <div className="mt-3 space-y-3">
            {sortedAppointments.map((item) => {
              const hasTransport = item.logistics_type && item.logistics_type !== "levar";
              const petNameFormatted = item.pets?.name ? capitalizeWords(item.pets.name) : null;
              const inService = isAppointmentInService(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-2xl p-4 shadow-card transition-all",
                    inService
                      ? "border-2 border-emerald-500/80 bg-emerald-50/60 dark:border-emerald-500/60 dark:bg-emerald-950/30 ring-1 ring-emerald-400/40 shadow-md"
                      : "border border-border/80 bg-card",
                  )}
                >
                  {inService && (
                    <div className="mb-2.5 flex items-center justify-between gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                      <span className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                        🟢 Em atendimento agora
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Início da fila
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-foreground">
                        {item.services?.name ?? "Serviço"}
                        {petNameFormatted ? ` ${petNameFormatted}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(item.scheduled_at)}
                        {petNameFormatted ? ` · 🐾 ${petNameFormatted}` : ""}
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
                    <div className="mt-2.5 border-t border-border/60 pt-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5 text-primary" />
                          {logisticsTypeLabels[item.logistics_type as LogisticsType]}
                          {item.transport_price_cents > 0 &&
                            ` · ${formatBRL(item.transport_price_cents)}`}
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn("shrink-0 font-semibold", statusToneClass(opsStatusTone(item.ops_status ?? "agendado")))}
                        >
                          {formatOpsStatusWithPet(item.ops_status as OpsStatus, item.pets?.name)}
                        </Badge>
                      </div>

                      {item.ops_status && (
                        <p className="mt-1.5 text-xs italic text-muted-foreground">
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
                </div>
              );
            })}

            {(appointments ?? []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Nenhum agendamento ativo no momento.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2 h-8 rounded-xl text-xs font-semibold">
                  <Link to="/agendar">Fazer novo agendamento</Link>
                </Button>
              </div>
            )}
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

      {/* 6. Avisos de Vacina */}
      {user?.id && (vaccineAlerts ?? []).length > 0 && (
        <section className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Syringe className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-bold">Avisos de Vacina e Cuidados</h2>
          </div>
          <div className="space-y-2">
            {(vaccineAlerts ?? []).map((v) => {
              const days = daysUntil(v.next_due_at!);
              const isOverdue = days < 0;
              const petNameCap = v.pets?.name ? capitalizeWords(v.pets.name) : "Pet";
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card border border-border p-3 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      Reforço: {v.vaccine_name} · 🐾 {petNameCap}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isOverdue
                        ? `Atrasado há ${Math.abs(days)} dia(s)!`
                        : days === 0
                          ? "Vence hoje!"
                          : `Vence em ${days} dia(s) (${formatDate(v.next_due_at!)})`}
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant={isOverdue ? "destructive" : "secondary"}
                    className="h-8 shrink-0 rounded-xl text-xs font-semibold"
                  >
                    <a
                      href={whatsappLink(
                        `Olá, ${CLINIC.name}! Quero agendar o reforço da vacina ${v.vaccine_name} de ${petNameCap}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Agendar
                    </a>
                  </Button>
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
            <a href={whatsappLink("Olá! Vim pelo app da Big Dog Pet.")} className="underline text-foreground font-semibold">
              {CLINIC.phoneDisplay}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
