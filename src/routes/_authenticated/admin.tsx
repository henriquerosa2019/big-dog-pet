import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Gift,
  MessageCircle,
  Pencil,
  Search,
  Syringe,
  Truck,
  X,
} from "lucide-react";
import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import {
  appointmentStatusTone,
  capitalizeWords,
  CLINIC,
  daysUntil,
  digitsOnly,
  formatBRL,
  formatDate,
  formatDateTime,
  BIRTHDAY_DISCOUNT_PERCENT,
  formatPetAge,
  isBirthdayToday,
  isBirthdayTomorrow,
  maskPhoneBR,
  orderStatusTone,
  statusToneClass,
  whatsappLinkTo,
  AVISO_AUTOMATICO_WHATSAPP,
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
import { TransportHistoryList } from "@/components/TransportHistoryList";
import { DriverLiveMap } from "@/components/DriverLiveMap";
import { ReportPreview } from "@/components/ReportPreview";
import { CurvaAbcProdutos } from "@/components/CurvaAbcProdutos";
import { CurvaAbcServicos } from "@/components/CurvaAbcServicos";
import { CurvaAbcClientes } from "@/components/CurvaAbcClientes";
import { useClientAbcMap } from "@/hooks/useClientAbcMap";
import {
  CatalogForm,
  emptyCatalogValues,
  type CatalogKind,
  type CatalogValues,
} from "@/components/CatalogEditor";
import {
  buildReportData,
  exportReportPDF,
  exportReportXLSX,
  resolveReportRange,
  type ReportData,
  type ReportPeriod,
  type ReportRange,
} from "@/lib/reports";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import {
  CLOSING_OPS_STATUS,
  isServiceExecuted,
  isVehicleAllowedForPet,
  logisticsTypeLabels,
  nextOpsStatus,
  opsStatusLabels,
  opsStatusOrder,
  opsStatusTimestampColumn,
  opsStatusTone,
  opsStatusTutorMessage,
  petSizeLabels,
  vehicleTypeLabels,
  type LogisticsType,
  type OpsStatus,
  type PetSize,
  type VehicleType,
} from "@/lib/transport";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo | Big Dog Pet" },
      {
        name: "description",
        content:
          "Gerencie agendamentos, pedidos, serviços e produtos do Big Dog Pet.",
      },
      { property: "og:title", content: "Painel administrativo | Big Dog Pet" },
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
  const { getClientAbcInfo } = useClientAbcMap();

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
          "id, user_id, total_cents, status, created_at, customer_name, phone, order_items(product_name, quantity)",
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
        .select(
          "id, full_name, phone, birth_date, email, cpf, vehicle_type, created_at, last_birthday_message_sent_at",
        );
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
        vehicle_type: string | null;
        last_birthday_message_sent_at: string | null;
      }
    >();
    for (const p of profiles ?? [])
      map.set(p.id, {
        full_name: p.full_name,
        phone: p.phone,
        birth_date: p.birth_date,
        email: p.email,
        vehicle_type: p.vehicle_type,
        last_birthday_message_sent_at: p.last_birthday_message_sent_at,
      });
    return map;
  }, [profiles]);

  // "Enviado hoje" pra campanha de aniversário — data local, não UTC, senão
  // um envio às 21h vira "de ontem" pro fuso de Brasília antes da meia-noite
  // UTC virar o dia.
  function isSentToday(value: string | null | undefined): boolean {
    if (!value) return false;
    const sent = new Date(value);
    const now = new Date();
    return (
      sent.getFullYear() === now.getFullYear() &&
      sent.getMonth() === now.getMonth() &&
      sent.getDate() === now.getDate()
    );
  }

  const { data: services } = useQuery({
    queryKey: ["admin-services"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, category, price_cents, duration_min, active")
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
        .select("id, name, description, category, price_cents, stock, active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: transportOrders } = useQuery({
    queryKey: ["admin-transport-orders"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(
          "id, code, appointment_id, driver_id, price_cents, assigned_at, en_route_pickup_at, picked_up_at, arrived_shop_at, en_route_return_at, delivered_at, pickup_notes, return_notes, pickup_condition, return_condition, tutor_confirmed_at, appointments(user_id, pet_id, scheduled_at, status, ops_status, logistics_type, notes, service_price_cents, services(name), pets(name, size)), addresses(label, street, number, complement, district, reference), delivery_zones(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Atualiza o painel ao vivo quando o motorista muda o status pelo celular
  // (ex.: "a caminho da retirada") — antes só atualizava ao recarregar a
  // página ou trocar de aba. Mesmo padrão do /conta (pedido do Henrique
  // 2026-08-29), só que sem filtro de usuário: o admin acompanha todo mundo,
  // então escuta appointments e transport_orders inteiros.
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-transport-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transport_orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);

  const { data: driverRoles } = useQuery({
    queryKey: ["admin-drivers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorista");
      if (error) throw error;
      return data;
    },
  });

  const { data: zones } = useQuery({
    queryKey: ["admin-delivery-zones"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("id, name, districts, price_cents, free_above_cents, eta_minutes, active, notes")
        .order("price_cents");
      if (error) throw error;
      return data;
    },
  });

  const { data: transportSettings } = useQuery({
    queryKey: ["admin-transport-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: coupons } = useQuery({
    queryKey: ["admin-transport-coupons"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateTransportSettings = useMutation({
    mutationFn: async (percent: number | null) => {
      const { error } = await supabase
        .from("transport_settings")
        .update({ returning_client_discount_percent: percent })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transport-settings"] });
      toast.success("Desconto de cliente recorrente atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar o desconto"),
  });

  const createCoupon = useMutation({
    mutationFn: async (input: {
      code: string;
      discountType: "percent" | "fixed";
      discountValue: number;
    }) => {
      const { error } = await supabase.from("transport_coupons").insert({
        code: input.code.trim().toUpperCase(),
        discount_type: input.discountType,
        discount_value: input.discountValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transport-coupons"] });
      toast.success("Cupom criado");
    },
    onError: () => toast.error("Não foi possível criar o cupom (código já existe?)"),
  });

  const toggleCoupon = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("transport_coupons")
        .update({ active: vars.active })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-transport-coupons"] }),
    onError: () => toast.error("Não foi possível atualizar o cupom"),
  });

  const drivers = useMemo(
    () =>
      (driverRoles ?? []).map((r) => ({
        id: r.user_id,
        full_name: profileById.get(r.user_id)?.full_name ?? null,
        phone: profileById.get(r.user_id)?.phone ?? null,
        vehicle_type: profileById.get(r.user_id)?.vehicle_type ?? null,
      })),
    [driverRoles, profileById],
  );

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
        .select(
          "id, scheduled_at, status, ops_status, origin, service_price_cents, services(category, name), pets(name)",
        )
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

    // Receita de produtos = pedido efetivamente entregue. "novo"/"em_preparo"
    // ainda nao viraram dinheiro no caixa, entao aparecem separados como
    // "em aberto" em vez de inflar o faturamento do periodo.
    const deliveredOrders = (dashOrders ?? []).filter((o) => o.status === "entregue");
    const openOrders = (dashOrders ?? []).filter((o) => o.status !== "entregue");
    const orderCounts = bucketCounts(deliveredOrders, (o) => o.created_at);
    function sumOrders(rows: typeof deliveredOrders, since: Date) {
      return rows
        .filter((o) => new Date(o.created_at) >= since)
        .reduce((sum, o) => sum + o.total_cents, 0);
    }
    const orderRevenue = {
      day: sumOrders(deliveredOrders, dayStart),
      week: sumOrders(deliveredOrders, weekStart),
      month: sumOrders(deliveredOrders, monthStart),
    };
    const orderOpenRevenue = {
      day: sumOrders(openOrders, dayStart),
      week: sumOrders(openOrders, weekStart),
      month: sumOrders(openOrders, monthStart),
    };

    const executedAppointments = (dashAppointments ?? []).filter(isServiceExecuted);
    const serviceCounts = bucketCounts(executedAppointments, (a) => a.scheduled_at);
    function sumServiceRevenue(since: Date) {
      return executedAppointments
        .filter((a) => new Date(a.scheduled_at) >= since)
        .reduce((sum, a) => sum + (a.service_price_cents ?? 0), 0);
    }
    const serviceRevenue = {
      day: sumServiceRevenue(dayStart),
      week: sumServiceRevenue(weekStart),
      month: sumServiceRevenue(monthStart),
    };
    const openAppointments = (dashAppointments ?? []).filter((a) => !isServiceExecuted(a));
    function sumOpenServiceRevenue(since: Date) {
      return openAppointments
        .filter((a) => new Date(a.scheduled_at) >= since)
        .reduce((sum, a) => sum + (a.service_price_cents ?? 0), 0);
    }
    const serviceOpenRevenue = {
      day: sumOpenServiceRevenue(dayStart),
      week: sumOpenServiceRevenue(weekStart),
      month: sumOpenServiceRevenue(monthStart),
    };
    const executedToday = executedAppointments
      .filter((a) => new Date(a.scheduled_at) >= dayStart)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    const newClients = bucketCounts(dashProfiles ?? [], (p) => p.created_at);

    const campaignAppointments = (dashAppointments ?? []).filter(
      (a) => a.origin === "campanha_niver",
    );
    const campaignNiver = bucketCounts(campaignAppointments, (a) => a.scheduled_at);

    return {
      apptByCategory,
      apptTotal,
      orderCounts,
      orderRevenue,
      orderOpenRevenue,
      serviceCounts,
      serviceRevenue,
      serviceOpenRevenue,
      executedToday,
      newClients,
      campaignNiver,
    };
  }, [dashAppointments, dashOrders, dashProfiles, dashboardBoundaries]);

  // Sugestoes de categoria vindas do que ja esta cadastrado, pra loja reaproveitar
  // os nomes em vez de inventar variacoes ("banho" x "Banho").
  const serviceCategoryOptions = useMemo(
    () =>
      Array.from(new Set([...serviceCategories, ...(services ?? []).map((x) => x.category)])).sort(),
    [services],
  );
  const productCategoryOptions = useMemo(
    () => Array.from(new Set((products ?? []).map((x) => x.category))).sort(),
    [products],
  );

  const pendingAppointments = useMemo(() => {
    return (appointments ?? [])
      .filter((a) => a.status === "pendente")
      .sort((a, b) => {
        const infoA = getClientAbcInfo(a.user_id);
        const infoB = getClientAbcInfo(b.user_id);
        const score = (cls?: string) => (cls === "A" ? 3 : cls === "B" ? 2 : 1);
        const diff = score(infoB?.abcClass) - score(infoA?.abcClass);
        if (diff !== 0) return diff;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
  }, [appointments, getClientAbcInfo]);

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
        toast.error("Esse e-mail já tem conta cadastrada no Big Dog Pet.");
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
        redirectTo: `${window.location.origin}/redefinir-senha`,
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
      const link = AVISO_AUTOMATICO_WHATSAPP ? whatsappLinkTo(client?.phone, message) : null;
      if (!AVISO_AUTOMATICO_WHATSAPP) {
        toast.success("Agendamento confirmado.");
      } else if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
        toast.success("Agendamento confirmado! Envie a mensagem no WhatsApp que abriu.");
      } else {
        toast.error("Agendamento confirmado, mas o cliente n\u00e3o tem telefone cadastrado.");
      }
    },
    onError: () => toast.error("N\u00e3o foi poss\u00edvel confirmar"),
  });

  // Advances an appointment's ops_status by one step (or to an explicitly picked
  // status), stamps the matching transport_orders timestamp column when there is
  // one, and writes a pet_status_history row — the audit trail for "segurança na
  // retirada". For the transitions that matter to the tutor, also opens a
  // WhatsApp link, mirroring confirmAppointment's "advance + notify" pattern.
  const advanceOpsStatus = useMutation({
    mutationFn: async (vars: {
      appointmentId: string;
      transportOrderId: string;
      status: OpsStatus;
      userId: string;
      petName?: string | null;
    }) => {
      const { error: apptError } = await supabase
        .from("appointments")
        .update({
          ops_status: vars.status,
          ...(CLOSING_OPS_STATUS.includes(vars.status) ? { status: "concluido" } : {}),
        })
        .eq("id", vars.appointmentId);
      if (apptError) throw apptError;

      const timestampColumn = opsStatusTimestampColumn[vars.status];
      if (timestampColumn) {
        const { error: transportError } = await supabase
          .from("transport_orders")
          .update({
            [timestampColumn]: new Date().toISOString(),
          } as TablesUpdate<"transport_orders">)
          .eq("id", vars.transportOrderId);
        if (transportError) throw transportError;
      }

      const { error: historyError } = await supabase.from("pet_status_history").insert({
        appointment_id: vars.appointmentId,
        status: vars.status,
        created_by: user!.id,
      });
      if (historyError) throw historyError;

      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      toast.success("Status atualizado");
      const notifyOn: OpsStatus[] = ["em_deslocamento_retirada", "pet_retirado", "pet_entregue"];
      if (AVISO_AUTOMATICO_WHATSAPP && notifyOn.includes(vars.status)) {
        const client = profileById.get(vars.userId);
        const message = `Olá${client?.full_name ? `, ${client.full_name}` : ""}! ${opsStatusTutorMessage[vars.status]}${vars.petName ? ` (${vars.petName})` : ""}`;
        const link = whatsappLinkTo(client?.phone, message);
        if (link) window.open(link, "_blank", "noopener,noreferrer");
      }
    },
    onError: () => toast.error("Não foi possível atualizar o status"),
  });

  const assignDriver = useMutation({
    mutationFn: async (vars: {
      transportOrderId: string;
      appointmentId: string;
      driverId: string;
      currentStatus: string;
      userId: string;
      petName?: string | null;
    }) => {
      const { error: transportError } = await supabase
        .from("transport_orders")
        .update({ driver_id: vars.driverId, assigned_at: new Date().toISOString() })
        .eq("id", vars.transportOrderId);
      if (transportError) throw transportError;

      if (vars.currentStatus === "agendado") {
        const { error: apptError } = await supabase
          .from("appointments")
          .update({ ops_status: "motorista_designado" })
          .eq("id", vars.appointmentId);
        if (apptError) throw apptError;
        await supabase.from("pet_status_history").insert({
          appointment_id: vars.appointmentId,
          status: "motorista_designado",
          created_by: user!.id,
        });
      }
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      toast.success("Motorista designado");
      if (!AVISO_AUTOMATICO_WHATSAPP) return;
      const client = profileById.get(vars.userId);
      const driver = profileById.get(vars.driverId);
      const message = `Olá${client?.full_name ? `, ${client.full_name}` : ""}! O motorista ${driver?.full_name ?? ""} foi designado para buscar${vars.petName ? ` ${vars.petName}` : " seu pet"}.`;
      const link = whatsappLinkTo(client?.phone, message);
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    },
    onError: () => toast.error("Não foi possível designar o motorista"),
  });

  const updateTransportPrice = useMutation({
    mutationFn: async (vars: {
      transportOrderId: string;
      appointmentId: string;
      priceCents: number;
      servicePriceCents: number;
    }) => {
      const { error: transportError } = await supabase
        .from("transport_orders")
        .update({ price_cents: vars.priceCents })
        .eq("id", vars.transportOrderId);
      if (transportError) throw transportError;
      const { error: apptError } = await supabase
        .from("appointments")
        .update({
          transport_price_cents: vars.priceCents,
          total_cents: vars.servicePriceCents + vars.priceCents,
        })
        .eq("id", vars.appointmentId);
      if (apptError) throw apptError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      toast.success("Valor atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar o valor"),
  });

  const updateZone = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<{ price_cents: number; free_above_cents: number | null; active: boolean }>;
    }) => {
      const { error } = await supabase.from("delivery_zones").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
      toast.success("Zona atualizada");
    },
    onError: () => toast.error("Não foi possível atualizar a zona"),
  });

  const updateDriverVehicle = useMutation({
    mutationFn: async (vars: { driverId: string; vehicleType: VehicleType }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ vehicle_type: vars.vehicleType })
        .eq("id", vars.driverId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("Veículo do motorista atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar o veículo"),
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

  // Marca a campanha de aniversário como "enviada hoje" pra esse tutor,
  // pra evitar que outro admin (ou o mesmo, sem perceber) mande a mensagem
  // de novo no mesmo dia. É best-effort: se falhar, não bloqueia o envio do
  // WhatsApp, que já abriu numa aba separada antes desse mutate.
  const markBirthdayMessageSent = useMutation({
    mutationFn: async (ownerId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ last_birthday_message_sent_at: new Date().toISOString() })
        .eq("id", ownerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
  });

  // --- Aba "Clientes": edição inline (lápis) de tutor e pet, e busca ---
  const [clientSearch, setClientSearch] = useState("");
  const [editingDirectoryClientId, setEditingDirectoryClientId] = useState<string | null>(null);
  const [directoryClientForm, setDirectoryClientForm] = useState({
    fullName: "",
    phone: "",
    birthDate: "",
  });
  const [editingDirectoryPetId, setEditingDirectoryPetId] = useState<string | null>(null);
  const [directoryPetForm, setDirectoryPetForm] = useState({ name: "", breed: "" });

  const updateDirectoryClient = useMutation({
    mutationFn: async () => {
      if (!editingDirectoryClientId) throw new Error("Nenhum cliente selecionado");
      const client = editClientSchema.parse(directoryClientForm);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: client.fullName,
          phone: client.phone,
          birth_date: client.birthDate || null,
        })
        .eq("id", editingDirectoryClientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("Cliente atualizado");
      setEditingDirectoryClientId(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof z.ZodError ? error.issues[0]!.message : "Não foi possível atualizar",
      );
    },
  });

  const updateDirectoryPet = useMutation({
    mutationFn: async () => {
      if (!editingDirectoryPetId) throw new Error("Nenhum pet selecionado");
      const name = directoryPetForm.name.trim();
      if (name.length < 2) throw new Error("Informe o nome do pet");
      const { error } = await supabase
        .from("pets")
        .update({ name, breed: directoryPetForm.breed.trim() || null })
        .eq("id", editingDirectoryPetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pets"] });
      toast.success("Pet atualizado");
      setEditingDirectoryPetId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pet");
    },
  });

  // --- Aba "Relatórios": geração de Excel/PDF de vendas + serviços ---
  const [reportSubTab, setReportSubTab] = useState<"financeiro" | "abc-produtos" | "abc-servicos" | "abc-clientes">("financeiro");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("mes");
  const [reportFrom, setReportFrom] = useState(todayISODate());
  const [reportTo, setReportTo] = useState(todayISODate());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportRange, setReportRange] = useState<ReportRange | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date | null>(null);
  const [creatingCatalog, setCreatingCatalog] = useState<CatalogKind | null>(null);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [showReportPreview, setShowReportPreview] = useState(false);

  async function generateReport() {
    setReportLoading(true);
    try {
      const range = resolveReportRange(reportPeriod, reportFrom, reportTo);
      const [{ data: apptRows, error: apptError }, { data: orderRows, error: orderError }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select(
              "id, scheduled_at, status, ops_status, origin, user_id, service_price_cents, transport_price_cents, logistics_type, services(name), pets(name)",
            )
            .gte("scheduled_at", range.start.toISOString())
            .lte("scheduled_at", range.end.toISOString()),
          supabase
            .from("orders")
            .select("id, created_at, status, customer_name, order_items(product_name, quantity, unit_price_cents)")
            .gte("created_at", range.start.toISOString())
            .lte("created_at", range.end.toISOString()),
        ]);
      if (apptError) throw apptError;
      if (orderError) throw orderError;

      const clientNameById = new Map<string, string | null>();
      for (const p of profiles ?? []) {
        clientNameById.set(p.id, p.full_name ? capitalizeWords(p.full_name) : null);
      }

      const data = buildReportData(apptRows ?? [], orderRows ?? [], clientNameById);
      setReportData(data);
      setReportRange(range);
      setReportGeneratedAt(new Date());
      setShowReportPreview(false);
      toast.success("Relatório gerado");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível gerar o relatório");
    } finally {
      setReportLoading(false);
    }
  }

  const updateCatalog = useMutation({
    mutationFn: async ({
      table,
      id,
      values,
    }: {
      table: CatalogKind;
      id: string;
      values: {
        name?: string | undefined;
        description?: string | null | undefined;
        category?: string | undefined;
        price_cents?: number | undefined;
        duration_min?: number | undefined;
        stock?: number | undefined;
        active?: boolean | undefined;
      };
    }) => {
      // Tira as chaves nao informadas: `duration_min` so existe em services e
      // `stock` so em products, e o update tipado recusa chave estranha.
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== undefined),
      );
      const { error } =
        table === "services"
          ? await supabase
              .from("services")
              .update(payload as TablesUpdate<"services">)
              .eq("id", id)
          : await supabase
              .from("products")
              .update(payload as TablesUpdate<"products">)
              .eq("id", id);
      if (error) throw error;
    },

    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [`admin-${vars.table}`] });
      queryClient.invalidateQueries({ queryKey: [vars.table] });
      toast.success("Catálogo atualizado");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const createCatalog = useMutation({
    mutationFn: async ({ table, values }: { table: CatalogKind; values: CatalogValues }) => {
      const common = {
        name: values.name,
        description: values.description || null,
        category: values.category,
        price_cents: values.priceCents,
        active: values.active,
      };
      const { error } =
        table === "services"
          ? await supabase.from("services").insert({ ...common, duration_min: values.durationMin })
          : await supabase.from("products").insert({ ...common, stock: values.stock });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [`admin-${vars.table}`] });
      queryClient.invalidateQueries({ queryKey: [vars.table] });
      setCreatingCatalog(null);
      toast.success(vars.table === "services" ? "Serviço criado" : "Produto criado");
    },
    onError: () => toast.error("Não foi possível criar"),
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

  // Diretório usado na aba "Clientes": tutor + pets, filtrável por nome,
  // telefone, CPF ou nome do pet.
  const clientDirectory = useMemo(() => {
    const petsByOwner = new Map<string, NonNullable<typeof allPets>>();
    for (const pet of allPets ?? []) {
      if (!pet.owner_id) continue;
      const list = petsByOwner.get(pet.owner_id) ?? [];
      list.push(pet);
      petsByOwner.set(pet.owner_id, list);
    }
    const term = clientSearch.trim().toLowerCase();
    const termDigits = digitsOnly(clientSearch);
    return (profiles ?? [])
      .map((p) => ({ ...p, pets: petsByOwner.get(p.id) ?? [] }))
      .filter((client) => {
        if (!term) return true;
        const nameMatch = (client.full_name ?? "").toLowerCase().includes(term);
        const phoneMatch = termDigits.length >= 3 && digitsOnly(client.phone ?? "").includes(termDigits);
        const cpfMatch = termDigits.length >= 3 && digitsOnly(client.cpf ?? "").includes(termDigits);
        const petMatch = client.pets.some((pet) => pet.name.toLowerCase().includes(term));
        return nameMatch || phoneMatch || cpfMatch || petMatch;
      })
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [profiles, allPets, clientSearch]);

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
      lastBirthdayMessageSentAt: string | null;
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
          ownerName: p.full_name ? capitalizeWords(p.full_name) : "Cliente",
          phone: p.phone,
          lastBirthdayMessageSentAt: p.last_birthday_message_sent_at,
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
          ownerName: owner?.full_name ? capitalizeWords(owner.full_name) : "Cliente",
          phone: owner?.phone ?? null,
          petName: capitalizeWords(pet.name),
          petAge: formatPetAge(pet.birth_date),
          lastBirthdayMessageSentAt: owner?.last_birthday_message_sent_at ?? null,
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
          Esta área é exclusiva da equipe do Big Dog Pet.
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
          <TabsTrigger value="clientes" className="shrink-0">
            Clientes
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="shrink-0">
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="agenda" className="shrink-0">
            Agendamentos
          </TabsTrigger>
          <TabsTrigger value="retirada-entrega" className="shrink-0">
            Retirada/Entrega
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

        <TabsContent
          value="dashboard"
          className="mt-4 space-y-3 md:columns-2 md:gap-3 md:space-y-0 md:[&>div]:mb-3 md:[&>div]:break-inside-avoid"
        >
          {pendingAppointments.length > 0 ? (
            <div className="rounded-2xl border-2 border-primary/40 bg-secondary p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novos agendamentos ({pendingAppointments.length})
              </p>
              <div className="mt-2 space-y-2">
                {pendingAppointments.slice(0, 6).map((item) => {
                  const clientInfo = getClientAbcInfo(item.user_id);
                  const clientName = profileById.get(item.user_id)?.full_name || clientInfo?.name || "Cliente";
                  const clientPhone = profileById.get(item.user_id)?.phone || clientInfo?.phone;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl bg-card p-3 shadow-card transition-all relative overflow-hidden",
                        clientInfo?.abcClass === "A"
                          ? "border-2 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/20"
                          : clientInfo?.abcClass === "B"
                          ? "border-2 border-blue-500/50"
                          : "border border-border/40",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-bold text-foreground truncate">{clientName}</p>
                            {clientInfo && (
                              <Badge className={cn("text-[10px] font-bold px-1.5 py-0.2", clientInfo.suggestion.badgeClass)}>
                                {clientInfo.suggestion.badgeLabel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-primary mt-0.5">
                            {item.services?.name ?? "Serviço"}
                            {item.pets?.name ? ` · 🐾 ${item.pets.name}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateTime(item.scheduled_at)}
                            {clientPhone ? ` · 📞 ${clientPhone}` : ""}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <Badge variant="secondary" className="capitalize text-[11px]">
                            {item.status}
                          </Badge>
                          {clientInfo && clientInfo.ltvCents > 0 && (
                            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                              LTV: {formatBRL(clientInfo.ltvCents)} ({clientInfo.visitsCount} visitas)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Box de Ação Proposta de acordo com o Volume de Negócios */}
                      {clientInfo && (
                        <div
                          className={cn(
                            "mt-2.5 rounded-xl p-2.5 text-xs space-y-1.5",
                            clientInfo.abcClass === "A"
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                              : clientInfo.abcClass === "B"
                              ? "bg-blue-500/10 border border-blue-500/30 text-blue-950 dark:text-blue-100"
                              : "bg-secondary/40 border border-border/40 text-muted-foreground",
                          )}
                        >
                          <div className="flex items-center justify-between font-bold text-[11px]">
                            <span>{clientInfo.suggestion.title}</span>
                            <span className="font-extrabold text-primary">{clientInfo.suggestion.suggestedOffer}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            {clientInfo.suggestion.actionSummary}
                          </p>

                          {clientPhone && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "mt-1 h-8 w-full rounded-lg text-xs font-bold gap-1.5 transition-colors",
                                clientInfo.abcClass === "A"
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-sm"
                                  : clientInfo.abcClass === "B"
                                  ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm"
                                  : "hover:bg-secondary",
                              )}
                              onClick={() => {
                                const petName = item.pets?.name ?? undefined;
                                const msg = clientInfo.suggestion.whatsappMessageTemplate(clientName, petName);
                                const link = whatsappLinkTo(clientPhone, msg);
                                if (link) window.open(link, "_blank", "noopener,noreferrer");
                              }}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Confirmar c/ Oferta Especial no WhatsApp
                            </Button>
                          )}
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant={clientInfo?.abcClass === "A" ? "secondary" : "default"}
                        className="mt-2 h-9 w-full rounded-xl text-xs"
                        disabled={confirmAppointment.isPending}
                        onClick={() => confirmAppointment.mutate(item)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Confirmar e avisar no WhatsApp (Padrão)
                      </Button>
                    </div>
                  );
                })}
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
                      ? `Feliz aniversário para ${entry.petName}! 🎉🐾 Para comemorar, o ${CLINIC.name} preparou ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho ou tosa hoje. Quer aproveitar e já agendar?`
                      : `Feliz aniversário, ${entry.ownerName}! 🎉 Para comemorar, o ${CLINIC.name} preparou ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho ou tosa para o seu pet hoje. Quer aproveitar e já agendar?`
                    : entry.kind === "pet"
                      ? `Oi! Passando pra avisar que amanhã é aniversário do(a) ${entry.petName} 🎉🐾 Já vamos preparar ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho ou tosa pra comemorar — quer garantir o horário?`
                      : `Oi, ${entry.ownerName}! Amanhã é seu aniversário 🎉 Já vamos preparar ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho ou tosa pro seu pet pra comemorar — quer garantir o horário?`;
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
                      {isSentToday(entry.lastBirthdayMessageSentAt) && (
                        <p className="mt-1.5 text-[11px] font-semibold text-primary">
                          ✓ Mensagem já enviada hoje
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 h-9 w-full rounded-xl"
                        disabled={!link}
                        onClick={() => {
                          if (!link) return;
                          window.open(link, "_blank", "noopener,noreferrer");
                          markBirthdayMessageSent.mutate(entry.ownerId);
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {link
                          ? isToday
                            ? isSentToday(entry.lastBirthdayMessageSentAt)
                              ? "Enviar de novo pelo WhatsApp"
                              : "Enviar parabéns + oferta no WhatsApp"
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
              Serviços executados
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ["Hoje", dashboardStats.serviceCounts.day, dashboardStats.serviceRevenue.day],
                  ["Semana", dashboardStats.serviceCounts.week, dashboardStats.serviceRevenue.week],
                  ["Mês", dashboardStats.serviceCounts.month, dashboardStats.serviceRevenue.month],
                ] as const
              ).map(([label, count, cents]) => (
                <div key={label} className="rounded-xl surface-paper p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="font-display text-lg text-primary">{formatBRL(cents)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {count} serviço{count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Executados hoje ({dashboardStats.executedToday.length})
            </p>
            {dashboardStats.executedToday.length > 0 ? (
              <ul className="mt-1.5 space-y-1.5">
                {dashboardStats.executedToday.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-xl surface-paper p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {item.services?.name ?? "Serviço"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {formatDateTime(item.scheduled_at)}
                        {item.pets?.name ? ` · ${item.pets.name}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-primary">
                      {formatBRL(item.service_price_cents ?? 0)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Nenhum serviço concluído hoje ainda.
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Só entra aqui o que já foi executado: agendamento marcado como concluído ou que já
              passou do atendimento no transporte. Ainda em aberto no mês:{" "}
              {formatBRL(dashboardStats.serviceOpenRevenue.month)}. Não inclui a taxa de transporte.
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
            <p className="mt-2 text-[11px] text-muted-foreground">
              Só conta pedidos já entregues. Ainda em aberto no mês (novos e em preparo):{" "}
              {formatBRL(dashboardStats.orderOpenRevenue.month)}.
            </p>
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
              <p className="text-sm font-semibold">Esse e-mail já tem conta no Big Dog Pet</p>
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

        <TabsContent value="clientes" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF ou nome do pet"
              className="h-11 rounded-2xl pl-9"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {clientDirectory.length} cliente{clientDirectory.length === 1 ? "" : "s"}
          </p>

          <div className="space-y-2">
            {clientDirectory.map((client) => {
              const editingThis = editingDirectoryClientId === client.id;
              return (
                <div key={client.id} className="rounded-2xl bg-card p-3 shadow-card">
                  {editingThis ? (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor={`dc-name-${client.id}`}>Nome completo</Label>
                        <Input
                          id={`dc-name-${client.id}`}
                          value={directoryClientForm.fullName}
                          maxLength={100}
                          onChange={(e) =>
                            setDirectoryClientForm({
                              ...directoryClientForm,
                              fullName: e.target.value,
                            })
                          }
                          className="mt-1 h-10 rounded-xl"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`dc-phone-${client.id}`}>Telefone</Label>
                        <Input
                          id={`dc-phone-${client.id}`}
                          inputMode="tel"
                          value={directoryClientForm.phone}
                          maxLength={16}
                          onChange={(e) =>
                            setDirectoryClientForm({
                              ...directoryClientForm,
                              phone: maskPhoneBR(e.target.value),
                            })
                          }
                          className="mt-1 h-10 rounded-xl"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`dc-birth-${client.id}`}>Aniversário</Label>
                        <Input
                          id={`dc-birth-${client.id}`}
                          type="date"
                          value={directoryClientForm.birthDate}
                          onChange={(e) =>
                            setDirectoryClientForm({
                              ...directoryClientForm,
                              birthDate: e.target.value,
                            })
                          }
                          className="mt-1 h-10 rounded-xl"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-9 flex-1 rounded-xl"
                          disabled={updateDirectoryClient.isPending}
                          onClick={() => updateDirectoryClient.mutate()}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 rounded-xl"
                          onClick={() => setEditingDirectoryClientId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {client.full_name ? capitalizeWords(client.full_name) : "Sem nome"}
                        </p>
                        {client.phone ? (
                          <p className="text-xs text-muted-foreground">{client.phone}</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDirectoryClientId(client.id);
                              setDirectoryClientForm({
                                fullName: client.full_name ?? "",
                                phone: "",
                                birthDate: client.birth_date ?? "",
                              });
                            }}
                            className="text-xs font-semibold text-primary underline"
                          >
                            + Adicionar telefone
                          </button>
                        )}
                        {client.birth_date && (
                          <p className="text-[11px] text-muted-foreground">
                            Aniversário: {formatDate(client.birth_date)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Editar cliente"
                        onClick={() => {
                          setEditingDirectoryClientId(client.id);
                          setDirectoryClientForm({
                            fullName: client.full_name ?? "",
                            phone: client.phone ?? "",
                            birthDate: client.birth_date ?? "",
                          });
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {client.pets.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                      {client.pets.map((pet) => {
                        const editingPet = editingDirectoryPetId === pet.id;
                        return editingPet ? (
                          <div key={pet.id} className="rounded-xl surface-paper p-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={directoryPetForm.name}
                                maxLength={60}
                                placeholder="Nome do pet"
                                onChange={(e) =>
                                  setDirectoryPetForm({ ...directoryPetForm, name: e.target.value })
                                }
                                className="h-9 rounded-lg text-xs"
                              />
                              <Input
                                value={directoryPetForm.breed}
                                maxLength={60}
                                placeholder="Raça"
                                onChange={(e) =>
                                  setDirectoryPetForm({
                                    ...directoryPetForm,
                                    breed: e.target.value,
                                  })
                                }
                                className="h-9 rounded-lg text-xs"
                              />
                            </div>
                            <div className="mt-1.5 flex gap-2">
                              <Button
                                size="sm"
                                className="h-8 flex-1 rounded-lg text-xs"
                                disabled={updateDirectoryPet.isPending}
                                onClick={() => updateDirectoryPet.mutate()}
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 rounded-lg"
                                onClick={() => setEditingDirectoryPetId(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={pet.id}
                            className="flex items-center justify-between gap-2 rounded-xl surface-paper px-2.5 py-1.5 text-xs"
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{capitalizeWords(pet.name)}</span>
                              {pet.breed && (
                                <span className="text-muted-foreground"> · {pet.breed}</span>
                              )}
                              {pet.birth_date && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {formatDate(pet.birth_date)}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              aria-label={`Editar ${pet.name}`}
                              onClick={() => {
                                setEditingDirectoryPetId(pet.id);
                                setDirectoryPetForm({ name: pet.name, breed: pet.breed ?? "" });
                              }}
                              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {clientDirectory.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-4 space-y-3">
          {/* Sub-abas de Relatórios */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setReportSubTab("financeiro")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                reportSubTab === "financeiro"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              📊 Financeiro Geral
            </button>
            <button
              type="button"
              onClick={() => setReportSubTab("abc-produtos")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                reportSubTab === "abc-produtos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              📦 Curva ABC - Produtos
            </button>
            <button
              type="button"
              onClick={() => setReportSubTab("abc-servicos")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                reportSubTab === "abc-servicos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              ✂️ Curva ABC - Serviços
            </button>
            <button
              type="button"
              onClick={() => setReportSubTab("abc-clientes")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                reportSubTab === "abc-clientes"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              👥 Curva ABC - Clientes
            </button>
          </div>

          {reportSubTab === "financeiro" && (
            <>
              <div className="rounded-2xl bg-card p-3 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Relatório financeiro
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Serviços, produtos e taxas de retirada/entrega do período, prontos pra exportar.
                </p>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {(
                [
                  ["hoje", "Hoje"],
                  ["semana", "Semana"],
                  ["mes", "Mês"],
                  ["personalizado", "Personal."],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReportPeriod(value)}
                  className={cn(
                    "rounded-xl px-2 py-2 text-[11px] font-semibold",
                    reportPeriod === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {reportPeriod === "personalizado" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="report-from">De</Label>
                  <Input
                    id="report-from"
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="report-to">Até</Label>
                  <Input
                    id="report-to"
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
              </div>
            )}

            <Button
              className="mt-3 h-11 w-full rounded-2xl"
              disabled={reportLoading}
              onClick={() => void generateReport()}
            >
              {reportLoading ? "Gerando..." : "Gerar relatório"}
            </Button>
          </div>

          {reportData && reportRange && (
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {reportRange.label}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded-xl surface-paper p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">Serviços</p>
                  <p className="font-display text-sm text-primary">
                    {formatBRL(reportData.totals.servicesCents)}
                  </p>
                </div>
                <div className="rounded-xl surface-paper p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">Produtos</p>
                  <p className="font-display text-sm text-primary">
                    {formatBRL(reportData.totals.productsCents)}
                  </p>
                </div>
                <div className="rounded-xl surface-paper p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">Transporte</p>
                  <p className="font-display text-sm text-primary">
                    {formatBRL(reportData.totals.transportCents)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                <span className="text-xs font-semibold">Receita bruta realizada</span>
                <span className="font-display text-lg text-primary">
                  {formatBRL(reportData.totals.grossCents)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between rounded-xl surface-paper px-3 py-2">
                <span className="text-[11px] text-muted-foreground">
                  Em aberto (agendado / não entregue)
                </span>
                <span className="text-xs font-semibold">
                  {formatBRL(reportData.open.grossCents)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Campanha Niver: {reportData.campaignNiver.count} de{" "}
                {reportData.campaignNiver.totalServices} agendamentos (
                {reportData.campaignNiver.percent.toFixed(1)}%)
              </p>

              <div className="mt-3 flex justify-center">
                <Button
                  variant="secondary"
                  className="h-11 rounded-xl px-6"
                  onClick={() => setShowReportPreview((v) => !v)}
                >
                  <Eye className="h-4 w-4" />
                  {showReportPreview ? "Ocultar relatório" : "Ver na tela"}
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="h-11 rounded-xl"
                  onClick={() => {
                    try {
                      exportReportXLSX(reportData, reportRange);
                    } catch (err) {
                      console.error(err);
                      toast.error("Não foi possível gerar o Excel.");
                    }
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button
                  variant="secondary"
                  className="h-11 rounded-xl"
                  onClick={() => {
                    try {
                      exportReportPDF(reportData, reportRange);
                    } catch (err) {
                      console.error(err);
                      toast.error("Não foi possível gerar o PDF.");
                    }
                  }}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Receita realizada = serviço concluído (ou transporte já além do atendimento) e
                pedido entregue; o que está agendado ou ainda não foi entregue aparece como “em
                aberto”. Não inclui agendamentos/pedidos cancelados. Canal de origem (App x
                WhatsApp) não é rastreado hoje, por isso não aparece separado no relatório.
              </p>

              {showReportPreview && (
                <ReportPreview
                  data={reportData}
                  range={reportRange}
                  generatedAt={reportGeneratedAt ?? new Date()}
                />
              )}
            </div>
          )}
        </>
      )}

      {reportSubTab === "abc-produtos" && <CurvaAbcProdutos />}

      {reportSubTab === "abc-servicos" && <CurvaAbcServicos />}

      {reportSubTab === "abc-clientes" && <CurvaAbcClientes />}
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

          {(appointments ?? []).map((item) => {
            const clientInfo = getClientAbcInfo(item.user_id);
            const clientName = profileById.get(item.user_id)?.full_name || clientInfo?.name;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl bg-card p-3 shadow-card transition-all",
                  clientInfo?.abcClass === "A"
                    ? "border-2 border-emerald-500/50"
                    : clientInfo?.abcClass === "B"
                    ? "border-2 border-blue-500/40"
                    : "",
                )}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold">{item.services?.name ?? "Serviço"}</p>
                    {clientInfo && (
                      <Badge className={cn("text-[10px] font-bold px-1.5 py-0.2", clientInfo.suggestion.badgeClass)}>
                        {clientInfo.suggestion.badgeLabel}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0 capitalize", statusToneClass(appointmentStatusTone(item.status)))}
                  >
                    {item.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(item.scheduled_at)}
                  {item.pets?.name ? ` · 🐾 ${item.pets.name}` : ""}
                  {clientName ? ` · Tutor(a): ${clientName}` : ""}
                  {clientInfo && clientInfo.ltvCents > 0 ? ` (LTV ${formatBRL(clientInfo.ltvCents)})` : ""}
                </p>
                {clientInfo && (clientInfo.abcClass === "A" || clientInfo.abcClass === "B") && (
                  <p className="mt-1 text-[11px] font-semibold text-primary">
                    💡 Sugestão Comercial: {clientInfo.suggestion.suggestedOffer} · {clientInfo.suggestion.actionSummary}
                  </p>
                )}
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
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                      item.status === status
                        ? cn("bg-primary text-primary-foreground", statusToneClass(appointmentStatusTone(status)))
                        : "bg-secondary text-secondary-foreground",
                    )}
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
          );
        })}
          {(appointments ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>
          )}
        </TabsContent>

        <TabsContent value="retirada-entrega" className="mt-4 space-y-4">
          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Zonas de entrega (preço por bairro)
            </p>
            <div className="mt-2 space-y-2">
              {(zones ?? []).map((zone) => (
                <ZoneRow
                  key={zone.id}
                  name={zone.name}
                  districts={zone.districts}
                  priceCents={zone.price_cents}
                  freeAboveCents={zone.free_above_cents}
                  active={zone.active}
                  onSave={(priceCents, freeAboveCents) =>
                    updateZone.mutate({
                      id: zone.id,
                      values: { price_cents: priceCents, free_above_cents: freeAboveCents },
                    })
                  }
                  onToggle={() =>
                    updateZone.mutate({ id: zone.id, values: { active: !zone.active } })
                  }
                />
              ))}
              {(zones ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma zona cadastrada.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Motoristas e veículos
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Moto só pode ser designada para pets de porte pequeno. Pets médios/grandes exigem
              carro.
            </p>
            <div className="mt-2 space-y-2">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2"
                >
                  <p className="min-w-0 truncate text-xs font-semibold">
                    {driver.full_name ?? driver.phone ?? driver.id.slice(0, 8)}
                  </p>
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
                    {(["moto", "carro"] as VehicleType[]).map((vehicle) => (
                      <button
                        key={vehicle}
                        type="button"
                        disabled={updateDriverVehicle.isPending}
                        onClick={() =>
                          updateDriverVehicle.mutate({ driverId: driver.id, vehicleType: vehicle })
                        }
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-semibold",
                          driver.vehicle_type === vehicle
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground",
                        )}
                      >
                        {vehicleTypeLabels[vehicle]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {drivers.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum motorista cadastrado.</p>
              )}
            </div>
          </div>

          <ReturningClientDiscountEditor
            percent={transportSettings?.returning_client_discount_percent ?? null}
            isPending={updateTransportSettings.isPending}
            onSave={(percent) => updateTransportSettings.mutate(percent)}
          />

          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cupons de desconto
            </p>
            <div className="mt-2 space-y-2">
              {(coupons ?? []).map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{coupon.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {coupon.discount_type === "percent"
                        ? `${coupon.discount_value}% de desconto`
                        : `${formatBRL(coupon.discount_value)} de desconto`}
                      {coupon.expires_at ? ` · expira em ${formatDateTime(coupon.expires_at)}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={coupon.active ? "secondary" : "outline"}
                    className="h-8 shrink-0 rounded-lg text-[11px]"
                    disabled={toggleCoupon.isPending}
                    onClick={() => toggleCoupon.mutate({ id: coupon.id, active: !coupon.active })}
                  >
                    {coupon.active ? "Ativo" : "Inativo"}
                  </Button>
                </div>
              ))}
              {(coupons ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum cupom cadastrado.</p>
              )}
            </div>
            <NewCouponForm
              isPending={createCoupon.isPending}
              onCreate={(input) => createCoupon.mutate(input)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Pedidos de retirada/devolução. Designe um motorista e avance o status conforme o
            andamento. Os avisos automáticos por WhatsApp estão desligados; use “Falar com o
            tutor” quando precisar avisar.
          </p>

          {(transportOrders ?? []).map((item) => {
            const appt = item.appointments;
            const currentStatus = (appt?.ops_status ?? "agendado") as OpsStatus;
            const next = nextOpsStatus(currentStatus);
            const client = appt ? profileById.get(appt.user_id) : undefined;
            const address = item.addresses;
            const petSize = (appt?.pets?.size as PetSize | undefined) ?? "medio";
            const requiresCar = !isVehicleAllowedForPet("moto", petSize);
            const tutorLink = whatsappLinkTo(
              client?.phone,
              `Olá${client?.full_name ? `, ${client.full_name}` : ""}! Aqui é do ${CLINIC.name}.`,
            );
            return (
              <div key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      #{item.code} · {appt?.services?.name ?? "Serviço"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appt ? formatDateTime(appt.scheduled_at) : ""}
                      {appt?.pets?.name ? ` · ${appt.pets.name}` : ""}
                      {client?.full_name ? ` · ${client.full_name}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0", statusToneClass(opsStatusTone(currentStatus)))}
                  >
                    {opsStatusLabels[currentStatus]}
                  </Badge>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {appt ? logisticsTypeLabels[appt.logistics_type as LogisticsType] : ""}
                  {item.delivery_zones?.name ? ` · Zona: ${item.delivery_zones.name}` : ""}
                  {` · Porte ${petSizeLabels[petSize].toLowerCase()} · exige ${requiresCar ? "carro" : "moto ou carro"}`}
                </p>
                {address && (
                  <p className="text-xs text-muted-foreground">
                    <Truck className="mr-1 inline h-3.5 w-3.5" />
                    {address.street}
                    {address.number ? `, ${address.number}` : ""}
                    {address.complement ? ` - ${address.complement}` : ""} — {address.district}
                    {address.reference ? ` (${address.reference})` : ""}
                  </p>
                )}

                {tutorLink && (
                  <a
                    href={tutorLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Falar com o tutor
                  </a>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    {...(item.driver_id ? { value: item.driver_id } : {})}
                    onValueChange={(driverId) => {
                      if (!appt) return;
                      const driver = drivers.find((d) => d.id === driverId);
                      if (
                        driver?.vehicle_type &&
                        !isVehicleAllowedForPet(driver.vehicle_type as VehicleType, petSize)
                      ) {
                        toast.error(
                          `${driver.full_name ?? "Esse motorista"} está com veículo moto, mas o pet é de porte ${petSizeLabels[petSize].toLowerCase()} — designe um motorista de carro.`,
                        );
                        return;
                      }
                      assignDriver.mutate({
                        transportOrderId: item.id,
                        appointmentId: item.appointment_id,
                        driverId,
                        currentStatus,
                        userId: appt.user_id,
                        petName: appt.pets?.name ?? null,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9 w-44 rounded-xl text-xs">
                      <SelectValue placeholder="Motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((d) => {
                        const blocked =
                          d.vehicle_type != null &&
                          !isVehicleAllowedForPet(d.vehicle_type as VehicleType, petSize);
                        return (
                          <SelectItem key={d.id} value={d.id}>
                            {blocked ? "⚠️ " : ""}
                            {d.full_name ?? d.phone ?? d.id.slice(0, 8)}
                            {d.vehicle_type
                              ? ` (${vehicleTypeLabels[d.vehicle_type as VehicleType]})`
                              : ""}
                          </SelectItem>
                        );
                      })}
                      {drivers.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Nenhum motorista cadastrado
                        </div>
                      )}
                    </SelectContent>
                  </Select>

                  <TransportPriceEditor
                    priceCents={item.price_cents}
                    onSave={(cents) =>
                      appt &&
                      updateTransportPrice.mutate({
                        transportOrderId: item.id,
                        appointmentId: item.appointment_id,
                        priceCents: cents,
                        servicePriceCents: appt.service_price_cents ?? 0,
                      })
                    }
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {opsStatusOrder.map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        appt &&
                        advanceOpsStatus.mutate({
                          appointmentId: item.appointment_id,
                          transportOrderId: item.id,
                          status,
                          userId: appt.user_id,
                          petName: appt.pets?.name ?? null,
                        })
                      }
                      className={
                        currentStatus === status
                          ? "rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                          : "rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
                      }
                    >
                      {opsStatusLabels[status]}
                    </button>
                  ))}
                </div>
                {next && (
                  <Button
                    size="sm"
                    className="mt-2 h-9 w-full rounded-xl"
                    disabled={advanceOpsStatus.isPending}
                    onClick={() =>
                      appt &&
                      advanceOpsStatus.mutate({
                        appointmentId: item.appointment_id,
                        transportOrderId: item.id,
                        status: next,
                        userId: appt.user_id,
                        petName: appt.pets?.name ?? null,
                      })
                    }
                  >
                    Avançar: {opsStatusLabels[next]}
                  </Button>
                )}

                <DriverLiveMap
                  appointmentId={item.appointment_id}
                  active={
                    currentStatus === "em_deslocamento_retirada" ||
                    currentStatus === "em_rota_devolucao"
                  }
                />
                <TransportHistoryList appointmentId={item.appointment_id} currentStatus={currentStatus} />
              </div>
            );
          })}
          {(transportOrders ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido de retirada/devolução.</p>
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
          {(orders ?? []).map((order) => {
            const clientInfo = getClientAbcInfo(order.user_id, order.phone);

            return (
              <div
                key={order.id}
                className={cn(
                  "rounded-2xl bg-card p-3 shadow-card transition-all",
                  clientInfo?.abcClass === "A"
                    ? "border-2 border-emerald-500/50"
                    : clientInfo?.abcClass === "B"
                    ? "border-2 border-blue-500/40"
                    : "",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{order.customer_name ?? "Cliente"}</p>
                    {clientInfo && (
                      <Badge className={cn("text-[10px] font-bold px-1.5 py-0.2", clientInfo.suggestion.badgeClass)}>
                        {clientInfo.suggestion.badgeLabel}
                      </Badge>
                    )}
                  </div>
                  <span className="font-display text-sm text-primary">
                    {formatBRL(order.total_cents)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(order.created_at)} · {order.phone ?? "sem telefone"}
                  {clientInfo && clientInfo.ltvCents > 0 ? ` · LTV Histórico: ${formatBRL(clientInfo.ltvCents)}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                </p>

                {/* Destaque de Ação na Separação do Pedido */}
                {clientInfo && clientInfo.abcClass === "A" && (
                  <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-emerald-900 dark:text-emerald-200">
                      🎁 <strong>Ação VIP Loja:</strong> Cliente VIP comprando produtos! Enviar amostra/petisco cortesia e bilhete carinhoso na sacola.
                    </span>
                  </div>
                )}
                {clientInfo && clientInfo.abcClass === "B" && (
                  <div className="mt-2 rounded-xl bg-blue-500/10 border border-blue-500/30 p-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-blue-900 dark:text-blue-200">
                      📈 <strong>Ação Regular Loja:</strong> Enviar cupom promocional para o próximo banho/tosa junto com os produtos.
                    </span>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {orderStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => updateOrder.mutate({ id: order.id, status })}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                        order.status === status
                          ? cn("bg-primary text-primary-foreground", statusToneClass(orderStatusTone(status)))
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {status.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {(orders ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
          )}
        </TabsContent>

        <TabsContent value="servicos" className="mt-4 space-y-2">
          <CatalogCreateBlock
            kind="services"
            label="Novo serviço"
            open={creatingCatalog === "services"}
            categories={serviceCategoryOptions}
            isPending={createCatalog.isPending}
            onOpen={() => {
              setEditingCatalogId(null);
              setCreatingCatalog("services");
            }}
            onCancel={() => setCreatingCatalog(null)}
            onSubmit={(values) => createCatalog.mutate({ table: "services", values })}
          />

          {(services ?? []).map((service) => (
            <CatalogRow
              key={service.id}
              kind="services"
              name={service.name}
              subtitle={service.category}
              priceCents={service.price_cents}
              active={service.active}
              categories={serviceCategoryOptions}
              editing={editingCatalogId === service.id}
              isPending={updateCatalog.isPending}
              initial={{
                name: service.name,
                description: service.description ?? "",
                category: service.category,
                priceCents: service.price_cents,
                durationMin: service.duration_min,
                stock: 0,
                active: service.active,
              }}
              onEdit={() => {
                setCreatingCatalog(null);
                setEditingCatalogId(service.id);
              }}
              onCancelEdit={() => setEditingCatalogId(null)}
              onSaveAll={(values) =>
                updateCatalog.mutate(
                  {
                    table: "services",
                    id: service.id,
                    values: {
                      name: values.name,
                      description: values.description || null,
                      category: values.category,
                      price_cents: values.priceCents,
                      duration_min: values.durationMin,
                      active: values.active,
                    },
                  },
                  { onSuccess: () => setEditingCatalogId(null) },
                )
              }
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
          <CatalogCreateBlock
            kind="products"
            label="Novo produto"
            open={creatingCatalog === "products"}
            categories={productCategoryOptions}
            isPending={createCatalog.isPending}
            onOpen={() => {
              setEditingCatalogId(null);
              setCreatingCatalog("products");
            }}
            onCancel={() => setCreatingCatalog(null)}
            onSubmit={(values) => createCatalog.mutate({ table: "products", values })}
          />

          {(products ?? []).map((product) => (
            <CatalogRow
              key={product.id}
              kind="products"
              name={product.name}
              subtitle={`${product.category} · estoque ${product.stock}`}
              priceCents={product.price_cents}
              active={product.active}
              categories={productCategoryOptions}
              editing={editingCatalogId === product.id}
              isPending={updateCatalog.isPending}
              initial={{
                name: product.name,
                description: product.description ?? "",
                category: product.category,
                priceCents: product.price_cents,
                durationMin: 30,
                stock: product.stock,
                active: product.active,
              }}
              onEdit={() => {
                setCreatingCatalog(null);
                setEditingCatalogId(product.id);
              }}
              onCancelEdit={() => setEditingCatalogId(null)}
              onSaveAll={(values) =>
                updateCatalog.mutate(
                  {
                    table: "products",
                    id: product.id,
                    values: {
                      name: values.name,
                      description: values.description || null,
                      category: values.category,
                      price_cents: values.priceCents,
                      stock: values.stock,
                      active: values.active,
                    },
                  },
                  { onSuccess: () => setEditingCatalogId(null) },
                )
              }
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

/** Bloco "Novo serviço" / "Novo produto" no topo das abas de catálogo. */
function CatalogCreateBlock({
  kind,
  label,
  open,
  categories,
  isPending,
  onOpen,
  onCancel,
  onSubmit,
}: {
  kind: CatalogKind;
  label: string;
  open: boolean;
  categories: string[];
  isPending: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: (values: CatalogValues) => void;
}) {
  if (!open) {
    return (
      <Button className="h-11 w-full rounded-2xl" onClick={onOpen}>
        + {label}
      </Button>
    );
  }
  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <CatalogForm
        kind={kind}
        initial={emptyCatalogValues(kind)}
        categories={categories}
        submitLabel="Criar"
        isPending={isPending}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}

function CatalogRow({
  kind,
  name,
  subtitle,
  priceCents,
  active,
  categories,
  editing,
  isPending,
  initial,
  onEdit,
  onCancelEdit,
  onSaveAll,
  onSave,
  onToggle,
}: {
  kind: CatalogKind;
  name: string;
  subtitle: string;
  priceCents: number;
  active: boolean;
  categories: string[];
  editing: boolean;
  isPending: boolean;
  initial: CatalogValues;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveAll: (values: CatalogValues) => void;
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
        <Button
          size="sm"
          variant="secondary"
          className="h-9 rounded-xl"
          onClick={editing ? onCancelEdit : onEdit}
        >
          {editing ? "Fechar" : "Editar"}
        </Button>
      </div>

      {editing && (
        <CatalogForm
          kind={kind}
          initial={initial}
          categories={categories}
          submitLabel="Salvar alterações"
          isPending={isPending}
          onSubmit={onSaveAll}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
}

function ZoneRow({
  name,
  districts,
  priceCents,
  freeAboveCents,
  active,
  onSave,
  onToggle,
}: {
  name: string;
  districts: string[];
  priceCents: number;
  freeAboveCents: number | null;
  active: boolean;
  onSave: (priceCents: number, freeAboveCents: number | null) => void;
  onToggle: () => void;
}) {
  const [price, setPrice] = useState((priceCents / 100).toFixed(2));
  const [freeAbove, setFreeAbove] = useState(
    freeAboveCents != null ? (freeAboveCents / 100).toFixed(2) : "",
  );

  return (
    <div className="rounded-xl border border-border p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{districts.join(", ")}</p>
        </div>
        <Badge variant={active ? "default" : "secondary"} className="shrink-0">
          {active ? "ativa" : "inativa"}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço"
          className="h-9 w-20 rounded-xl text-xs"
        />
        <Input
          inputMode="decimal"
          value={freeAbove}
          onChange={(e) => setFreeAbove(e.target.value)}
          placeholder="Grátis acima de"
          className="h-9 w-28 rounded-xl text-xs"
        />
        <Button
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => {
            const parsedPrice = priceSchema.safeParse(price.replace(",", "."));
            if (!parsedPrice.success) {
              toast.error("Preço inválido");
              return;
            }
            let freeAboveCentsValue: number | null = null;
            if (freeAbove.trim()) {
              const parsedFree = priceSchema.safeParse(freeAbove.replace(",", "."));
              if (!parsedFree.success) {
                toast.error("Valor de isenção inválido");
                return;
              }
              freeAboveCentsValue = Math.round(parsedFree.data * 100);
            }
            onSave(Math.round(parsedPrice.data * 100), freeAboveCentsValue);
          }}
        >
          Salvar
        </Button>
        <Button size="sm" variant="secondary" className="h-9 rounded-xl" onClick={onToggle}>
          {active ? "Desativar" : "Ativar"}
        </Button>
      </div>
    </div>
  );
}

function ReturningClientDiscountEditor({
  percent,
  isPending,
  onSave,
}: {
  percent: number | null;
  isPending: boolean;
  onSave: (percent: number | null) => void;
}) {
  const [value, setValue] = useState(percent != null ? String(percent) : "");

  return (
    <div className="rounded-2xl bg-card p-3 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Desconto para cliente recorrente
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Aplicado automaticamente na taxa de retirada/devolução de tutores com pelo menos um
        agendamento concluído antes.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: 10"
          className="h-9 w-24 rounded-xl text-xs"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <Button
          size="sm"
          className="h-9 rounded-xl"
          disabled={isPending}
          onClick={() => {
            if (!value.trim()) {
              onSave(null);
              return;
            }
            const parsed = z.coerce.number().int().min(0).max(100).safeParse(value);
            if (!parsed.success) {
              toast.error("Informe um percentual entre 0 e 100");
              return;
            }
            onSave(parsed.data);
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function NewCouponForm({
  isPending,
  onCreate,
}: {
  isPending: boolean;
  onCreate: (input: {
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
  }) => void;
}) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Novo cupom
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Código (ex.: BEMVINDO10)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-9 flex-1 rounded-xl text-xs uppercase"
        />
        <div className="flex overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setDiscountType("percent")}
            className={cn(
              "px-2.5 py-1.5 text-xs font-semibold",
              discountType === "percent"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => setDiscountType("fixed")}
            className={cn(
              "px-2.5 py-1.5 text-xs font-semibold",
              discountType === "fixed"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            R$
          </button>
        </div>
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={discountType === "percent" ? "Ex.: 15" : "Ex.: 10,00"}
          className="h-9 w-24 rounded-xl text-xs"
        />
        <Button
          size="sm"
          className="h-9 rounded-xl"
          disabled={isPending}
          onClick={() => {
            const trimmedCode = code.trim();
            if (trimmedCode.length < 3) {
              toast.error("Informe um código de pelo menos 3 caracteres");
              return;
            }
            if (discountType === "percent") {
              const parsed = z.coerce.number().int().min(1).max(100).safeParse(value);
              if (!parsed.success) {
                toast.error("Informe um percentual entre 1 e 100");
                return;
              }
              onCreate({ code: trimmedCode, discountType, discountValue: parsed.data });
            } else {
              const parsed = priceSchema.safeParse(value.replace(",", "."));
              if (!parsed.success) {
                toast.error("Valor inválido");
                return;
              }
              onCreate({
                code: trimmedCode,
                discountType,
                discountValue: Math.round(parsed.data * 100),
              });
            }
            setCode("");
            setValue("");
          }}
        >
          Criar
        </Button>
      </div>
    </div>
  );
}

function TransportPriceEditor({
  priceCents,
  onSave,
}: {
  priceCents: number;
  onSave: (priceCents: number) => void;
}) {
  const [price, setPrice] = useState((priceCents / 100).toFixed(2));

  return (
    <div className="flex items-center gap-1.5">
      <Input
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="h-9 w-20 rounded-xl text-xs"
      />
      <Button
        size="sm"
        variant="secondary"
        className="h-9 rounded-xl text-xs"
        onClick={() => {
          const parsed = priceSchema.safeParse(price.replace(",", "."));
          if (!parsed.success) {
            toast.error("Valor inválido");
            return;
          }
          onSave(Math.round(parsed.data * 100));
        }}
      >
        Ajustar taxa
      </Button>
    </div>
  );
}
