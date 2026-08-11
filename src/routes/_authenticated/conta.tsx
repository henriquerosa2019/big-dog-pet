import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, PawPrint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { formatBRL, formatDateTime } from "@/lib/format";
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
  const isAdmin = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
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
      const { data, error } = await supabase.from("pets").select("id, name, species, breed");
      if (error) throw error;
      return data;
    },
  });

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

      {isAdmin && (
        <Button asChild variant="secondary" className="mt-4 h-11 w-full rounded-2xl">
          <Link to="/admin">
            <ShieldCheck className="h-4 w-4" />
            Painel administrativo
          </Link>
        </Button>
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
        <ul className="mt-3 space-y-2">
          {(pets ?? []).map((pet) => (
            <li
              key={pet.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <PawPrint className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{pet.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {pet.species}
                  {pet.breed ? ` · ${pet.breed}` : ""}
                </p>
              </div>
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
