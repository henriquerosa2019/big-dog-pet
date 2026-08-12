import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { formatBRL, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo | PetCura" },
      {
        name: "description",
        content:
          "Gerencie agendamentos, pedidos, serviços e produtos do Consultório Veterinário PetCura.",
      },
      { property: "og:title", content: "Painel administrativo | PetCura" },
      { property: "og:description", content: "Gestão de serviços, produtos e atendimentos." },
    ],
  }),
  component: Admin,
});

const statuses = ["pendente", "confirmado", "concluido", "cancelado"];
const orderStatuses = ["novo", "em_preparo", "entregue", "cancelado"];

const priceSchema = z.coerce.number().min(0).max(1000000);

function Admin() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const queryClient = useQueryClient();

  const { data: appointments } = useQuery({
    queryKey: ["admin-appointments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, notes, services(name), pets(name)")
        .order("scheduled_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, total_cents, status, created_at, customer_name, phone, order_items(product_name, quantity)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["admin-services"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, category, price_cents, active")
        .order("category");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price_cents, stock, active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      toast.success("Agendamento atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Pedido atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const updateCatalog = useMutation({
    mutationFn: async ({
      table,
      id,
      values,
    }: {
      table: "services" | "products";
      id: string;
      values: { price_cents?: number; active?: boolean };
    }) => {
      const { error } =
        table === "services"
          ? await supabase.from("services").update(values).eq("id", id)
          : await supabase.from("products").update(values).eq("id", id);
      if (error) throw error;
    },

    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [`admin-${vars.table}`] });
      queryClient.invalidateQueries({ queryKey: [vars.table] });
      toast.success("Catálogo atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="font-display text-xl">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva da equipe do PetCura.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl">Painel administrativo</h1>

      <Tabs defaultValue="agenda" className="mt-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4 space-y-2">
          {(appointments ?? []).map((item) => (
            <div key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-sm font-semibold">{item.services?.name ?? "Serviço"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(item.scheduled_at)}
                {item.pets?.name ? ` · ${item.pets.name}` : ""}
              </p>
              {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {statuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateAppointment.mutate({ id: item.id, status })}
                    className={
                      item.status === status
                        ? "rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                        : "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                    }
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {(appointments ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>
          )}
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4 space-y-2">
          {(orders ?? []).map((order) => (
            <div key={order.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">
                  {order.customer_name ?? "Cliente"}
                </p>
                <span className="font-display text-sm text-primary">
                  {formatBRL(order.total_cents)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(order.created_at)} · {order.phone ?? "sem telefone"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {orderStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => updateOrder.mutate({ id: order.id, status })}
                    className={
                      order.status === status
                        ? "rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                        : "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                    }
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {(orders ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
          )}
        </TabsContent>

        <TabsContent value="servicos" className="mt-4 space-y-2">
          {(services ?? []).map((service) => (
            <CatalogRow
              key={service.id}
              name={service.name}
              subtitle={service.category}
              priceCents={service.price_cents}
              active={service.active}
              onSave={(priceCents) =>
                updateCatalog.mutate({
                  table: "services",
                  id: service.id,
                  values: { price_cents: priceCents },
                })
              }
              onToggle={() =>
                updateCatalog.mutate({
                  table: "services",
                  id: service.id,
                  values: { active: !service.active },
                })
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="produtos" className="mt-4 space-y-2">
          {(products ?? []).map((product) => (
            <CatalogRow
              key={product.id}
              name={product.name}
              subtitle={`${product.category} · estoque ${product.stock}`}
              priceCents={product.price_cents}
              active={product.active}
              onSave={(priceCents) =>
                updateCatalog.mutate({
                  table: "products",
                  id: product.id,
                  values: { price_cents: priceCents },
                })
              }
              onToggle={() =>
                updateCatalog.mutate({
                  table: "products",
                  id: product.id,
                  values: { active: !product.active },
                })
              }
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogRow({
  name,
  subtitle,
  priceCents,
  active,
  onSave,
  onToggle,
}: {
  name: string;
  subtitle: string;
  priceCents: number;
  active: boolean;
  onSave: (priceCents: number) => void;
  onToggle: () => void;
}) {
  const [price, setPrice] = useState((priceCents / 100).toFixed(2));

  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant={active ? "default" : "secondary"} className="shrink-0">
          {active ? "ativo" : "inativo"}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-9 w-24 rounded-xl"
        />
        <Button
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => {
            const parsed = priceSchema.safeParse(price.replace(",", "."));
            if (!parsed.success) {
              toast.error("Preço inválido");
              return;
            }
            onSave(Math.round(parsed.data * 100));
          }}
        >
          Salvar preço
        </Button>
        <Button size="sm" variant="secondary" className="h-9 rounded-xl" onClick={onToggle}>
          {active ? "Desativar" : "Ativar"}
        </Button>
      </div>
    </div>
  );
}
