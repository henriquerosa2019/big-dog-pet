import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, ChevronRight, Gift, LogOut, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CLINIC,
  daysUntil,
  formatBRL,
  formatDate,
  formatDateTime,
  isBirthdayToday,
  isBirthdayTomorrow,
  whatsappLink,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta | PetCura" },
      {
        name: "description",
        content:
          "Acompanhe seus agendamentos, pedidos e pets cadastrados no Consultório Veterinário PetCura.",
      },
      { property: "og:title", content: "Minha conta | PetCura" },
      { property: "og:description", content: "Seus agendamentos, pedidos e pets em um só lugar." },
    ],
  }),
  component: Conta,
});

function Conta() {
  const { user } = useAuth();
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, notes, services(name, price_cents), pets(name)")
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
        .order("created_at", { ascending: false });
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
        .select("id, name, species, breed, allergies, birth_date");
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

  // Junta vacina + retorno + aniversário (dono e pets) num único painel de
  // avisos, com destaque para "hoje"/"amanhã" — pedido do Henrique 2026-08-14
  // pra o tutor ver tudo relevante assim que loga, num período de 30 dias.
  type Aviso = {
    key: string;
    kind: "vacina" | "retorno" | "aniversario";
    label: string;
    petName?: string;
    days: number;
    dueDate?: string;
    whatsappMessage?: string;
  };

  const avisos = useMemo(() => {
    const items: Aviso[] = [];

    for (const v of vaccineAlerts ?? []) {
      items.push({
        key: `vacina-${v.id}`,
        kind: "vacina",
        label: v.vaccine_name,
        petName: v.pets?.name,
        days: daysUntil(v.next_due_at!),
        dueDate: v.next_due_at!,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar o reforço da vacina ${v.vaccine_name} do meu pet ${v.pets?.name ?? ""}.`,
      });
    }

    for (const r of returnAlerts ?? []) {
      items.push({
        key: `retorno-${r.id}`,
        kind: "retorno",
        label: r.title,
        petName: r.pets?.name,
        days: daysUntil(r.due_date),
        dueDate: r.due_date,
        whatsappMessage: `Olá, ${CLINIC.name}! Quero agendar: ${r.title} do meu pet ${r.pets?.name ?? ""}.`,
      });
    }

    if (isBirthdayToday(profile?.birth_date)) {
      items.push({
        key: "aniversario-dono",
        kind: "aniversario",
        label: "Seu aniversário",
        days: 0,
      });
    } else if (isBirthdayTomorrow(profile?.birth_date)) {
      items.push({
        key: "aniversario-dono",
        kind: "aniversario",
        label: "Seu aniversário",
        days: 1,
      });
    }

    for (const pet of pets ?? []) {
      if (isBirthdayToday(pet.birth_date)) {
        items.push({
          key: `aniversario-pet-${pet.id}`,
          kind: "aniversario",
          label: `Aniversário de ${pet.name}`,
          days: 0,
        });
      } else if (isBirthdayTomorrow(pet.birth_date)) {
        items.push({
          key: `aniversario-pet-${pet.id}`,
          kind: "aniversario",
          label: `Aniversário de ${pet.name}`,
          days: 1,
        });
      }
    }

    return items.sort((a, b) => a.days - b.days);
  }, [vaccineAlerts, returnAlerts, profile?.birth_date, pets]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Você saiu da sua conta");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl">
            Olá, {profile?.full_name?.split(" ")[0] ?? "tutor"}!
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
          {avisos.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-2 rounded-2xl border-2 border-primary/30 bg-secondary p-3"
            >
              {item.kind === "aniversario" ? (
                <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {item.petName ? `${item.petName} · ` : ""}
                    {item.label}
                  </p>
                  <Badge
                    variant={item.days <= 1 ? "default" : "secondary"}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {item.days < 0
                      ? "Atrasado"
                      : item.days === 0
                        ? "Hoje"
                        : item.days === 1
                          ? "Amanhã"
                          : `Em ${item.days} dias`}
                  </Badge>
                </div>
                {item.dueDate && (
                  <p className="text-muted-foreground">Data: {formatDate(item.dueDate)}</p>
                )}
                {item.whatsappMessage && (
                  <a
                    className="mt-1 inline-block font-semibold text-primary underline"
                    href={whatsappLink(item.whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Meus agendamentos</h2>
          <Link to="/agendar" className="text-xs font-semibold text-primary underline">
            Novo
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {(appointments ?? []).map((item) => (
            <li key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {item.services?.name ?? "Serviço"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.scheduled_at)}
                    {item.pets?.name ? ` · ${item.pets.name}` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {item.status}
                </Badge>
              </div>
            </li>
          ))}
          {(appointments ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhum agendamento ainda.</li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg">Meus pedidos</h2>
        <ul className="mt-3 space-y-2">
          {(orders ?? []).map((order) => (
            <li key={order.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                <span className="font-display text-sm text-primary">
                  {formatBRL(order.total_cents)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
              </p>
            </li>
          ))}
          {(orders ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhum pedido ainda.</li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg">Meus pets</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Toque no pet para ver a ficha, vacinas e prontuário.
        </p>
        <ul className="mt-3 space-y-2">
          {(pets ?? []).map((pet) => (
            <li key={pet.id}>
              <Link
                to="/pets/$petId"
                params={{ petId: pet.id }}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <PawPrint className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{pet.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pet.species}
                    {pet.breed ? ` · ${pet.breed}` : ""}
                    {pet.allergies ? ` · alergias: ${pet.allergies}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {(pets ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              Cadastre seu pet ao fazer o primeiro agendamento.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
