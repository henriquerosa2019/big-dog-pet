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

  const { data: allPets } = useQuery({
    queryKey: ["admin-pets"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed, temperament, allergies")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [recordPetId, setRecordPetId] = useState<string | null>(null);
  const [record, setRecord] = useState({
    reason: "",
    diagnosis: "",
    treatment: "",
    prescription: "",
    weight_kg: "",
    vet_name: "",
  });

  const { data: petRecords } = useQuery({
    queryKey: ["admin-records", recordPetId],
    enabled: isAdmin && Boolean(recordPetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select("id, visit_at, reason, diagnosis, treatment, vet_name")
        .eq("pet_id", recordPetId!)
        .order("visit_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createRecord = useMutation({
    mutationFn: async () => {
      if (!recordPetId) throw new Error("Escolha um pet");
      const reason = record.reason.trim();
      if (reason.length < 3) throw new Error("Descreva o motivo do atendimento");
      const { error } = await supabase.from("medical_records").insert({
        pet_id: recordPetId,
        reason: reason.slice(0, 200),
        diagnosis: record.diagnosis.trim().slice(0, 500) || null,
        treatment: record.treatment.trim().slice(0, 500) || null,
        prescription: record.prescription.trim().slice(0, 500) || null,
        weight_kg: record.weight_kg ? Number(record.weight_kg.replace(",", ".")) : null,
        vet_name: record.vet_name.trim().slice(0, 100) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical_records"] });
      setRecord({
        reason: "",
        diagnosis: "",
        treatment: "",
        prescription: "",
        weight_kg: "",
        vet_name: "",
      });
      toast.success("Prontuário registrado");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar"),
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

  const selectedPet = (allPets ?? []).find((p) => p.id === recordPetId);

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl">Painel administrativo</h1>

      <Tabs defaultValue="agenda" className="mt-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="clinica">Clínica</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="clinica" className="mt-4 space-y-3">
          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Selecione o pet
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(allPets ?? []).map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setRecordPetId(pet.id)}
                  className={
                    recordPetId === pet.id
                      ? "rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                      : "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                  }
                >
                  {pet.name}
                </button>
              ))}
              {(allPets ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum pet cadastrado.</p>
              )}
            </div>
          </div>

          {selectedPet && (
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-sm font-semibold">
                {selectedPet.name} · {selectedPet.species}
                {selectedPet.breed ? ` · ${selectedPet.breed}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Temperamento: {selectedPet.temperament ?? "não informado"}
              </p>
              <p className="text-xs text-muted-foreground">
                Alergias: {selectedPet.allergies ?? "não informadas"}
              </p>
            </div>
          )}

          {recordPetId && (
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novo atendimento
              </p>
              <div className="mt-2 space-y-2">
                <Input
                  placeholder="Motivo da consulta"
                  value={record.reason}
                  maxLength={200}
                  onChange={(e) => setRecord({ ...record, reason: e.target.value })}
                  className="h-11 rounded-xl"
                />
                <Textarea
                  placeholder="Diagnóstico"
                  value={record.diagnosis}
                  maxLength={500}
                  onChange={(e) => setRecord({ ...record, diagnosis: e.target.value })}
                  className="rounded-xl"
                />
                <Textarea
                  placeholder="Tratamento"
                  value={record.treatment}
                  maxLength={500}
                  onChange={(e) => setRecord({ ...record, treatment: e.target.value })}
                  className="rounded-xl"
                />
                <Textarea
                  placeholder="Prescrição"
                  value={record.prescription}
                  maxLength={500}
                  onChange={(e) => setRecord({ ...record, prescription: e.target.value })}
                  className="rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Peso (kg)"
                    inputMode="decimal"
                    value={record.weight_kg}
                    maxLength={10}
                    onChange={(e) => setRecord({ ...record, weight_kg: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                  <Input
                    placeholder="Veterinário"
                    value={record.vet_name}
                    maxLength={100}
                    onChange={(e) => setRecord({ ...record, vet_name: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <Button
                className="mt-3 h-11 w-full rounded-xl"
                disabled={createRecord.isPending}
                onClick={() => createRecord.mutate()}
              >
                {createRecord.isPending ? "Salvando..." : "Salvar no prontuário"}
              </Button>
            </div>
          )}

          {(petRecords ?? []).map((r) => (
            <div key={r.id} className="rounded-2xl bg-card p-3 shadow-card">
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
              {r.vet_name && <p className="text-[11px] text-muted-foreground">{r.vet_name}</p>}
            </div>
          ))}
        </TabsContent>

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
