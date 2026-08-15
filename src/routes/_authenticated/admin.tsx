import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CheckCircle2, Eye, EyeOff, Gift, MessageCircle, Syringe } from "lucide-react";
import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import {
  CLINIC,
  daysUntil,
  digitsOnly,
  formatBRL,
  formatDate,
  formatDateTime,
  formatPetAge,
  isBirthdayToday,
  isBirthdayTomorrow,
  whatsappLinkTo,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const newClientSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome do cliente").max(100),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido")
    .max(20)
    .regex(/^[0-9()\-\s+]+$/, "Use apenas números e símbolos de telefone"),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(72),
  birthDate: z.string().trim().max(10).optional(),
});

// Reaproveitado para editar um cliente já cadastrado (sem e-mail/senha — ver
// updateClient/sendPasswordReset mais abaixo, que tratam esses dois campos
// separadamente por exigirem a API de admin do Supabase).
const editClientSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome do cliente").max(100),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido")
    .max(20)
    .regex(/^[0-9()\-\s+]+$/, "Use apenas números e símbolos de telefone"),
  birthDate: z.string().trim().max(10).optional(),
});

const newClientPetSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do pet").max(60),
  species: z.string().trim().min(2).max(30),
  breed: z.string().trim().max(60).optional(),
  temperament: z.string().trim().max(300).optional(),
  allergies: z.string().trim().max(300).optional(),
  birthDate: z.string().trim().max(10).optional(),
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

const returnTypes = ["vacina", "exame", "retorno", "retirada_pontos", "outro"] as const;
type ReturnType = (typeof returnTypes)[number];

const returnTypeLabels: Record<ReturnType, string> = {
  vacina: "Vacina",
  exame: "Exame de retorno",
  retorno: "Consulta de retorno",
  retirada_pontos: "Retirada de pontos",
  outro: "Outro",
};

const serviceCategories = ["banho", "tosa", "veterinario"] as const;
const serviceCategoryLabels: Record<(typeof serviceCategories)[number], string> = {
  banho: "Banho",
  tosa: "Tosa",
  veterinario: "Veterinário",
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

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
        .select("id, user_id, scheduled_at, status, notes, origin, services(name), pets(name)")
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

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, birth_date, email, created_at");
      if (error) throw error;
      return data;
    },
  });

  const profileById = useMemo(() => {
    const map = new Map<
      string,
      {
        full_name: string | null;
        phone: string | null;
        birth_date: string | null;
        email: string | null;
      }
    >();
    for (const p of profiles ?? [])
      map.set(p.id, {
        full_name: p.full_name,
        phone: p.phone,
        birth_date: p.birth_date,
        email: p.email,
      });
    return map;
  }, [profiles]);

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

  const dashboardBoundaries = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const earliest = weekStart < monthStart ? weekStart : monthStart;
    return { dayStart, weekStart, monthStart, earliest };
  }, []);

  const { data: dashAppointments } = useQuery({
    queryKey: ["admin-dash-appointments", dashboardBoundaries.earliest.toISOString()],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, origin, services(category)")
        .gte("scheduled_at", dashboardBoundaries.earliest.toISOString())
        .neq("status", "cancelado");
      if (error) throw error;
      return data;
    },
  });

  const { data: dashOrders } = useQuery({
    queryKey: ["admin-dash-orders", dashboardBoundaries.earliest.toISOString()],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, total_cents")
        .gte("created_at", dashboardBoundaries.earliest.toISOString())
        .neq("status", "cancelado");
      if (error) throw error;
      return data;
    },
  });

  const { data: dashProfiles } = useQuery({
    queryKey: ["admin-dash-profiles", dashboardBoundaries.earliest.toISOString()],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .gte("created_at", dashboardBoundaries.earliest.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const dashboardStats = useMemo(() => {
    const { dayStart, weekStart, monthStart } = dashboardBoundaries;

    function bucketCounts<T>(items: T[], getDate: (item: T) => string) {
      let day = 0;
      let week = 0;
      let month = 0;
      for (const item of items) {
        const d = new Date(getDate(item));
        if (d >= monthStart) month += 1;
        if (d >= weekStart) week += 1;
        if (d >= dayStart) day += 1;
      }
      return { day, week, month };
    }

    const apptByCategory = {} as Record<
      (typeof serviceCategories)[number],
      { day: number; week: number; month: number }
    >;
    for (const cat of serviceCategories) {
      const items = (dashAppointments ?? []).filter((a) => a.services?.category === cat);
      apptByCategory[cat] = bucketCounts(items, (a) => a.scheduled_at);
    }
    const apptTotal = bucketCounts(dashAppointments ?? [], (a) => a.scheduled_at);

    const orderCounts = bucketCounts(dashOrders ?? [], (o) => o.created_at);
    function sumRevenue(since: Date) {
      return (dashOrders ?? [])
        .filter((o) => new Date(o.created_at) >= since)
        .reduce((sum, o) => sum + o.total_cents, 0);
    }
    const orderRevenue = {
      day: sumRevenue(dayStart),
      week: sumRevenue(weekStart),
      month: sumRevenue(monthStart),
    };

    const newClients = bucketCounts(dashProfiles ?? [], (p) => p.created_at);

    const campaignAppointments = (dashAppointments ?? []).filter(
      (a) => a.origin === "campanha_niver",
    );
    const campaignNiver = bucketCounts(campaignAppointments, (a) => a.scheduled_at);

    return { apptByCategory, apptTotal, orderCounts, orderRevenue, newClients, campaignNiver };
  }, [dashAppointments, dashOrders, dashProfiles, dashboardBoundaries]);

  const pendingAppointments = useMemo(() => {
    return (appointments ?? [])
      .filter((a) => a.status === "pendente")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [appointments]);

  const [newClient, setNewClient] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    birthDate: "",
  });
  const [showNewClientPassword, setShowNewClientPassword] = useState(false);
  const [newClientPet, setNewClientPet] = useState({
    name: "",
    species: "cachorro",
    breed: "",
    temperament: "",
    allergies: "",
    birthDate: "",
  });
  const [duplicateEmailNotice, setDuplicateEmailNotice] = useState(false);

  const createClient = useMutation({
    mutationFn: async () => {
      const client = newClientSchema.parse(newClient);
      const { data, error } = await supabase.auth.signUp({
        email: client.email,
        password: client.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: client.fullName,
            phone: client.phone,
            birth_date: client.birthDate || undefined,
          },
        },
      });
      if (error) {
        // Dependendo da config. de confirmação de e-mail do projeto, e-mail
        // duplicado pode vir como erro explícito (em vez do usuário "fantasma"
        // tratado abaixo) — trata os dois casos como "cliente já existe".
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          return { duplicate: true as const };
        }
        throw error;
      }
      // Quando a confirmação de e-mail está ativa, o Supabase retorna um
      // usuário "fantasma" com identities vazio para e-mail já cadastrado —
      // não cria duplicata nem envia e-mail novo, então usamos isso também
      // para detectar o cliente já existente.
      const alreadyExists = (data.user?.identities?.length ?? 0) === 0;
      if (alreadyExists) return { duplicate: true as const };

      if (newClientPet.name.trim()) {
        const pet = newClientPetSchema.parse(newClientPet);
        const { error: petError } = await supabase.from("pets").insert({
          owner_id: data.user!.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed || null,
          temperament: pet.temperament || null,
          allergies: pet.allergies || null,
          birth_date: pet.birthDate || null,
        });
        if (petError) throw petError;
      }
      return { duplicate: false as const };
    },
    onSuccess: (result) => {
      if (result.duplicate) {
        setDuplicateEmailNotice(true);
        toast.error("Esse e-mail já tem conta cadastrada no Petcura.");
        return;
      }
      setDuplicateEmailNotice(false);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pets"] });
      toast.success("Cliente cadastrado! Peça para confirmar o e-mail antes de usar o app.");
      setNewClient({ fullName: "", phone: "", email: "", password: "", birthDate: "" });
      setNewClientPet({
        name: "",
        species: "cachorro",
        breed: "",
        temperament: "",
        allergies: "",
        birthDate: "",
      });
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0]!.message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Não foi possível cadastrar");
      }
    },
  });

  // Detecta um cliente já cadastrado enquanto o admin digita nome + telefone
  // no formulário de "Novo Cliente", para oferecer edição em vez de duplicar.
  const matchedClientPhoneDigits = digitsOnly(newClient.phone);
  const { data: matchedClient } = useQuery({
    queryKey: [
      "admin-client-match",
      newClient.fullName.trim().toLowerCase(),
      matchedClientPhoneDigits,
    ],
    enabled:
      isAdmin && newClient.fullName.trim().length >= 2 && matchedClientPhoneDigits.length >= 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, birth_date, email")
        .ilike("full_name", newClient.fullName.trim());
      if (error) throw error;
      return (
        (data ?? []).find((p) => digitsOnly(p.phone ?? "") === matchedClientPhoneDigits) ?? null
      );
    },
  });

  const [ignoreMatch, setIgnoreMatch] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClient, setEditClient] = useState({ fullName: "", phone: "", birthDate: "" });

  // "Cadastrar novo mesmo assim" só deve valer para a busca atual — se o
  // admin mexer no nome/telefone de novo, reabilita a detecção de cliente.
  useEffect(() => {
    setIgnoreMatch(false);
  }, [newClient.fullName, newClient.phone]);

  useEffect(() => {
    if (matchedClient && !ignoreMatch) {
      setEditingClientId(matchedClient.id);
      setEditClient({
        fullName: matchedClient.full_name ?? "",
        phone: matchedClient.phone ?? "",
        birthDate: matchedClient.birth_date ?? "",
      });
    } else {
      setEditingClientId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedClient?.id, ignoreMatch]);

  const updateClient = useMutation({
    mutationFn: async () => {
      if (!editingClientId) throw new Error("Nenhum cliente selecionado");
      const client = editClientSchema.parse(editClient);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: client.fullName,
          phone: client.phone,
          birth_date: client.birthDate || null,
        })
        .eq("id", editingClientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-client-match"] });
      toast.success("Dados do cliente atualizados!");
      setNewClient({ fullName: "", phone: "", email: "", password: "", birthDate: "" });
      setEditingClientId(null);
      setIgnoreMatch(false);
    },
    onError: (error) => {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0]!.message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Não foi possível salvar");
      }
    },
  });

  // Trocar a senha de OUTRO usuário exige a service role key do Supabase
  // (API de admin), que só pode rodar em backend — não temos essa peça hoje.
  // Em vez disso, disparamos o fluxo padrão de recuperação de senha por
  // e-mail, que o próprio cliente usa para definir uma nova senha.
  const sendPasswordReset = useMutation({
    mutationFn: async () => {
      if (!matchedClient?.email) throw new Error("Cliente sem e-mail cadastrado.");
      const { error } = await supabase.auth.resetPasswordForEmail(matchedClient.email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link de redefinição de senha enviado para o e-mail do cliente.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o link");
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

  // Marca/desmarca manualmente que um agendamento veio da campanha de aniversário,
  // para aparecer no contador "Retorno da Campanha Niver" do Dashboard.
  const setAppointmentOrigin = useMutation({
    mutationFn: async ({ id, origin }: { id: string; origin: string | null }) => {
      const { error } = await supabase.from("appointments").update({ origin }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });
    },
    onError: () => toast.error("Não foi possível marcar a origem"),
  });

  const confirmAppointment = useMutation({
    mutationFn: async (item: {
      id: string;
      user_id: string;
      scheduled_at: string;
      services?: { name: string } | null;
      pets?: { name: string } | null;
    }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "confirmado" })
        .eq("id", item.id);
      if (error) throw error;
      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      const client = profileById.get(item.user_id);
      const message = `Ol\u00e1${client?.full_name ? `, ${client.full_name}` : ""}! Seu agendamento de ${item.services?.name ?? "servi\u00e7o"}${item.pets?.name ? ` para ${item.pets.name}` : ""} em ${formatDateTime(item.scheduled_at)} foi CONFIRMADO pelo ${CLINIC.name}. Qualquer d\u00favida, estamos \u00e0 disposi\u00e7\u00e3o!`;
      const link = whatsappLinkTo(client?.phone, message);
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
        toast.success("Agendamento confirmado! Envie a mensagem no WhatsApp que abriu.");
      } else {
        toast.error("Agendamento confirmado, mas o cliente n\u00e3o tem telefone cadastrado.");
      }
    },
    onError: () => toast.error("N\u00e3o foi poss\u00edvel confirmar"),
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
        .select("id, name, species, breed, temperament, allergies, owner_id, birth_date")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Nomes de pets agrupados por dono, usados na lista de "Clientes novos" do
  // Dashboard (nome do tutor + pet) e não só a contagem.
  const petNamesByOwner = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pet of allPets ?? []) {
      if (!pet.owner_id) continue;
      const list = map.get(pet.owner_id) ?? [];
      list.push(pet.name);
      map.set(pet.owner_id, list);
    }
    return map;
  }, [allPets]);

  const newClientsList = useMemo(() => {
    return (dashProfiles ?? [])
      .map((p) => ({
        id: p.id,
        fullName: p.full_name ?? "Sem nome",
        createdAt: p.created_at,
        petNames: petNamesByOwner.get(p.id) ?? [],
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [dashProfiles, petNamesByOwner]);

  // Filtro de período (dia/semana/mês) para a lista de "Clientes novos" do
  // Dashboard — os contadores continuam mostrando os três períodos sempre,
  // só a lista abaixo muda para não poluir a tela quando há muitos clientes.
  const [newClientsFilter, setNewClientsFilter] = useState<"day" | "week" | "month">("day");

  const filteredNewClients = useMemo(() => {
    const { dayStart, weekStart, monthStart } = dashboardBoundaries;
    const since =
      newClientsFilter === "day" ? dayStart : newClientsFilter === "week" ? weekStart : monthStart;
    return newClientsList.filter((client) => new Date(client.createdAt) >= since);
  }, [newClientsList, newClientsFilter, dashboardBoundaries]);

  // Aniversariantes de hoje E amanhã (dono ou pet) para a campanha de niver
  // do Dashboard — pedido do Henrique 2026-08-14 pra dar um dia de antecedência.
  const birthdaysSoon = useMemo(() => {
    type BirthdayEntry = {
      key: string;
      kind: "dono" | "pet";
      when: "hoje" | "amanha";
      ownerId: string;
      ownerName: string;
      phone: string | null;
      petName?: string;
      petAge?: string | null;
    };
    const entries: BirthdayEntry[] = [];
    for (const p of profiles ?? []) {
      const when = isBirthdayToday(p.birth_date)
        ? "hoje"
        : isBirthdayTomorrow(p.birth_date)
          ? "amanha"
          : null;
      if (when) {
        entries.push({
          key: `owner-${p.id}`,
          kind: "dono",
          when,
          ownerId: p.id,
          ownerName: p.full_name ?? "Cliente",
          phone: p.phone,
        });
      }
    }
    for (const pet of allPets ?? []) {
      const when = isBirthdayToday(pet.birth_date)
        ? "hoje"
        : isBirthdayTomorrow(pet.birth_date)
          ? "amanha"
          : null;
      if (when && pet.owner_id) {
        const owner = profileById.get(pet.owner_id);
        entries.push({
          key: `pet-${pet.id}`,
          kind: "pet",
          when,
          ownerId: pet.owner_id,
          ownerName: owner?.full_name ?? "Cliente",
          phone: owner?.phone ?? null,
          petName: pet.name,
          petAge: formatPetAge(pet.birth_date),
        });
      }
    }
    // Hoje primeiro, depois amanhã.
    return entries.sort((a, b) => (a.when === b.when ? 0 : a.when === "hoje" ? -1 : 1));
  }, [profiles, allPets, profileById]);

  const [recordPetId, setRecordPetId] = useState<string | null>(null);
  const [record, setRecord] = useState({
    record_type: "consulta" as (typeof recordTypes)[number],
    reason: "",
    diagnosis: "",
    treatment: "",
    prescription: "",
    medication: "",
    dosage: "",
    duration: "",
    weight_kg: "",
    vet_name: "",
    next_return_date: "",
  });
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const { data: petRecords } = useQuery({
    queryKey: ["admin-records", recordPetId],
    enabled: isAdmin && Boolean(recordPetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select("id, visit_at, reason, diagnosis, treatment, vet_name, record_type")
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

      const attachmentPaths: string[] = [];
      for (const file of attachmentFiles) {
        const path = `${recordPetId}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("medical-attachments")
          .upload(path, file);
        if (uploadError) throw new Error(`Falha ao enviar anexo: ${uploadError.message}`);
        attachmentPaths.push(path);
      }

      const { data: inserted, error } = await supabase
        .from("medical_records")
        .insert({
          pet_id: recordPetId,
          record_type: record.record_type,
          reason: reason.slice(0, 200),
          diagnosis: record.diagnosis.trim().slice(0, 500) || null,
          treatment: record.treatment.trim().slice(0, 500) || null,
          prescription: record.prescription.trim().slice(0, 500) || null,
          medication: record.medication.trim().slice(0, 200) || null,
          dosage: record.dosage.trim().slice(0, 100) || null,
          duration: record.duration.trim().slice(0, 100) || null,
          weight_kg: record.weight_kg ? Number(record.weight_kg.replace(",", ".")) : null,
          vet_name: record.vet_name.trim().slice(0, 100) || null,
          next_return_date: record.next_return_date || null,
          attachments: attachmentPaths,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (record.next_return_date) {
        const { error: reminderError } = await supabase.from("care_reminders").insert({
          pet_id: recordPetId,
          reminder_type: "retorno",
          title: `Retorno: ${reason}`.slice(0, 120),
          due_date: record.next_return_date,
          source_record_id: inserted!.id,
        });
        if (reminderError) throw reminderError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical_records"] });
      queryClient.invalidateQueries({ queryKey: ["care_reminders"] });
      setRecord({
        record_type: "consulta",
        reason: "",
        diagnosis: "",
        treatment: "",
        prescription: "",
        medication: "",
        dosage: "",
        duration: "",
        weight_kg: "",
        vet_name: "",
        next_return_date: "",
      });
      setAttachmentFiles([]);
      setFileInputKey((k) => k + 1);
      toast.success("Prontuário registrado");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar"),
  });

  const { data: vaccinesDue } = useQuery({
    queryKey: ["admin-vaccinations-due"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vaccinations")
        .select("id, vaccine_name, next_due_at, pet_id, pets(name, owner_id)")
        .not("next_due_at", "is", null)
        .order("next_due_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: careReminders } = useQuery({
    queryKey: ["admin-care-reminders"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_reminders")
        .select(
          "id, reminder_type, title, due_date, notes, completed, pet_id, pets(name, owner_id)",
        )
        .eq("completed", false)
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });

  const completeReturnReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("care_reminders")
        .update({ completed: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-care-reminders"] });
      toast.success("Retorno concluído");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const [returnFilter, setReturnFilter] = useState<"todos" | ReturnType>("todos");
  const [returnDate, setReturnDate] = useState<Date>(new Date());

  const allReturns = useMemo(() => {
    const fromVaccines = (vaccinesDue ?? []).map((v) => ({
      key: `vaccine-${v.id}`,
      type: "vacina" as ReturnType,
      title: `Reforço: ${v.vaccine_name}`,
      dueDate: v.next_due_at as string,
      petName: v.pets?.name ?? "Pet",
      ownerId: v.pets?.owner_id as string | undefined,
      reminderId: null as string | null,
    }));
    const fromReminders = (careReminders ?? []).map((r) => ({
      key: `reminder-${r.id}`,
      type: r.reminder_type as ReturnType,
      title: r.title,
      dueDate: r.due_date,
      petName: r.pets?.name ?? "Pet",
      ownerId: r.pets?.owner_id as string | undefined,
      reminderId: r.id as string | null,
    }));
    return [...fromVaccines, ...fromReminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [vaccinesDue, careReminders]);

  // Vacinas + retornos dos próximos 30 dias para o card do Dashboard (pedido
  // do Henrique 2026-08-14) — allReturns acima não tem limite de data, então
  // filtramos aqui só para essa janela, igual ao painel do tutor em Conta.tsx.
  const returnsNext30Days = useMemo(() => {
    const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const today = todayISODate();
    return allReturns
      .filter((item) => item.dueDate >= today && item.dueDate <= limit)
      .map((item) => ({ ...item, days: daysUntil(item.dueDate) }));
  }, [allReturns]);

  const selectedReturnDateISO = returnDate.toISOString().slice(0, 10);

  const filteredReturns = allReturns.filter((item) => {
    const matchesType = returnFilter === "todos" || item.type === returnFilter;
    const referenceDate = returnFilter === "todos" ? todayISODate() : selectedReturnDateISO;
    return matchesType && item.dueDate === referenceDate;
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

      <Tabs defaultValue="dashboard" className="mt-4">
        <TabsList className="flex w-full items-center justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="dashboard" className="shrink-0">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="novo-cliente" className="shrink-0">
            Novo Cliente
          </TabsTrigger>
          <TabsTrigger value="agenda" className="shrink-0">
            Agendamentos
          </TabsTrigger>
          <TabsTrigger value="retornos" className="shrink-0">
            Retornos
          </TabsTrigger>
          <TabsTrigger value="clinica" className="shrink-0">
            Clínica
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="shrink-0">
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="servicos" className="shrink-0">
            Serviços
          </TabsTrigger>
          <TabsTrigger value="produtos" className="shrink-0">
            Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-3">
          {pendingAppointments.length > 0 ? (
            <div className="rounded-2xl border-2 border-primary/40 bg-secondary p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novos agendamentos ({pendingAppointments.length})
              </p>
              <div className="mt-2 space-y-2">
                {pendingAppointments.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-xl bg-card p-2.5 shadow-card">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <p className="text-sm font-semibold">{item.services?.name ?? "Serviço"}</p>
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.scheduled_at)}
                      {item.pets?.name ? ` · ${item.pets.name}` : ""}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 h-9 w-full rounded-xl"
                      disabled={confirmAppointment.isPending}
                      onClick={() => confirmAppointment.mutate(item)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar e avisar no WhatsApp
                    </Button>
                  </div>
                ))}
              </div>
              {pendingAppointments.length > 6 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  + {pendingAppointments.length - 6} na aba Agendamentos.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-sm text-muted-foreground">Nenhum agendamento novo no momento.</p>
            </div>
          )}

          {birthdaysSoon.length > 0 && (
            <div className="rounded-2xl border-2 border-gold/50 bg-secondary p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Gift className="h-3.5 w-3.5 text-gold" />
                Nivers de hoje e amanhã ({birthdaysSoon.length})
              </p>
              <div className="mt-2 space-y-2">
                {birthdaysSoon.map((entry) => {
                  const isToday = entry.when === "hoje";
                  const message = isToday
                    ? entry.kind === "pet"
                      ? `Feliz aniversário para ${entry.petName}! 🎉🐾 Para comemorar, o ${CLINIC.name} preparou 20% de desconto em banho ou tosa hoje. Quer aproveitar e já agendar?`
                      : `Feliz aniversário, ${entry.ownerName}! 🎉 Para comemorar, o ${CLINIC.name} preparou 20% de desconto em banho ou tosa para o seu pet hoje. Quer aproveitar e já agendar?`
                    : entry.kind === "pet"
                      ? `Oi! Passando pra avisar que amanhã é aniversário do(a) ${entry.petName} 🎉🐾 Já vamos preparar 20% de desconto em banho ou tosa pra comemorar — quer garantir o horário?`
                      : `Oi, ${entry.ownerName}! Amanhã é seu aniversário 🎉 Já vamos preparar 20% de desconto em banho ou tosa pro seu pet pra comemorar — quer garantir o horário?`;
                  const link = whatsappLinkTo(entry.phone, message);
                  return (
                    <div key={entry.key} className="rounded-xl bg-card p-2.5 shadow-card">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {entry.kind === "pet" ? entry.petName : entry.ownerName}
                          {entry.kind === "pet" && (
                            <span className="ml-1 font-normal text-muted-foreground">
                              · {entry.ownerName}
                            </span>
                          )}
                        </p>
                        <Badge variant={isToday ? "default" : "secondary"} className="shrink-0">
                          {isToday ? "Hoje" : "Amanhã"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.kind === "pet"
                          ? `Aniversário do pet${entry.petAge ? ` · ${entry.petAge} de vida` : ""}`
                          : "Aniversário do dono"}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 h-9 w-full rounded-xl"
                        disabled={!link}
                        onClick={() => link && window.open(link, "_blank", "noopener,noreferrer")}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {link
                          ? isToday
                            ? "Enviar parabéns + oferta no WhatsApp"
                            : "Avisar + oferta no WhatsApp"
                          : "Sem telefone cadastrado"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Revise a mensagem no WhatsApp antes de enviar — nada é enviado automaticamente.
              </p>
            </div>
          )}

          {returnsNext30Days.length > 0 && (
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vacinas e retornos (30 dias) · {returnsNext30Days.length}
              </p>
              <div className="mt-2 space-y-1.5">
                {returnsNext30Days.slice(0, 8).map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 rounded-xl surface-paper px-2.5 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{item.petName}</span>{" "}
                      <span className="text-muted-foreground">· {item.title}</span>
                    </span>
                    <Badge
                      variant={item.days <= 1 ? "default" : "secondary"}
                      className="shrink-0 whitespace-nowrap"
                    >
                      {item.days === 0
                        ? "Hoje"
                        : item.days === 1
                          ? "Amanhã"
                          : `Em ${item.days} dias`}
                    </Badge>
                  </div>
                ))}
              </div>
              {returnsNext30Days.length > 8 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  + {returnsNext30Days.length - 8} na aba Retornos.
                </p>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Agendamentos
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Categoria</th>
                    <th className="px-2 py-1 text-center font-medium">Hoje</th>
                    <th className="px-2 py-1 text-center font-medium">Semana</th>
                    <th className="px-2 py-1 text-center font-medium">Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceCategories.map((cat) => (
                    <tr key={cat} className="border-t border-border/60">
                      <td className="py-1.5 pr-2">{serviceCategoryLabels[cat]}</td>
                      <td className="px-2 py-1.5 text-center font-semibold">
                        {dashboardStats.apptByCategory[cat]?.day ?? 0}
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold">
                        {dashboardStats.apptByCategory[cat]?.week ?? 0}
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold">
                        {dashboardStats.apptByCategory[cat]?.month ?? 0}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/60 font-semibold text-primary">
                    <td className="py-1.5 pr-2">Total</td>
                    <td className="px-2 py-1.5 text-center">{dashboardStats.apptTotal.day}</td>
                    <td className="px-2 py-1.5 text-center">{dashboardStats.apptTotal.week}</td>
                    <td className="px-2 py-1.5 text-center">{dashboardStats.apptTotal.month}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Não inclui agendamentos cancelados.
            </p>
          </div>

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vendas de produtos
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["Hoje", dashboardStats.orderCounts.day, dashboardStats.orderRevenue.day],
                  ["Semana", dashboardStats.orderCounts.week, dashboardStats.orderRevenue.week],
                  ["Mês", dashboardStats.orderCounts.month, dashboardStats.orderRevenue.month],
                ] as const
              ).map(([label, count, cents]) => (
                <div key={label} className="rounded-xl surface-paper p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="font-display text-lg text-primary">{formatBRL(cents)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {count} pedido{count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Não inclui pedidos cancelados.</p>
          </div>

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Clientes novos cadastrados
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["Hoje", "day", dashboardStats.newClients.day],
                  ["Semana", "week", dashboardStats.newClients.week],
                  ["Mês", "month", dashboardStats.newClients.month],
                ] as const
              ).map(([label, key, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNewClientsFilter(key)}
                  className={
                    newClientsFilter === key
                      ? "rounded-xl bg-primary p-2 text-center text-primary-foreground shadow-card"
                      : "rounded-xl surface-paper p-2 text-center transition-colors"
                  }
                >
                  <p
                    className={
                      newClientsFilter === key
                        ? "text-[11px] text-primary-foreground/80"
                        : "text-[11px] text-muted-foreground"
                    }
                  >
                    {label}
                  </p>
                  <p
                    className={
                      newClientsFilter === key
                        ? "font-display text-xl"
                        : "font-display text-xl text-primary"
                    }
                  >
                    {count}
                  </p>
                </button>
              ))}
            </div>
            {filteredNewClients.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {filteredNewClients.map((client) => (
                  <li
                    key={client.id}
                    className="flex items-center justify-between gap-2 rounded-xl surface-paper px-2.5 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{client.fullName}</span>
                      {client.petNames.length > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {client.petNames.join(", ")}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDate(client.createdAt.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Nenhum cliente novo nesse período.
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Retorno da Campanha Niver
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["Hoje", dashboardStats.campaignNiver.day],
                  ["Semana", dashboardStats.campaignNiver.week],
                  ["Mês", dashboardStats.campaignNiver.month],
                ] as const
              ).map(([label, count]) => (
                <div key={label} className="rounded-xl surface-paper p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="font-display text-xl text-primary">{count}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Agendamentos marcados manualmente como "Campanha Niver" na aba Agendamentos.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="novo-cliente" className="mt-4 space-y-3">
          {duplicateEmailNotice && (
            <div className="rounded-2xl border-2 border-primary/40 bg-secondary p-3">
              <p className="text-sm font-semibold">Esse e-mail já tem conta no Petcura</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Peça para o cliente entrar com e-mail e senha na aba Conta, no aparelho dele. Não é
                possível fazer login por essa tela sem encerrar sua sessão de administrador.
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dados do cliente
            </p>
            <div className="mt-2 space-y-2">
              <div>
                <Label htmlFor="nc-name">Nome completo</Label>
                <Input
                  id="nc-name"
                  value={newClient.fullName}
                  maxLength={100}
                  onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="nc-phone">Telefone</Label>
                <Input
                  id="nc-phone"
                  inputMode="tel"
                  value={newClient.phone}
                  maxLength={20}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="mt-1 h-10 rounded-xl"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Se nome + telefone já pertencerem a um cliente cadastrado, os dados dele aparecem
                  abaixo para edição em vez de um cadastro novo.
                </p>
              </div>

              {!editingClientId && (
                <>
                  <div>
                    <Label htmlFor="nc-email">E-mail</Label>
                    <Input
                      id="nc-email"
                      type="email"
                      value={newClient.email}
                      maxLength={255}
                      onChange={(e) => {
                        setNewClient({ ...newClient, email: e.target.value });
                        setDuplicateEmailNotice(false);
                      }}
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nc-password">Senha inicial</Label>
                    <div className="relative mt-1">
                      <Input
                        id="nc-password"
                        type={showNewClientPassword ? "text" : "password"}
                        value={newClient.password}
                        maxLength={72}
                        onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                        className="h-10 rounded-xl pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewClientPassword((v) => !v)}
                        aria-label={showNewClientPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showNewClientPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Combine essa senha com o cliente na hora — ele poderá trocar depois pelo app.
                      Evite senhas óbvias (ex.: 123456) — o Supabase pode rejeitar senhas muito
                      fracas.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="nc-birth">Aniversário do dono (opcional)</Label>
                    <Input
                      id="nc-birth"
                      type="date"
                      value={newClient.birthDate}
                      onChange={(e) => setNewClient({ ...newClient, birthDate: e.target.value })}
                      className="mt-1 h-10 rounded-xl"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Usado para a campanha de aniversário no Dashboard.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {editingClientId ? (
            <>
              <div className="rounded-2xl border-2 border-gold/50 bg-secondary p-3">
                <p className="text-sm font-semibold">✓ Cliente já cadastrado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confira e edite os dados abaixo. Não é este cliente?{" "}
                  <button
                    type="button"
                    onClick={() => setIgnoreMatch(true)}
                    className="font-semibold text-primary underline"
                  >
                    Cadastrar novo mesmo assim
                  </button>
                  .
                </p>
              </div>

              <div className="rounded-2xl bg-card p-3 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Editar dados do cliente
                </p>
                <div className="mt-2 space-y-2">
                  <div>
                    <Label htmlFor="ec-name">Nome completo</Label>
                    <Input
                      id="ec-name"
                      value={editClient.fullName}
                      maxLength={100}
                      onChange={(e) => setEditClient({ ...editClient, fullName: e.target.value })}
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ec-phone">Telefone</Label>
                    <Input
                      id="ec-phone"
                      inputMode="tel"
                      value={editClient.phone}
                      maxLength={20}
                      onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ec-email">E-mail</Label>
                    <Input
                      id="ec-email"
                      value={matchedClient?.email ?? "Não informado"}
                      disabled
                      className="mt-1 h-10 rounded-xl bg-muted text-muted-foreground"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      O e-mail só pode ser trocado pelo próprio cliente, logado na conta dele.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ec-birth">Aniversário do dono (opcional)</Label>
                    <Input
                      id="ec-birth"
                      type="date"
                      value={editClient.birthDate}
                      onChange={(e) => setEditClient({ ...editClient, birthDate: e.target.value })}
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 w-full rounded-xl"
                    disabled={sendPasswordReset.isPending || !matchedClient?.email}
                    onClick={() => sendPasswordReset.mutate()}
                  >
                    {sendPasswordReset.isPending
                      ? "Enviando..."
                      : "Enviar link de redefinição de senha"}
                  </Button>
                </div>
              </div>

              <Button
                className="h-11 w-full rounded-2xl"
                disabled={updateClient.isPending}
                onClick={() => updateClient.mutate()}
              >
                {updateClient.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-card p-3 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pet (opcional)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nome"
                    value={newClientPet.name}
                    maxLength={60}
                    onChange={(e) => setNewClientPet({ ...newClientPet, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                  <Input
                    placeholder="Espécie"
                    value={newClientPet.species}
                    maxLength={30}
                    onChange={(e) => setNewClientPet({ ...newClientPet, species: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                  <Input
                    placeholder="Raça (opcional)"
                    value={newClientPet.breed}
                    maxLength={60}
                    onChange={(e) => setNewClientPet({ ...newClientPet, breed: e.target.value })}
                    className="col-span-2 h-10 rounded-xl"
                  />
                  <Input
                    placeholder="Temperamento (opcional)"
                    value={newClientPet.temperament}
                    maxLength={300}
                    onChange={(e) =>
                      setNewClientPet({ ...newClientPet, temperament: e.target.value })
                    }
                    className="col-span-2 h-10 rounded-xl"
                  />
                  <Input
                    placeholder="Alergias (opcional)"
                    value={newClientPet.allergies}
                    maxLength={300}
                    onChange={(e) =>
                      setNewClientPet({ ...newClientPet, allergies: e.target.value })
                    }
                    className="col-span-2 h-10 rounded-xl"
                  />
                  <div className="col-span-2">
                    <Label htmlFor="nc-pet-birth" className="text-xs text-muted-foreground">
                      Aniversário do pet (opcional)
                    </Label>
                    <Input
                      id="nc-pet-birth"
                      type="date"
                      value={newClientPet.birthDate}
                      onChange={(e) =>
                        setNewClientPet({ ...newClientPet, birthDate: e.target.value })
                      }
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="h-11 w-full rounded-2xl"
                disabled={createClient.isPending}
                onClick={() => createClient.mutate()}
              >
                {createClient.isPending ? "Cadastrando..." : "Cadastrar cliente"}
              </Button>
            </>
          )}
        </TabsContent>

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
                <Select
                  value={record.record_type}
                  onValueChange={(value) =>
                    setRecord({ ...record, record_type: value as (typeof recordTypes)[number] })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={recordTypeLabels[record.record_type]} />
                  </SelectTrigger>
                  <SelectContent>
                    {recordTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {recordTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  placeholder="Prescrição (observações gerais)"
                  value={record.prescription}
                  maxLength={500}
                  onChange={(e) => setRecord({ ...record, prescription: e.target.value })}
                  className="rounded-xl"
                />
                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Medicação estruturada (opcional)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Medicamento"
                    value={record.medication}
                    maxLength={200}
                    onChange={(e) => setRecord({ ...record, medication: e.target.value })}
                    className="col-span-3 h-11 rounded-xl"
                  />
                  <Input
                    placeholder="Dose"
                    value={record.dosage}
                    maxLength={100}
                    onChange={(e) => setRecord({ ...record, dosage: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                  <Input
                    placeholder="Duração"
                    value={record.duration}
                    maxLength={100}
                    onChange={(e) => setRecord({ ...record, duration: e.target.value })}
                    className="col-span-2 h-11 rounded-xl"
                  />
                </div>
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
                <div>
                  <Label htmlFor="next-return" className="text-xs text-muted-foreground">
                    Data de retorno (gera lembrete automático)
                  </Label>
                  <Input
                    id="next-return"
                    type="date"
                    value={record.next_return_date}
                    onChange={(e) => setRecord({ ...record, next_return_date: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="attachments" className="text-xs text-muted-foreground">
                    Anexos (exame, foto, etc.)
                  </Label>
                  <Input
                    key={fileInputKey}
                    id="attachments"
                    type="file"
                    multiple
                    onChange={(e) => setAttachmentFiles(Array.from(e.target.files ?? []))}
                    className="mt-1 h-11 rounded-xl"
                  />
                  {attachmentFiles.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {attachmentFiles.length} arquivo(s) selecionado(s)
                    </p>
                  )}
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
          <p className="text-xs text-muted-foreground">
            Confirme os agendamentos pendentes para avisar o cliente automaticamente pelo WhatsApp.
          </p>

          {(appointments ?? []).map((item) => (
            <div key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <p className="text-sm font-semibold">{item.services?.name ?? "Serviço"}</p>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {item.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(item.scheduled_at)}
                {item.pets?.name ? ` · ${item.pets.name}` : ""}
              </p>
              {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
              {item.status === "pendente" && (
                <Button
                  size="sm"
                  className="mt-2 h-9 w-full rounded-xl"
                  disabled={confirmAppointment.isPending}
                  onClick={() => confirmAppointment.mutate(item)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar e avisar no WhatsApp
                </Button>
              )}
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
              <button
                onClick={() =>
                  setAppointmentOrigin.mutate({
                    id: item.id,
                    origin: item.origin === "campanha_niver" ? null : "campanha_niver",
                  })
                }
                className={
                  item.origin === "campanha_niver"
                    ? "mt-1.5 flex items-center gap-1 rounded-lg bg-gold/20 px-2.5 py-1 text-[11px] font-semibold text-gold"
                    : "mt-1.5 flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                }
              >
                <Gift className="h-3 w-3" />
                {item.origin === "campanha_niver"
                  ? "Veio da Campanha Niver ✓"
                  : "Marcar como Campanha Niver"}
              </button>
            </div>
          ))}
          {(appointments ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>
          )}
        </TabsContent>

        <TabsContent value="retornos" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Mensagens de retorno do dia. Escolha um tipo para liberar o calendário e ver outras
            datas.
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setReturnFilter("todos")}
              className={
                returnFilter === "todos"
                  ? "rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                  : "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
              }
            >
              Todos (hoje)
            </button>
            {returnTypes.map((type) => (
              <button
                key={type}
                onClick={() => setReturnFilter(type)}
                className={
                  returnFilter === type
                    ? "rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                    : "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                }
              >
                {returnTypeLabels[type]}
              </button>
            ))}
          </div>

          {returnFilter !== "todos" && (
            <div className="rounded-2xl bg-card p-2 shadow-card">
              <Calendar
                mode="single"
                selected={returnDate}
                onSelect={(date) => date && setReturnDate(date)}
                className="mx-auto"
              />
            </div>
          )}

          <ul className="space-y-2">
            {filteredReturns.map((item) => {
              const client = item.ownerId ? profileById.get(item.ownerId) : undefined;
              const message = `Olá${client?.full_name ? `, ${client.full_name}` : ""}! Aqui é do ${CLINIC.name}. Passando para lembrar: ${item.title} do seu pet ${item.petName}, previsto para ${formatDate(item.dueDate)}. Podemos agendar?`;
              const link = whatsappLinkTo(client?.phone, message);
              return (
                <li key={item.key} className="rounded-2xl bg-card p-3 shadow-card">
                  <div className="min-w-0">
                    <Badge variant="outline" className="mb-1 text-[10px]">
                      {returnTypeLabels[item.type]}
                    </Badge>
                    <p className="truncate text-sm font-semibold">
                      <Syringe className="mr-1 inline h-3.5 w-3.5 text-primary" />
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.petName} · {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Enviar lembrete no WhatsApp
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Cliente sem telefone cadastrado
                      </span>
                    )}
                    {item.reminderId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => completeReturnReminder.mutate(item.reminderId!)}
                      >
                        Concluir
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
            {filteredReturns.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhum retorno para esse filtro/data.
              </li>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4 space-y-2">
          {(orders ?? []).map((order) => (
            <div key={order.id} className="rounded-2xl bg-card p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{order.customer_name ?? "Cliente"}</p>
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
