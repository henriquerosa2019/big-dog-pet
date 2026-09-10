import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CalendarClock,
  CheckCircle2,
  Compass,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Gift,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  QrCode,
  Search,
  Sliders,
  Syringe,
  Truck,
  Volume2,
  X,
  Clock,
  ChevronRight,
  Scissors,
  Settings,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  User,
  Plus,
  Trash2,
  ShieldCheck,
  UserCheck,
  ShoppingBag,
  Package,
} from "lucide-react";
import { getCapacitySettings, saveCapacitySettings, type CapacitySettings } from "@/lib/schedulingCapacity";
import { playStatusSound, testSoundAlert } from "@/lib/soundAlerts";
import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdminStatus } from "@/hooks/useAuth";
import {
  fetchAddressByCep,
  formatFullAddress,
  getGoogleMapsUrl,
  getWazeUrl,
  maskCep,
} from "@/lib/navigation";
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
  isAppointmentInService,
  isBirthdayToday,
  isBirthdayTomorrow,
  isOrderInService,
  maskPhoneBR,
  orderStatusTone,
  sortInServiceFirst,
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
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getAllManagedDrivers,
  registerNewDriver,
  updateManagedDriver,
  removeManagedDriver,
  type ManagedDriver,
} from "@/lib/driversManager";
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
import { DeliverySimulator } from "@/components/DeliverySimulator";
import { CurvaAbcProdutos } from "@/components/CurvaAbcProdutos";
import { CurvaAbcServicos } from "@/components/CurvaAbcServicos";
import { CurvaAbcClientes } from "@/components/CurvaAbcClientes";
import { RelatorioEntregasMotoristas } from "@/components/RelatorioEntregasMotoristas";
import { RelatorioAtendimentosPeriodo } from "@/components/RelatorioAtendimentosPeriodo";
import { openInAppChat } from "@/components/InAppChatDrawer";
import { useChatQueue } from "@/lib/inAppChat";
import { AdminChatLogs } from "@/components/AdminChatLogs";
import { AdminKpiPills } from "@/components/admin/AdminKpiPills";
import { AdminOperationalKanban, type KanbanItem } from "@/components/admin/AdminOperationalKanban";
import { AdminHealthAlertsGrouped, type HealthAlertItem } from "@/components/admin/AdminHealthAlertsGrouped";
import { AdminOrdersManager } from "@/components/admin/AdminOrdersManager";
import { PetAvatar } from "@/components/PetAvatar";
import { PetPhotoUpload } from "@/components/PetPhotoUpload";
import { getCriticalStock, setCriticalStock, findCurveACriticalProducts } from "@/lib/stockSettings";
import { calculateProductAbc } from "@/lib/curvaAbc";
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
import { openMiroModal } from "@/components/MiroModal";
import {
  CLOSING_OPS_STATUS,
  formatOpsStatusWithPet,
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
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: string } => ({
    ...(typeof search["tab"] === "string" ? { tab: search["tab"] as string } : {}),
  }),
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
  size: z.enum(["pequeno", "medio", "grande"]).default("medio"),
  weightKg: z.string().trim().max(10).optional(),
  photoUrl: z.string().trim().optional().nullable(),
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

function formatChatRelativeTime(isoString: string) {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `há ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `há ${diffHours}h`;
    return new Date(isoString).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function Admin() {
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdminStatus(user?.id, user?.email);
  const queryClient = useQueryClient();
  const { getClientAbcInfo } = useClientAbcMap();
  const mapSearchToTabs = (tab?: string): { master: string; sub?: string } => {
    if (!tab) return { master: "hoje" };
    if (["hoje", "comunicacao", "pedidos", "saude", "gestao"].includes(tab)) return { master: tab };
    if (["dashboard"].includes(tab)) return { master: "hoje" };
    if (["atendimentos", "chat"].includes(tab)) return { master: "comunicacao" };
    if (["retornos"].includes(tab)) return { master: "pedidos" };
    if (
      [
        "clientes",
        "novo-cliente",
        "relatorios",
        "clinica",
        "pedidos",
        "servicos",
        "produtos",
        "agenda",
        "retirada-entrega",
        "saude",
      ].includes(tab)
    ) {
      return { master: "gestao", sub: tab };
    }
    return { master: "hoje" };
  };

  const initialMapped = mapSearchToTabs(search?.tab);
  const [currentTab, setCurrentTab] = useState<string>(initialMapped.master);
  const [gestaoSubTab, setGestaoSubTab] = useState<string>(initialMapped.sub || "clientes");

  useEffect(() => {
    if (search?.tab) {
      const mapped = mapSearchToTabs(search.tab);
      setCurrentTab(mapped.master);
      if (mapped.sub) setGestaoSubTab(mapped.sub);
    }
  }, [search?.tab]);

  const {
    conversations: chatQueue,
    openConversations,
    closedConversations,
    unreadConversationsCount,
    totalUnread: totalChatUnread,
  } = useChatQueue();
  const [capacitySettings, setCapacitySettings] = useState<CapacitySettings>(getCapacitySettings);

  function handleSaveCapacity() {
    saveCapacitySettings(capacitySettings);
    toast.success("Limites de capacidade da agenda salvos com sucesso!");
  }

  const { data: appointments } = useQuery({
    queryKey: ["admin-appointments"],
    enabled: isAdmin,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, user_id, pet_id, scheduled_at, created_at, status, ops_status, logistics_type, notes, origin, total_cents, service_price_cents, transport_price_cents, payment_status, payment_method, paid_at, services(name, category), pets(name, species, size, photo_url, breed)")
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
        .select("id, name, description, category, price_cents, stock, active, image_url")
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
          "id, code, appointment_id, driver_id, price_cents, assigned_at, en_route_pickup_at, picked_up_at, arrived_shop_at, en_route_return_at, delivered_at, pickup_notes, return_notes, pickup_condition, return_condition, tutor_confirmed_at, appointments(user_id, pet_id, scheduled_at, status, ops_status, logistics_type, notes, service_price_cents, services(name), pets(name, size)), addresses(label, street, number, complement, district, city, state, cep, reference), delivery_zones(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: allAddresses } = useQuery({
    queryKey: ["admin-addresses"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, user_id, label, cep, street, number, complement, district, city, state, reference, is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
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
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
          queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
          queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });
          if (payload.eventType === "INSERT") {
            try {
              playStatusSound("alerta", 3);
            } catch {}
            toast.info("🔔 Novo agendamento recebido!", {
              description: "Clique em Agendamentos no topo para confirmar.",
            });
          }
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

  const [customDriversRevision, setCustomDriversRevision] = useState(0);

  useEffect(() => {
    const handleDriversUpdated = () => setCustomDriversRevision((prev) => prev + 1);
    window.addEventListener("bigdog_drivers_updated", handleDriversUpdated);
    return () => window.removeEventListener("bigdog_drivers_updated", handleDriversUpdated);
  }, []);

  const drivers = useMemo(() => {
    const dbMapped = (driverRoles ?? []).map((r) => ({
      id: r.user_id,
      full_name: profileById.get(r.user_id)?.full_name ?? null,
      phone: profileById.get(r.user_id)?.phone ?? null,
      vehicle_type: profileById.get(r.user_id)?.vehicle_type ?? null,
    }));
    return getAllManagedDrivers(dbMapped);
  }, [driverRoles, profileById, customDriversRevision]);

  const [isNewDriverDialogOpen, setIsNewDriverDialogOpen] = useState(false);
  const [newDriverMode, setNewDriverMode] = useState<"novo" | "existente">("novo");
  const [newDriverForm, setNewDriverForm] = useState({
    name: "",
    phone: "",
    email: "",
    vehicleType: "carro" as VehicleType,
    existingUserId: "",
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
        .select(
          "id, scheduled_at, status, ops_status, origin, total_cents, service_price_cents, transport_price_cents, services(category, name, price_cents), pets(name)",
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
        .select("id, created_at, status, total_cents, order_items(product_id, product_name, quantity, unit_price_cents)")
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

    function getApptRevenue(a: {
      total_cents?: number | null;
      service_price_cents?: number | null;
      services?: { price_cents?: number | null } | null;
    }) {
      return (a.total_cents && a.total_cents > 0)
        ? a.total_cents
        : (a.service_price_cents && a.service_price_cents > 0)
        ? a.service_price_cents
        : (a.services?.price_cents && a.services.price_cents > 0)
        ? a.services.price_cents
        : 0;
    }

    function sumServiceRevenue(since: Date) {
      return executedAppointments
        .filter((a) => new Date(a.scheduled_at) >= since)
        .reduce((sum, a) => sum + getApptRevenue(a as any), 0);
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
        .reduce((sum, a) => sum + getApptRevenue(a as any), 0);
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

  const DEFAULT_PRODUCT_CATEGORIES = ["alimentacao", "higiene", "medicamentos", "acessorios"] as const;
  const productCategoryLabels: Record<string, string> = {
    alimentacao: "Alimentação / Ração",
    higiene: "Higiene & Beleza",
    medicamentos: "Medicamentos / Farmácia",
    acessorios: "Acessórios & Brinquedos",
    farmacia: "Medicamentos / Farmácia",
    brinquedos: "Acessórios & Brinquedos",
    outros: "Outros Produtos",
  };

  const dashboardProductCategories = useMemo(() => {
    const fromProducts = Array.from(
      new Set(
        (products ?? [])
          .map((p) => p.category?.trim().toLowerCase())
          .filter((c): c is string => Boolean(c))
      )
    );
    const set = new Set<string>([...DEFAULT_PRODUCT_CATEGORIES, ...fromProducts]);
    return Array.from(set);
  }, [products]);

  const productStats = useMemo(() => {
    const { dayStart, weekStart, monthStart } = dashboardBoundaries;

    const prodCatMap = new Map<string, string>();
    for (const p of products ?? []) {
      const cat = p.category?.trim().toLowerCase() || "outros";
      if (p.id) prodCatMap.set(p.id, cat);
      if (p.name) prodCatMap.set(p.name.trim().toLowerCase(), cat);
    }

    const byCategory: Record<string, { day: number; week: number; month: number }> = {};
    for (const cat of dashboardProductCategories) {
      byCategory[cat] = { day: 0, week: 0, month: 0 };
    }

    const total = { day: 0, week: 0, month: 0 };

    const ordersList = (dashOrders ?? orders ?? []).filter((o: any) => o.status !== "cancelado");

    for (const order of ordersList) {
      const orderDate = new Date(order.created_at);
      const isMonth = orderDate >= monthStart;
      const isWeek = orderDate >= weekStart;
      const isDay = orderDate >= dayStart;

      if (!isMonth) continue;

      const items = (order as any).order_items ?? [];
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        let cat = "outros";
        if (item.product_id && prodCatMap.has(item.product_id)) {
          cat = prodCatMap.get(item.product_id)!;
        } else if (item.product_name && prodCatMap.has(item.product_name.trim().toLowerCase())) {
          cat = prodCatMap.get(item.product_name.trim().toLowerCase())!;
        } else {
          const lower = (item.product_name || "").toLowerCase();
          if (
            lower.includes("ração") ||
            lower.includes("racao") ||
            lower.includes("alimento") ||
            lower.includes("petisco")
          ) {
            cat = "alimentacao";
          } else if (
            lower.includes("shampoo") ||
            lower.includes("sabonete") ||
            lower.includes("escova") ||
            lower.includes("perfume")
          ) {
            cat = "higiene";
          } else if (
            lower.includes("medicamento") ||
            lower.includes("remedio") ||
            lower.includes("pulga") ||
            lower.includes("carrapato") ||
            lower.includes("vermifugo")
          ) {
            cat = "medicamentos";
          } else if (
            lower.includes("coleira") ||
            lower.includes("guia") ||
            lower.includes("brinquedo") ||
            lower.includes("cama") ||
            lower.includes("roupa")
          ) {
            cat = "acessorios";
          }
        }

        if (!byCategory[cat]) {
          byCategory[cat] = { day: 0, week: 0, month: 0 };
        }

        if (isMonth) {
          byCategory[cat].month += qty;
          total.month += qty;
        }
        if (isWeek) {
          byCategory[cat].week += qty;
          total.week += qty;
        }
        if (isDay) {
          byCategory[cat].day += qty;
          total.day += qty;
        }
      }
    }

    return { byCategory, total };
  }, [dashboardBoundaries, products, dashOrders, orders, dashboardProductCategories]);

  const [kanbanFilterType, setKanbanFilterType] = useState<"todos" | "banho" | "delivery">("todos");

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

  const pendingAppointmentsCount = useMemo(() => {
    return (appointments ?? []).filter((a) => a.status === "pendente").length;
  }, [appointments]);

  const handleNavigateToAgenda = useCallback(() => {
    setCurrentTab("gestao");
    setGestaoSubTab("agenda");
    setTimeout(() => {
      const el =
        document.getElementById("primeiro-agendamento-pendente") ||
        document.getElementById("agendamentos-detalhados-topo");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }, []);

  const sortedAgendaAppointments = useMemo(() => {
    const list = [...(appointments ?? [])];
    return list.sort((a, b) => {
      // 1. Agendamentos pendentes ("Aguardando Loja") vão para o topo absoluto!
      const aPending = a.status === "pendente" ? 1 : 0;
      const bPending = b.status === "pendente" ? 1 : 0;
      if (bPending !== aPending) return bPending - aPending;

      // Se ambos forem pendentes, os mais recentes criados ou agendados ficam no topo
      if (aPending && bPending) {
        const timeA = new Date((a as { created_at?: string }).created_at || a.scheduled_at).getTime();
        const timeB = new Date((b as { created_at?: string }).created_at || b.scheduled_at).getTime();
        return timeB - timeA;
      }

      // 2. Em seguida, quem está em atendimento agora
      const aInService = isAppointmentInService(a) ? 1 : 0;
      const bInService = isAppointmentInService(b) ? 1 : 0;
      if (bInService !== aInService) return bInService - aInService;

      // 3. Os demais ordenados por scheduled_at decrescente
      return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
    });
  }, [appointments]);

  const sortedOrders = useMemo(() => {
    return sortInServiceFirst(orders ?? [], isOrderInService);
  }, [orders]);

  const pendingOrdersCount = useMemo(() => {
    return (orders ?? []).filter((o) => o.status === "novo" || o.status === "em_preparo").length;
  }, [orders]);

  const todayOrdersCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (orders ?? []).filter((o) => new Date(o.created_at).toDateString() === todayStr).length;
  }, [orders]);

  const handleNavigateToOrders = useCallback(() => {
    setCurrentTab("gestao");
    setGestaoSubTab("pedidos");
    setTimeout(() => {
      const el =
        document.getElementById("pedidos-loja-topo") ||
        document.getElementById("pedidos-loja-container");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  }, []);

  const sortedTransportOrders = useMemo(() => {
    return sortInServiceFirst(
      transportOrders ?? [],
      (item) => isAppointmentInService(item.appointments),
    );
  }, [transportOrders]);

  const [newClient, setNewClient] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    birthDate: "",
  });
  const [showNewClientPassword, setShowNewClientPassword] = useState(false);
  const [newClientPet, setNewClientPet] = useState<{
    name: string;
    species: string;
    breed: string;
    temperament: string;
    allergies: string;
    birthDate: string;
    size: PetSize;
    weightKg: string;
    photoUrl: string | null;
  }>({
    name: "",
    species: "cachorro",
    breed: "",
    temperament: "",
    allergies: "",
    birthDate: "",
    size: "medio",
    weightKg: "",
    photoUrl: null,
  });
  const [newClientAddress, setNewClientAddress] = useState({
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "Franco da Rocha",
    state: "SP",
    reference: "",
  });
  const [isCepLoading, setIsCepLoading] = useState(false);

  async function handleNewClientCepChange(val: string) {
    const masked = maskCep(val);
    setNewClientAddress((prev) => ({ ...prev, cep: masked }));
    const raw = val.replace(/\D/g, "");
    if (raw.length === 8) {
      setIsCepLoading(true);
      try {
        const info = await fetchAddressByCep(raw);
        if (info) {
          setNewClientAddress((prev) => ({
            ...prev,
            cep: masked,
            street: info.logradouro || prev.street,
            district: info.bairro || prev.district,
            city: info.localidade || prev.city,
            state: info.uf || prev.state,
          }));
          toast.success("Endereço preenchido pelo CEP!");
        }
      } finally {
        setIsCepLoading(false);
      }
    }
  }

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
        const parsedWeight = pet.weightKg && pet.weightKg.trim()
          ? parseFloat(pet.weightKg.replace(",", "."))
          : null;
        const { error: petError } = await supabase.from("pets").insert({
          owner_id: data.user!.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed || null,
          temperament: pet.temperament || null,
          allergies: pet.allergies || null,
          birth_date: pet.birthDate || null,
          size: pet.size,
          weight_kg: Number.isFinite(parsedWeight) ? parsedWeight : null,
          photo_url: pet.photoUrl || null,
        });
        if (petError) throw petError;
      }

      // Se informou endereço, grava na tabela addresses vinculado ao novo cliente
      if (newClientAddress.street.trim()) {
        const { error: addressError } = await supabase.from("addresses").insert({
          user_id: data.user!.id,
          label: "Casa",
          cep: newClientAddress.cep.trim() || null,
          street: newClientAddress.street.trim(),
          number: newClientAddress.number.trim() || null,
          complement: newClientAddress.complement.trim() || null,
          district: newClientAddress.district.trim() || "Centro",
          city: newClientAddress.city.trim() || "Franco da Rocha",
          state: newClientAddress.state.trim() || "SP",
          reference: newClientAddress.reference.trim() || null,
          is_default: true,
        });
        if (addressError) {
          console.error("Erro ao salvar endereço do novo cliente:", addressError);
        }
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
      queryClient.invalidateQueries({ queryKey: ["admin-addresses"] });
      toast.success("Cliente cadastrado! Peça para confirmar o e-mail antes de usar o app.");
      setNewClient({ fullName: "", phone: "", email: "", password: "", birthDate: "" });
      setNewClientPet({
        name: "",
        species: "cachorro",
        breed: "",
        temperament: "",
        allergies: "",
        birthDate: "",
        size: "medio",
        weightKg: "",
        photoUrl: null,
      });
      setNewClientAddress({
        cep: "",
        street: "",
        number: "",
        complement: "",
        district: "",
        city: "Franco da Rocha",
        state: "SP",
        reference: "",
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
      const payload: { status: string; ops_status?: string } = { status };
      if (status === "cancelado") {
        payload.ops_status = "cancelado";
      }
      const { error } = await supabase.from("appointments").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
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

  const registerStorePayment = useMutation({
    mutationFn: async ({
      appointmentId,
      method,
    }: {
      appointmentId: string;
      method: "credito" | "debito" | "pix" | "dinheiro";
    }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          payment_status: "pago",
          payment_method: method,
          paid_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);
      if (error) throw error;
      return method;
    },
    onSuccess: (method) => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(`Pagamento no balcão registrado via ${method.toUpperCase()} com sucesso!`);
      playStatusSound("confirmado", 1);
    },
    onError: () => toast.error("Não foi possível registrar o pagamento"),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      playStatusSound("confirmado");
      toast.success("Agendamento confirmado no app!");
    },
    onError: () => toast.error("Não foi possível confirmar"),
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
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      toast.success("Status atualizado");

      // Dispara o alerta sonoro correspondente à transição
      const st = vars.status as string;
      if (st === "em_deslocamento_retirada" || st === "em_rota_devolucao") {
        playStatusSound("transporte");
      } else if (st === "chegou_local_retirada" || st === "chegou_local_entrega") {
        playStatusSound("portao");
      } else if (st === "pet_retirado") {
        playStatusSound("transporte");
      } else if (st === "pet_chegou_petshop") {
        playStatusSound("confirmado");
      } else if (st === "em_atendimento") {
        playStatusSound("atendimento");
      } else if (st === "servico_concluido") {
        playStatusSound("confirmado");
      } else if (st === "pet_entregue" || st === "finalizado") {
        playStatusSound("concluido");
      }

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
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
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
      updateManagedDriver(vars.driverId, { vehicle_type: vars.vehicleType });
      try {
        await supabase
          .from("profiles")
          .update({ vehicle_type: vars.vehicleType })
          .eq("id", vars.driverId);
      } catch (err) {
        console.warn("Supabase update notice:", err);
      }
    },
    onSuccess: () => {
      setCustomDriversRevision((prev) => prev + 1);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
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
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "Franco da Rocha",
    state: "SP",
    reference: "",
  });
  const [isDirectoryCepLoading, setIsDirectoryCepLoading] = useState(false);

  async function handleDirectoryCepChange(val: string) {
    const masked = maskCep(val);
    setDirectoryClientForm((prev) => ({ ...prev, cep: masked }));
    const raw = val.replace(/\D/g, "");
    if (raw.length === 8) {
      setIsDirectoryCepLoading(true);
      try {
        const info = await fetchAddressByCep(raw);
        if (info) {
          setDirectoryClientForm((prev) => ({
            ...prev,
            cep: masked,
            street: info.logradouro || prev.street,
            district: info.bairro || prev.district,
            city: info.localidade || prev.city,
            state: info.uf || prev.state,
          }));
          toast.success("Endereço preenchido pelo CEP!");
        }
      } finally {
        setIsDirectoryCepLoading(false);
      }
    }
  }

  const [editingDirectoryPetId, setEditingDirectoryPetId] = useState<string | null>(null);
  const [directoryPetForm, setDirectoryPetForm] = useState<{
    name: string;
    breed: string;
    size: PetSize;
    weightKg: string;
    photoUrl: string | null;
  }>({ name: "", breed: "", size: "medio", weightKg: "", photoUrl: null });

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

      if (directoryClientForm.street.trim()) {
        const existingAddr = addressesByOwner.get(editingDirectoryClientId)?.[0];
        if (existingAddr) {
          const { error: addrErr } = await supabase
            .from("addresses")
            .update({
              cep: directoryClientForm.cep.trim() || null,
              street: directoryClientForm.street.trim(),
              number: directoryClientForm.number.trim() || null,
              complement: directoryClientForm.complement.trim() || null,
              district: directoryClientForm.district.trim() || "Centro",
              city: directoryClientForm.city.trim() || "Franco da Rocha",
              state: directoryClientForm.state.trim() || "SP",
              reference: directoryClientForm.reference.trim() || null,
            })
            .eq("id", existingAddr.id);
          if (addrErr) throw addrErr;
        } else {
          const { error: addrErr } = await supabase.from("addresses").insert({
            user_id: editingDirectoryClientId,
            label: "Casa",
            cep: directoryClientForm.cep.trim() || null,
            street: directoryClientForm.street.trim(),
            number: directoryClientForm.number.trim() || null,
            complement: directoryClientForm.complement.trim() || null,
            district: directoryClientForm.district.trim() || "Centro",
            city: directoryClientForm.city.trim() || "Franco da Rocha",
            state: directoryClientForm.state.trim() || "SP",
            reference: directoryClientForm.reference.trim() || null,
            is_default: true,
          });
          if (addrErr) throw addrErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-addresses"] });
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
      const parsedWeight = directoryPetForm.weightKg.trim()
        ? parseFloat(directoryPetForm.weightKg.replace(",", "."))
        : null;
      const { error } = await supabase
        .from("pets")
        .update({
          name,
          breed: directoryPetForm.breed.trim() || null,
          size: directoryPetForm.size,
          weight_kg: Number.isFinite(parsedWeight) ? parsedWeight : null,
          photo_url: directoryPetForm.photoUrl || null,
        })
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
  const [reportSubTab, setReportSubTab] = useState<
    "financeiro" | "abc-produtos" | "abc-servicos" | "abc-clientes" | "entregas-motoristas" | "atendimentos-periodo"
  >("financeiro");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("mes");
  const [reportFrom, setReportFrom] = useState(todayISODate());
  const [reportTo, setReportTo] = useState(todayISODate());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportRange, setReportRange] = useState<ReportRange | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<Date | null>(null);
  const [creatingCatalog, setCreatingCatalog] = useState<CatalogKind | null>(null);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);

  // Alerta de Estoque Crítico de Produtos Curva A
  const curveAProductIds = useMemo(() => {
    const rawItems: Array<{
      productId?: string | null;
      productName: string;
      category?: string | null;
      quantity: number;
      unitPriceCents: number;
      orderId: string;
    }> = [];

    for (const ord of orders ?? []) {
      for (const it of ord.order_items ?? []) {
        rawItems.push({
          productName: it.product_name,
          quantity: it.quantity,
          unitPriceCents: 0,
          orderId: ord.id,
        });
      }
    }

    if (rawItems.length > 0) {
      const { items } = calculateProductAbc(rawItems);
      return new Set(items.filter((i) => i.abcClass === "A").map((i) => i.name.trim().toLowerCase()));
    } else {
      return new Set((products ?? []).slice(0, 3).map((p) => p.name.trim().toLowerCase()));
    }
  }, [orders, products]);

  const curveACriticalAlerts = useMemo(() => {
    if (!products) return [];
    return findCurveACriticalProducts(products, curveAProductIds);
  }, [products, curveAProductIds]);
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
        image_url?: string | null | undefined;
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
          : await supabase.from("products").insert({
              ...common,
              stock: values.stock,
              image_url: values.imageUrl || null,
            });
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
        .select("id, name, species, breed, temperament, allergies, owner_id, birth_date, size, weight_kg, photo_url")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addressesByOwner = useMemo(() => {
    const map = new Map<string, NonNullable<typeof allAddresses>>();
    for (const addr of allAddresses ?? []) {
      if (!addr.user_id) continue;
      const list = map.get(addr.user_id) ?? [];
      list.push(addr);
      map.set(addr.user_id, list);
    }
    return map;
  }, [allAddresses]);

  // Diretório usado na aba "Clientes": tutor + pets + endereços, filtrável por nome,
  // telefone, CPF, nome do pet ou endereço.
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
      .map((p) => ({
        ...p,
        pets: petsByOwner.get(p.id) ?? [],
        addresses: addressesByOwner.get(p.id) ?? [],
      }))
      .filter((client) => {
        if (!term) return true;
        const nameMatch = (client.full_name ?? "").toLowerCase().includes(term);
        const phoneMatch = termDigits.length >= 3 && digitsOnly(client.phone ?? "").includes(termDigits);
        const cpfMatch = termDigits.length >= 3 && digitsOnly(client.cpf ?? "").includes(termDigits);
        const petMatch = client.pets.some((pet) => pet.name.toLowerCase().includes(term));
        const addressMatch = client.addresses.some(
          (a) =>
            (a.street ?? "").toLowerCase().includes(term) ||
            (a.district ?? "").toLowerCase().includes(term) ||
            (termDigits.length >= 3 && digitsOnly(a.cep ?? "").includes(termDigits)),
        );
        return nameMatch || phoneMatch || cpfMatch || petMatch || addressMatch;
      })
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [profiles, allPets, addressesByOwner, clientSearch]);

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

  const [showDeliverySimulator, setShowDeliverySimulator] = useState(false);

  // Itens unificados para o Kanban Operacional (Hoje)
  const kanbanItems: KanbanItem[] = useMemo(() => {
    return (appointments ?? []).map((appt) => {
      const clientInfo = getClientAbcInfo(appt.user_id);
      const client = profileById.get(appt.user_id);
      const tutorName = client?.full_name || clientInfo?.name || "Tutor";
      const tutorPhone = client?.phone || clientInfo?.phone || null;
      const pet = appt.pets as {
        name?: string | null;
        species?: string | null;
        photo_url?: string | null;
        breed?: string | null;
      } | null;
      const svc = appt.services as { name?: string | null; category?: string | null } | null;
      const tOrder = (transportOrders ?? []).find((t) => t.appointment_id === appt.id);

      return {
        id: appt.id,
        userId: appt.user_id,
        tutorName,
        tutorPhone,
        petId: appt.pet_id,
        petName: pet?.name || "Pet",
        petSpecies: pet?.species || null,
        petPhotoUrl: pet?.photo_url || null,
        petBreed: pet?.breed || null,
        serviceName: svc?.name || "Serviço",
        serviceCategory: svc?.category || null,
        scheduledAt: appt.scheduled_at,
        status: appt.status,
        opsStatus: appt.ops_status || null,
        logisticsType: appt.logistics_type || null,
        totalCents: appt.total_cents || 0,
        transportOrderId: tOrder?.id || null,
        addressSummary: tOrder?.addresses
          ? `${tOrder.addresses.street || ""}, ${tOrder.addresses.number || ""}`.trim()
          : null,
      };
    });
  }, [appointments, transportOrders, getClientAbcInfo, profileById]);

  // Alertas unificados para o Módulo de Saúde & Retornos Agrupados
  const healthAlertItems: HealthAlertItem[] = useMemo(() => {
    const fromVaccines: HealthAlertItem[] = (vaccinesDue ?? []).map((v) => {
      const owner = v.pets?.owner_id ? profileById.get(v.pets.owner_id) : undefined;
      return {
        id: `vaccine-${v.id}`,
        type: "vacina" as const,
        title: `Reforço: ${v.vaccine_name}`,
        dueDate: (v.next_due_at as string) || todayISODate(),
        petId: v.pet_id,
        petName: v.pets?.name ?? "Pet",
        ownerId: v.pets?.owner_id ?? undefined,
        ownerName: owner?.full_name ?? undefined,
        ownerPhone: owner?.phone ?? undefined,
        reminderId: undefined,
      };
    });

    const fromReminders: HealthAlertItem[] = (careReminders ?? []).map((r) => {
      const owner = r.pets?.owner_id ? profileById.get(r.pets.owner_id) : undefined;
      return {
        id: `reminder-${r.id}`,
        type: (r.reminder_type === "vacina" ? "vacina" : "retorno") as "vacina" | "retorno",
        title: r.title,
        dueDate: r.due_date,
        petId: r.pet_id,
        petName: r.pets?.name ?? "Pet",
        ownerId: r.pets?.owner_id ?? undefined,
        ownerName: owner?.full_name ?? undefined,
        ownerPhone: owner?.phone ?? undefined,
        reminderId: r.id,
        notes: r.notes ?? undefined,
      };
    });

    return [...fromVaccines, ...fromReminders];
  }, [vaccinesDue, careReminders, profileById]);

  const urgentHealthAlertsCount = useMemo(() => {
    const today = todayISODate();
    return healthAlertItems.filter((a) => a.dueDate <= today).length;
  }, [healthAlertItems]);

  const urgentHealthPetsCount = useMemo(() => {
    const today = todayISODate();
    const urgentPetKeys = new Set<string>();
    for (const item of healthAlertItems) {
      if (item.dueDate <= today) {
        const key = item.petId || `${item.petName}-${item.ownerId || "anon"}`;
        urgentPetKeys.add(key);
      }
    }
    return urgentPetKeys.size;
  }, [healthAlertItems]);

  // Sincronização exata com o Kanban de hoje para Táxis / Delivery
  const todayTaxiItems = useMemo(() => {
    return kanbanItems.filter(
      (i) =>
        Boolean(i.logisticsType && i.logisticsType !== "levar") &&
        i.status !== "cancelado" &&
        i.opsStatus !== "cancelado"
    );
  }, [kanbanItems]);

  const todayTaxiActive = useMemo(() => {
    return todayTaxiItems.filter(
      (i) =>
        i.status !== "concluido" &&
        i.opsStatus !== "entregue" &&
        i.opsStatus !== "finalizado"
    );
  }, [todayTaxiItems]);

  const todayTaxiInRoute = useMemo(() => {
    return todayTaxiActive.filter((i) =>
      [
        "em_deslocamento_retirada",
        "retirado_em_transito_loja",
        "em_rota_devolucao",
        "cheguei_retirada",
        "pronto_para_devolucao",
      ].includes(i.opsStatus || "")
    );
  }, [todayTaxiActive]);

  const activeDeliveriesCount = todayTaxiActive.length;
  const inRouteDeliveriesCount = todayTaxiInRoute.length;

  // Estatísticas e faturamento em tempo real sincronizados com o Kanban Operacional
  const kanbanStats = useMemo(() => {
    const active = kanbanItems.filter(
      (i) => i.status !== "cancelado" && i.opsStatus !== "cancelado",
    );
    const completed = active.filter(
      (i) =>
        i.status === "concluido" ||
        i.opsStatus === "entregue" ||
        (i.opsStatus === "concluido" && (!i.logisticsType || i.logisticsType === "levar")),
    );
    const inProgress = active.filter(
      (i) =>
        !completed.includes(i) &&
        (i.opsStatus === "em_atendimento" ||
          i.opsStatus === "em_deslocamento_retirada" ||
          i.opsStatus === "em_rota_devolucao" ||
          i.opsStatus === "retirado_em_transito_loja" ||
          i.opsStatus === "cheguei_retirada" ||
          i.opsStatus === "pronto_para_devolucao"),
    );
    const waiting = active.filter(
      (i) => !inProgress.includes(i) && !completed.includes(i),
    );
    const completedRevenueCents = completed.reduce(
      (sum, i) => sum + (i.totalCents || 0),
      0,
    );

    return {
      totalActive: active.length,
      inProgressCount: inProgress.length,
      waitingCount: waiting.length,
      completedCount: completed.length,
      completedRevenueCents,
    };
  }, [kanbanItems]);

  const todayServicesCount = kanbanStats.totalActive;
  const inProgressServicesCount = kanbanStats.inProgressCount;

  // Contadores por categoria sincronizados com os itens operacionais do dia
  const todayCategoryCounts = useMemo(() => {
    const active = kanbanItems.filter((i) => i.status !== "cancelado" && i.opsStatus !== "cancelado");
    const counts: Record<(typeof serviceCategories)[number], number> = {
      banho: 0,
      tosa: 0,
      veterinario: 0,
    };
    for (const item of active) {
      const cat = (item.serviceCategory || "").toLowerCase().trim();
      const name = (item.serviceName || "").toLowerCase().trim();
      if (cat === "tosa" || name.includes("tosa na tesoura") || name.includes("tosa geral")) {
        counts.tosa += 1;
      } else if (cat === "veterinario" || cat === "clinica" || name.includes("consulta") || name.includes("veterin")) {
        counts.veterinario += 1;
      } else {
        counts.banho += 1;
      }
    }
    return counts;
  }, [kanbanItems]);

  const totalActiveKanbanItems = useMemo(() => {
    return kanbanItems.filter((i) => i.status !== "cancelado" && i.opsStatus !== "cancelado").length;
  }, [kanbanItems]);

  const cancelAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelado", ops_status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      toast.success("Agendamento cancelado");
    },
    onError: () => toast.error("Não foi possível cancelar o agendamento"),
  });

  const handleKanbanAdvance = async (item: KanbanItem) => {
    if (item.status === "pendente") {
      confirmAppointment.mutate({
        id: item.id,
        user_id: item.userId,
        scheduled_at: item.scheduledAt,
        services: { name: item.serviceName },
        pets: { name: item.petName },
      });
      return;
    }

    try {
      if (item.opsStatus !== "em_atendimento") {
        // INICIAR ATENDIMENTO (da coluna Aguardando Início para Em Andamento)
        const { error: apptError } = await supabase
          .from("appointments")
          .update({
            ops_status: "em_atendimento",
            status: "confirmado",
          })
          .eq("id", item.id);
        if (apptError) throw apptError;

        if (user?.id) {
          await supabase.from("pet_status_history").insert({
            appointment_id: item.id,
            status: "em_atendimento",
            created_by: user.id,
            note: `Atendimento do ${item.petName} iniciado`,
          });
        }

        playStatusSound("atendimento", 3);
        toast.success(`Atendimento do ${item.petName} iniciado! 🥳✂️`);
      } else {
        // CONCLUIR ATENDIMENTO (da coluna Em Andamento para Pronto / Concluído)
        const hasReturnTransport =
          item.logisticsType === "buscar_e_devolver" || item.logisticsType === "devolver";
        const nextOps = "servico_concluido";
        const nextStatus = hasReturnTransport ? "confirmado" : "concluido";

        const { error: apptError } = await supabase
          .from("appointments")
          .update({
            ops_status: nextOps,
            status: nextStatus,
          })
          .eq("id", item.id);
        if (apptError) throw apptError;

        if (user?.id) {
          await supabase.from("pet_status_history").insert({
            appointment_id: item.id,
            status: "servico_concluido",
            created_by: user.id,
            note: `Atendimento do ${item.petName} concluído`,
          });
        }

        playStatusSound("confirmado", 3);
        toast.success(
          hasReturnTransport
            ? `Atendimento de ${item.petName} concluído! Pronto para devolução pelo motorista 🚗✨`
            : `Atendimento de ${item.petName} concluído com sucesso! ✨`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dash-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["home-active-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transport-history", item.id] });
      queryClient.invalidateQueries({ queryKey: ["transport-history"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status do atendimento");
    }
  };

  if (authLoading || (user && adminLoading)) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Carregando painel administrativo...
      </div>
    );
  }

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
    <div className="p-4 space-y-4">
      {/* 1. CABEÇALHO EXECUTIVO E DESPOLUÍDO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-3xl border border-border/70 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Central de Operações · Loja Aberta
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5 text-foreground">
            Painel Administrativo
          </h1>
          <p className="text-xs text-muted-foreground">
            {CLINIC.name} · {CLINIC.unit} (Franco da Rocha)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted"
          >
            <Link to="/conta">
              <User className="h-4 w-4 text-muted-foreground" />
              Minha Conta (Tutor)
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted"
          >
            <Link to="/" search={{ preview: "cliente" }}>
              <Eye className="h-4 w-4 text-muted-foreground" />
              Ver como Cliente
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted bg-amber-500/10 text-amber-950 dark:text-amber-200 border-amber-500/30 hover:bg-amber-500/20"
          >
            <Link to="/motorista">
              <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Painel do Motorista
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openMiroModal()}
            className="h-9 px-3.5 rounded-xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Matriz Miro (QA)
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setCurrentTab("comunicacao");
              openInAppChat();
            }}
            className={cn(
              "h-9 px-3.5 rounded-xl text-xs font-bold gap-2 transition-all shadow-xs cursor-pointer",
              totalChatUnread > 0
                ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400/50 animate-pulse"
                : openConversations.length > 0
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Central de Chat
            {totalChatUnread > 0 ? (
              <span className="bg-white text-rose-900 animate-pulse text-[10px] py-0 px-1.5 h-5 font-black shadow-xs rounded-full inline-flex items-center">
                {totalChatUnread} nova{totalChatUnread > 1 ? "s" : ""}
              </span>
            ) : openConversations.length > 0 ? (
              <span className="text-[11px] font-semibold text-primary-foreground/80">
                ({openConversations.length})
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* 2. KPIS RÁPIDOS NO TOPO (PÍLULAS OPERACIONAIS SINCRONIZADAS) */}
      <AdminKpiPills
        pendingAppointmentsCount={pendingAppointmentsCount}
        onNavigateToAgenda={handleNavigateToAgenda}
        unreadChatCount={totalChatUnread}
        totalChatConversations={openConversations.length}
        activeDeliveriesCount={activeDeliveriesCount}
        todayTaxiCount={todayTaxiItems.length}
        inRouteDeliveriesCount={inRouteDeliveriesCount}
        todayServicesCount={todayServicesCount}
        inProgressServicesCount={inProgressServicesCount}
        waitingServicesCount={kanbanStats.waitingCount}
        completedServicesCount={kanbanStats.completedCount}
        pendingHealthAlertsCount={healthAlertItems.length}
        urgentHealthAlertsCount={urgentHealthAlertsCount}
        urgentHealthPetsCount={urgentHealthPetsCount}
        criticalStockCount={curveACriticalAlerts.length}
        pendingOrdersCount={pendingOrdersCount}
        todayOrdersCount={todayOrdersCount}
        onNavigateToOrders={handleNavigateToOrders}
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      />

      {/* 3. FILTROS RÁPIDOS: TODOS, BANHO & TOSA, TÁXI PET */}
      <div className="mt-4 flex items-center justify-between gap-2.5 bg-card p-2.5 sm:p-3 rounded-2xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={kanbanFilterType === "todos" ? "default" : "outline"}
            onClick={() => {
              setKanbanFilterType("todos");
              if (currentTab !== "hoje") setCurrentTab("hoje");
            }}
            className="h-8 rounded-xl text-xs font-semibold px-3 cursor-pointer"
          >
            Todos ({totalActiveKanbanItems})
          </Button>
          <Button
            size="sm"
            variant={kanbanFilterType === "banho" ? "default" : "outline"}
            onClick={() => {
              setKanbanFilterType("banho");
              if (currentTab !== "hoje") setCurrentTab("hoje");
            }}
            className="h-8 rounded-xl text-xs font-semibold px-3 gap-1 cursor-pointer"
          >
            <Scissors className="h-3.5 w-3.5" />
            Banho & Tosa
          </Button>
          <Button
            size="sm"
            variant={kanbanFilterType === "delivery" ? "default" : "outline"}
            onClick={() => {
              setKanbanFilterType("delivery");
              if (currentTab !== "hoje") setCurrentTab("hoje");
            }}
            className="h-8 rounded-xl text-xs font-semibold px-3 gap-1 cursor-pointer"
          >
            <Truck className="h-3.5 w-3.5" />
            Táxi Pet
          </Button>
        </div>
      </div>

      {/* 4. ABAS PRINCIPAIS DE NAVEGAÇÃO */}
      <Tabs
        value={currentTab}
        onValueChange={(val) => {
          setCurrentTab(val);
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        className="mt-3"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 bg-muted/70 rounded-2xl gap-1">
          <TabsTrigger
            value="hoje"
            className="group h-11 rounded-xl text-xs font-bold gap-1.5 px-3 transition-all text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/40 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-md [&[data-state=active]>svg]:text-white [&[data-state=active]>span]:text-white cursor-pointer"
          >
            <Scissors className="h-4 w-4 text-primary transition-colors shrink-0" />
            <span>Operacional (Hoje)</span>
            {todayServicesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 group-data-[state=active]:bg-white group-data-[state=active]:text-primary transition-colors">
                {todayServicesCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="comunicacao"
            className="group h-11 rounded-xl text-xs font-bold gap-1.5 px-3 transition-all text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/40 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-md [&[data-state=active]>svg]:text-white [&[data-state=active]>span]:text-white cursor-pointer"
          >
            <MessageCircle className="h-4 w-4 text-primary transition-colors shrink-0" />
            <span>Atendimento & Chat</span>
            {unreadConversationsCount > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white animate-pulse shadow-xs">
                {unreadConversationsCount}
              </span>
            ) : openConversations.length > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 group-data-[state=active]:bg-white group-data-[state=active]:text-primary transition-colors">
                {openConversations.length}
              </span>
            ) : null}
          </TabsTrigger>

          <TabsTrigger
            value="saude"
            className="group h-11 rounded-xl text-xs font-bold gap-1.5 px-3 transition-all text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/40 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-md [&[data-state=active]>svg]:text-white [&[data-state=active]>span]:text-white cursor-pointer"
          >
            <Syringe className="h-4 w-4 text-primary transition-colors shrink-0" />
            <span>Saúde & Retornos</span>
            {urgentHealthPetsCount > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
                {urgentHealthPetsCount}
              </span>
            ) : healthAlertItems.length > 0 ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 group-data-[state=active]:bg-white group-data-[state=active]:text-primary transition-colors">
                {healthAlertItems.length}
              </span>
            ) : null}
          </TabsTrigger>

          <TabsTrigger
            value="gestao"
            className="group h-11 rounded-xl text-xs font-bold gap-1.5 px-3 transition-all text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/40 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-md [&[data-state=active]>svg]:text-white [&[data-state=active]>span]:text-white cursor-pointer"
          >
            <Settings className="h-4 w-4 text-primary transition-colors shrink-0" />
            <span>Gestão & Cadastros</span>
            {curveACriticalAlerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 shadow-xs">
                ⚠️
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: OPERACIONAL (HOJE) */}
        <TabsContent value="hoje" className="mt-4 space-y-4">
          {/* Resumo de Agendamentos e Faturamento do Dia (Posicionado no Topo) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-3 shadow-card border border-border/70">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                Agendamentos por Categoria
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border/60">
                      <th className="py-1 pr-2 font-medium">Categoria</th>
                      <th className="px-2 py-1 text-center font-medium">Hoje</th>
                      <th className="px-2 py-1 text-center font-medium">Semana</th>
                      <th className="px-2 py-1 text-center font-medium">Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceCategories.map((cat) => (
                      <tr key={cat} className="border-t border-border/40">
                        <td className="py-1.5 pr-2">{serviceCategoryLabels[cat]}</td>
                        <td className="px-2 py-1.5 text-center font-semibold text-foreground">
                          {Math.max(dashboardStats.apptByCategory[cat]?.day ?? 0, todayCategoryCounts[cat] ?? 0)}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold">
                          {dashboardStats.apptByCategory[cat]?.week ?? 0}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold">
                          {dashboardStats.apptByCategory[cat]?.month ?? 0}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-bold text-primary">
                      <td className="py-1.5 pr-2">Total</td>
                      <td className="px-2 py-1.5 text-center">
                        {Math.max(
                          dashboardStats.apptTotal.day,
                          kanbanStats.totalActive,
                          todayCategoryCounts.banho + todayCategoryCounts.tosa + todayCategoryCounts.veterinario
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">{dashboardStats.apptTotal.week}</td>
                      <td className="px-2 py-1.5 text-center">{dashboardStats.apptTotal.month}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-3 shadow-card border border-border/70">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                Produtos por Categoria
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border/60">
                      <th className="py-1 pr-2 font-medium">Categoria</th>
                      <th className="px-2 py-1 text-center font-medium">Hoje</th>
                      <th className="px-2 py-1 text-center font-medium">Semana</th>
                      <th className="px-2 py-1 text-center font-medium">Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardProductCategories.map((cat) => (
                      <tr key={cat} className="border-t border-border/40">
                        <td className="py-1.5 pr-2">
                          {productCategoryLabels[cat] || capitalizeWords(cat)}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold text-foreground">
                          {productStats.byCategory[cat]?.day ?? 0}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold">
                          {productStats.byCategory[cat]?.week ?? 0}
                        </td>
                        <td className="px-2 py-1.5 text-center font-semibold">
                          {productStats.byCategory[cat]?.month ?? 0}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border font-bold text-primary">
                      <td className="py-1.5 pr-2">Total</td>
                      <td className="px-2 py-1.5 text-center">{productStats.total.day}</td>
                      <td className="px-2 py-1.5 text-center">{productStats.total.week}</td>
                      <td className="px-2 py-1.5 text-center">{productStats.total.month}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Kanban Operacional do Dia (3 Etapas: Aguardando -> Em Andamento -> Pronto/Concluído) */}
          <AdminOperationalKanban
            items={kanbanItems}
            filterType={kanbanFilterType}
            onFilterTypeChange={setKanbanFilterType}
            hideTopFilterBar={true}
            onAdvanceStatus={handleKanbanAdvance}
            onConfirmAppointment={(appointmentId) => {
              const appt = (appointments ?? []).find((a) => a.id === appointmentId);
              if (appt) confirmAppointment.mutate(appt);
            }}
            onCancelAppointment={(appointmentId) => cancelAppointment.mutate(appointmentId)}
            onOpenPetRecord={(petId) => {
              setRecordPetId(petId);
              setCurrentTab("gestao");
              setGestaoSubTab("clinica");
            }}
          />

          {/* Aniversariantes de Hoje e Amanhã */}
          {birthdaysSoon.length > 0 && (
            <div className="rounded-2xl border border-gold/50 bg-secondary/50 p-3 shadow-xs">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
                <Gift className="h-4 w-4 text-gold" />
                Nivers de hoje e amanhã ({birthdaysSoon.length})
              </p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div key={entry.key} className="rounded-xl bg-card p-2.5 shadow-xs border border-border/60">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-foreground truncate">
                          {entry.kind === "pet" ? entry.petName : entry.ownerName}
                          {entry.kind === "pet" && (
                            <span className="ml-1 font-normal text-muted-foreground text-[11px]">
                              · {entry.ownerName}
                            </span>
                          )}
                        </p>
                        <Badge variant={isToday ? "default" : "secondary"} className="shrink-0 text-[10px] py-0">
                          {isToday ? "Hoje" : "Amanhã"}
                        </Badge>
                      </div>
                      {link && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-2 h-7 w-full rounded-lg text-xs font-semibold"
                          onClick={() => {
                            window.open(link, "_blank", "noopener,noreferrer");
                            markBirthdayMessageSent.mutate(entry.ownerId);
                          }}
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          Parabéns no WhatsApp
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ABA 2: ATENDIMENTO & CHAT */}
        <TabsContent value="comunicacao" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-card">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Fila de Chamados Recentes ({openConversations.length})
                </h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-bold rounded-lg"
                onClick={() => openInAppChat()}
              >
                Abrir Drawer de Chat
              </Button>
            </div>

            <div className="mt-3 space-y-2">
              {openConversations.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                  Nenhum chamado em aberto no momento. Todas as conversas estão em dia!
                </div>
              ) : (
                openConversations.slice(0, 5).map((conv) => {
                  const hasUnread = conv.unreadCountStore > 0;
                  return (
                    <div
                      key={conv.conversationId}
                      className={cn(
                        "rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs",
                        hasUnread
                          ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-border/70 bg-card"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-foreground">{conv.tutorName}</span>
                          {conv.petName && (
                            <Badge variant="secondary" className="text-[10px] py-0 font-bold">
                              🐾 {conv.petName}
                            </Badge>
                          )}
                          {hasUnread && (
                            <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1.5 font-bold">
                              {conv.unreadCountStore} nova(s)
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          "{conv.lastMessageText}"
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() =>
                          openInAppChat({
                            conversationId: conv.conversationId,
                            tutorName: conv.tutorName,
                            petName: conv.petName ?? undefined,
                            contextTag: conv.contextTag ?? undefined,
                          })
                        }
                        className="h-8 rounded-xl text-xs font-semibold gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Responder
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div id="tab-atendimentos-section">
            <AdminChatLogs />
          </div>
        </TabsContent>

        {/* ABA 3: PEDIDOS NA LOJA (PRODUTOS) */}
        <TabsContent value="pedidos" className="mt-4 space-y-4">
          <AdminOrdersManager
            orders={orders ?? []}
            getClientAbcInfo={getClientAbcInfo}
            onUpdateOrderStatus={(id, status) => updateOrder.mutate({ id, status })}
            isUpdatingStatus={updateOrder.isPending}
            criticalStockCount={curveACriticalAlerts.length}
            onNavigateToProducts={() => {
              setCurrentTab("gestao");
              setGestaoSubTab("produtos");
            }}
          />
        </TabsContent>

        {/* Fallback de compatibilidade caso acesse via rota direta ?tab=saude */}
        <TabsContent value="saude" className="mt-4 space-y-4">
          <AdminHealthAlertsGrouped
            alerts={healthAlertItems}
            onCompleteReminder={(reminderId) => completeReturnReminder.mutate(reminderId)}
            onOpenPetRecord={(petId) => {
              setRecordPetId(petId);
              setCurrentTab("gestao");
              setGestaoSubTab("clinica");
            }}
          />
        </TabsContent>

        {/* ABA 4: GESTÃO & CADASTROS */}
        <TabsContent value="gestao" className="mt-4 space-y-4">
          <Tabs value={gestaoSubTab} onValueChange={setGestaoSubTab}>
            <TabsList className="flex w-full items-center justify-start gap-1 overflow-x-auto pb-1 bg-muted/60 p-1 rounded-2xl">
              <TabsTrigger value="clientes" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Clientes
              </TabsTrigger>
              <TabsTrigger value="novo-cliente" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                + Novo Cliente
              </TabsTrigger>
              <TabsTrigger value="relatorios" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Relatórios (Curva ABC)
              </TabsTrigger>
              <TabsTrigger value="pedidos" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Pedidos Loja
              </TabsTrigger>
              <TabsTrigger value="servicos" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Serviços
              </TabsTrigger>
              <TabsTrigger value="produtos" className="group rounded-xl text-xs font-bold gap-1 shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Produtos
                {curveACriticalAlerts.length > 0 && (
                  <Badge className="bg-amber-500 text-white text-[9px] py-0 px-1 font-bold group-data-[state=active]:bg-amber-300 group-data-[state=active]:text-amber-950">
                    ⚠️ {curveACriticalAlerts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="clinica" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Prontuários / Clínica
              </TabsTrigger>
              <TabsTrigger value="saude" className="group rounded-xl text-xs font-bold gap-1 shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Saúde & Retornos
                {urgentHealthPetsCount > 0 ? (
                  <Badge className="ml-1 bg-rose-500 text-white text-[9px] py-0 px-1 font-bold">
                    {urgentHealthPetsCount}
                  </Badge>
                ) : healthAlertItems.length > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-800 group-data-[state=active]:bg-white group-data-[state=active]:text-primary">
                    {healthAlertItems.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="agenda" className="group rounded-xl text-xs font-bold gap-1 shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Agendamentos Detalhados
                {pendingAppointmentsCount > 0 && (
                  <Badge className="bg-amber-500 text-slate-950 text-[9px] py-0 px-1.5 font-black animate-pulse group-data-[state=active]:bg-amber-300 group-data-[state=active]:text-amber-950">
                    Confirmar ({pendingAppointmentsCount})
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="retirada-entrega" className="rounded-xl text-xs font-bold shrink-0 text-slate-700 dark:text-slate-200 hover:text-foreground hover:bg-card/50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-extrabold data-[state=active]:shadow-sm cursor-pointer">
                Logística Completa
              </TabsTrigger>
            </TabsList>

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
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Endereço (opcional — para Táxi Pet / Delivery)
                  </p>
                  {isCepLoading && (
                    <span className="text-[11px] font-semibold text-primary animate-pulse">
                      Buscando CEP...
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <Label htmlFor="nc-cep">CEP</Label>
                      <Input
                        id="nc-cep"
                        placeholder="00000-000"
                        maxLength={9}
                        value={newClientAddress.cep}
                        onChange={(e) => handleNewClientCepChange(e.target.value)}
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="nc-street">Rua / Logradouro</Label>
                      <Input
                        id="nc-street"
                        placeholder="Ex: Rua Nelson Rodrigues"
                        value={newClientAddress.street}
                        maxLength={150}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, street: e.target.value })
                        }
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="nc-number">Número</Label>
                      <Input
                        id="nc-number"
                        placeholder="Ex: 120"
                        value={newClientAddress.number}
                        maxLength={20}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, number: e.target.value })
                        }
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="nc-complement">Complemento</Label>
                      <Input
                        id="nc-complement"
                        placeholder="Ex: Apto 42, Bloco B"
                        value={newClientAddress.complement}
                        maxLength={50}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, complement: e.target.value })
                        }
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="nc-district">Bairro</Label>
                      <Input
                        id="nc-district"
                        placeholder="Ex: Centro"
                        value={newClientAddress.district}
                        maxLength={100}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, district: e.target.value })
                        }
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nc-reference">Ponto de referência</Label>
                      <Input
                        id="nc-reference"
                        placeholder="Ex: Próximo à estação"
                        value={newClientAddress.reference}
                        maxLength={150}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, reference: e.target.value })
                        }
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label htmlFor="nc-city">Cidade</Label>
                      <Input
                        id="nc-city"
                        placeholder="Ex: Franco da Rocha"
                        value={newClientAddress.city}
                        maxLength={100}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, city: e.target.value })
                        }
                        className="mt-1 h-10 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nc-state">UF</Label>
                      <Input
                        id="nc-state"
                        placeholder="SP"
                        value={newClientAddress.state}
                        maxLength={2}
                        onChange={(e) =>
                          setNewClientAddress({ ...newClientAddress, state: e.target.value.toUpperCase() })
                        }
                        className="mt-1 h-10 rounded-xl uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-card p-3 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Pet (opcional)
                </p>
                <div className="mb-3">
                  <PetPhotoUpload
                    value={newClientPet.photoUrl}
                    onChange={(photoUrl) => setNewClientPet({ ...newClientPet, photoUrl })}
                    petName={newClientPet.name || "Pet"}
                  />
                </div>
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
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Porte do pet</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["pequeno", "medio", "grande"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewClientPet({ ...newClientPet, size: s })}
                          className={cn(
                            "rounded-xl border py-2 text-xs font-medium transition-colors",
                            newClientPet.size === s
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:bg-secondary/50",
                          )}
                        >
                          {petSizeLabels[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="nc-pet-weight" className="text-xs text-muted-foreground">
                      Peso estimado (kg, opcional)
                    </Label>
                    <Input
                      id="nc-pet-weight"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 8.5"
                      value={newClientPet.weightKg}
                      maxLength={6}
                      onChange={(e) =>
                        setNewClientPet({ ...newClientPet, weightKg: e.target.value })
                      }
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
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
              placeholder="Buscar por nome, telefone, CPF, pet ou endereço"
              className="h-11 rounded-2xl pl-9"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {clientDirectory.length} cliente{clientDirectory.length === 1 ? "" : "s"}
          </p>

          <div className="space-y-2">
            {clientDirectory.map((client) => {
              const editingThis = editingDirectoryClientId === client.id;
              const defaultAddr =
                (client.addresses ?? []).find((a) => a.is_default) ?? client.addresses?.[0];

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

                      {/* Campos de Endereço no Diretório */}
                      <div className="rounded-xl border border-border p-2.5 space-y-2 bg-muted/20">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Endereço do cliente</Label>
                          {isDirectoryCepLoading && (
                            <span className="text-[10px] font-semibold text-primary animate-pulse">
                              Buscando CEP...
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label htmlFor={`dc-cep-${client.id}`} className="text-[11px] text-muted-foreground">
                              CEP
                            </Label>
                            <Input
                              id={`dc-cep-${client.id}`}
                              placeholder="00000-000"
                              maxLength={9}
                              value={directoryClientForm.cep}
                              onChange={(e) => handleDirectoryCepChange(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor={`dc-street-${client.id}`} className="text-[11px] text-muted-foreground">
                              Rua
                            </Label>
                            <Input
                              id={`dc-street-${client.id}`}
                              value={directoryClientForm.street}
                              placeholder="Rua / Logradouro"
                              maxLength={150}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  street: e.target.value,
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label htmlFor={`dc-num-${client.id}`} className="text-[11px] text-muted-foreground">
                              Número
                            </Label>
                            <Input
                              id={`dc-num-${client.id}`}
                              value={directoryClientForm.number}
                              placeholder="Nº"
                              maxLength={20}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  number: e.target.value,
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor={`dc-comp-${client.id}`} className="text-[11px] text-muted-foreground">
                              Complemento
                            </Label>
                            <Input
                              id={`dc-comp-${client.id}`}
                              value={directoryClientForm.complement}
                              placeholder="Apto / Bloco"
                              maxLength={50}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  complement: e.target.value,
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor={`dc-dist-${client.id}`} className="text-[11px] text-muted-foreground">
                              Bairro
                            </Label>
                            <Input
                              id={`dc-dist-${client.id}`}
                              value={directoryClientForm.district}
                              placeholder="Bairro"
                              maxLength={100}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  district: e.target.value,
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`dc-ref-${client.id}`} className="text-[11px] text-muted-foreground">
                              Referência
                            </Label>
                            <Input
                              id={`dc-ref-${client.id}`}
                              value={directoryClientForm.reference}
                              placeholder="Ref."
                              maxLength={150}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  reference: e.target.value,
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="col-span-2">
                            <Label htmlFor={`dc-city-${client.id}`} className="text-[11px] text-muted-foreground">
                              Cidade
                            </Label>
                            <Input
                              id={`dc-city-${client.id}`}
                              value={directoryClientForm.city}
                              placeholder="Cidade"
                              maxLength={100}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  city: e.target.value,
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`dc-state-${client.id}`} className="text-[11px] text-muted-foreground">
                              UF
                            </Label>
                            <Input
                              id={`dc-state-${client.id}`}
                              value={directoryClientForm.state}
                              placeholder="SP"
                              maxLength={2}
                              onChange={(e) =>
                                setDirectoryClientForm({
                                  ...directoryClientForm,
                                  state: e.target.value.toUpperCase(),
                                })
                              }
                              className="mt-1 h-9 rounded-lg text-xs uppercase"
                            />
                          </div>
                        </div>
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
                              const addr = (client.addresses ?? []).find((a) => a.is_default) ?? client.addresses?.[0];
                              setEditingDirectoryClientId(client.id);
                              setDirectoryClientForm({
                                fullName: client.full_name ?? "",
                                phone: "",
                                birthDate: client.birth_date ?? "",
                                cep: addr?.cep ?? "",
                                street: addr?.street ?? "",
                                number: addr?.number ?? "",
                                complement: addr?.complement ?? "",
                                district: addr?.district ?? "",
                                city: addr?.city ?? "Franco da Rocha",
                                state: addr?.state ?? "SP",
                                reference: addr?.reference ?? "",
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

                        {defaultAddr ? (
                          <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>
                              {defaultAddr.street}
                              {defaultAddr.number ? `, ${defaultAddr.number}` : ""}
                              {defaultAddr.complement ? ` - ${defaultAddr.complement}` : ""} —{" "}
                              {defaultAddr.district}
                              {defaultAddr.city && defaultAddr.city.toLowerCase() !== defaultAddr.district?.toLowerCase()
                                ? `, ${defaultAddr.city}`
                                : ""}
                              {defaultAddr.state ? ` - ${defaultAddr.state}` : ""}
                              {defaultAddr.cep ? ` (${defaultAddr.cep})` : ""}
                            </span>
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDirectoryClientId(client.id);
                              setDirectoryClientForm({
                                fullName: client.full_name ?? "",
                                phone: client.phone ?? "",
                                birthDate: client.birth_date ?? "",
                                cep: "",
                                street: "",
                                number: "",
                                complement: "",
                                district: "",
                                city: "Franco da Rocha",
                                state: "SP",
                                reference: "",
                              });
                            }}
                            className="mt-1 text-xs font-semibold text-primary underline block"
                          >
                            + Adicionar endereço
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Editar cliente"
                        onClick={() => {
                          const addr = (client.addresses ?? []).find((a) => a.is_default) ?? client.addresses?.[0];
                          setEditingDirectoryClientId(client.id);
                          setDirectoryClientForm({
                            fullName: client.full_name ?? "",
                            phone: client.phone ?? "",
                            birthDate: client.birth_date ?? "",
                            cep: addr?.cep ?? "",
                            street: addr?.street ?? "",
                            number: addr?.number ?? "",
                            complement: addr?.complement ?? "",
                            district: addr?.district ?? "",
                            city: addr?.city ?? "Franco da Rocha",
                            state: addr?.state ?? "SP",
                            reference: addr?.reference ?? "",
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
                          <div key={pet.id} className="rounded-xl surface-paper p-2.5 space-y-2">
                            <PetPhotoUpload
                              value={directoryPetForm.photoUrl}
                              onChange={(photoUrl) =>
                                setDirectoryPetForm({ ...directoryPetForm, photoUrl })
                              }
                              petName={directoryPetForm.name || pet.name}
                            />
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                                  Porte
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                  {(["pequeno", "medio", "grande"] as const).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() =>
                                        setDirectoryPetForm({ ...directoryPetForm, size: s })
                                      }
                                      className={cn(
                                        "rounded-lg border py-1 text-[11px] font-medium transition-colors",
                                        directoryPetForm.size === s
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border bg-card text-muted-foreground hover:bg-secondary/50",
                                      )}
                                    >
                                      {petSizeLabels[s]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                                  Peso (kg)
                                </label>
                                <Input
                                  value={directoryPetForm.weightKg}
                                  maxLength={6}
                                  inputMode="decimal"
                                  placeholder="Ex: 8.5"
                                  onChange={(e) =>
                                    setDirectoryPetForm({
                                      ...directoryPetForm,
                                      weightKg: e.target.value,
                                    })
                                  }
                                  className="h-8 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-0.5">
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
                            <div className="flex items-center gap-2 min-w-0">
                              <PetAvatar
                                photoUrl={pet.photo_url}
                                name={pet.name}
                                species={pet.species}
                                size="sm"
                              />
                              <span className="min-w-0 truncate">
                                <span className="font-semibold">{capitalizeWords(pet.name)}</span>
                                {pet.breed && (
                                  <span className="text-muted-foreground"> · {pet.breed}</span>
                                )}
                                {pet.size && (
                                  <span className="ml-1.5 inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                                    Porte {petSizeLabels[pet.size as PetSize]?.toLowerCase() || pet.size}
                                  </span>
                                )}
                                {pet.weight_kg != null && (
                                  <span className="ml-1 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    {Number(pet.weight_kg).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                                  </span>
                                )}
                                {pet.birth_date && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    · {formatDate(pet.birth_date)}
                                  </span>
                                )}
                              </span>
                            </div>
                            <button
                              type="button"
                              aria-label={`Editar ${pet.name}`}
                              onClick={() => {
                                setEditingDirectoryPetId(pet.id);
                                setDirectoryPetForm({
                                  name: pet.name,
                                  breed: pet.breed ?? "",
                                  size: (pet.size as PetSize) || "medio",
                                  weightKg: pet.weight_kg != null ? String(pet.weight_kg).replace(".", ",") : "",
                                  photoUrl: pet.photo_url || null,
                                });
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
            <button
              type="button"
              onClick={() => setReportSubTab("entregas-motoristas")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                reportSubTab === "entregas-motoristas"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              🚚 Entregas & Motoristas
            </button>
            <button
              type="button"
              onClick={() => setReportSubTab("atendimentos-periodo")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                reportSubTab === "atendimentos-periodo"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              📅 Atendimentos por Período
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

      {reportSubTab === "entregas-motoristas" && <RelatorioEntregasMotoristas />}
      {reportSubTab === "atendimentos-periodo" && <RelatorioAtendimentosPeriodo />}
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
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all",
                    recordPetId === pet.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  <PetAvatar
                    photoUrl={pet.photo_url}
                    name={pet.name}
                    species={pet.species}
                    size="xs"
                  />
                  <span>{capitalizeWords(pet.name)}</span>
                </button>
              ))}
              {(allPets ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum pet cadastrado.</p>
              )}
            </div>
          </div>

          {selectedPet && (
            <div className="rounded-2xl bg-card p-3.5 shadow-card border border-border/60 flex items-center gap-3.5">
              <PetAvatar
                photoUrl={selectedPet.photo_url}
                name={selectedPet.name}
                species={selectedPet.species}
                size="lg"
                className="ring-2 ring-primary/20 shadow-xs"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-foreground truncate">
                    {capitalizeWords(selectedPet.name)}
                  </p>
                  <Link
                    to="/pets/$petId"
                    params={{ petId: selectedPet.id }}
                    className="text-xs font-semibold text-primary underline flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Ver Prontuário / Ficha</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {capitalizeWords(selectedPet.species)}
                  {selectedPet.breed ? ` · ${selectedPet.breed}` : ""}
                  {selectedPet.size ? ` · Porte ${petSizeLabels[selectedPet.size as PetSize]}` : ""}
                  {selectedPet.weight_kg != null ? ` · ${selectedPet.weight_kg} kg` : ""}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1.5">
                  <span className="bg-secondary px-2 py-0.5 rounded-md text-[11px]">
                    Temperamento: <strong className="text-foreground">{selectedPet.temperament ?? "não informado"}</strong>
                  </span>
                  <span className="bg-secondary px-2 py-0.5 rounded-md text-[11px]">
                    Alergias: <strong className="text-foreground">{selectedPet.allergies ?? "não informadas"}</strong>
                  </span>
                </div>
              </div>
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
          {/* Card de Configuração de Capacidade e Alertas Sonoros */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold">Capacidade de Atendimentos por Hora</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-xl text-xs gap-1.5"
                onClick={() => {
                  testSoundAlert("confirmado");
                  toast.success("Alerta sonoro testado com sucesso!");
                }}
              >
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                Testar Alerta Sonoro
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Define o número máximo de agendamentos simultâneos na mesma hora. Quando a capacidade for atingida, o horário ficará vermelho no agendamento do cliente e sugerirá o próximo horário livre.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Banhos por hora:</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="h-8 rounded-xl text-xs font-bold"
                  value={capacitySettings.maxBanhosPerHour}
                  onChange={(e) =>
                    setCapacitySettings((prev) => ({
                      ...prev,
                      maxBanhosPerHour: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tosas por hora:</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="h-8 rounded-xl text-xs font-bold"
                  value={capacitySettings.maxTosasPerHour}
                  onChange={(e) =>
                    setCapacitySettings((prev) => ({
                      ...prev,
                      maxTosasPerHour: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Consultas/Geral por hora:</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="h-8 rounded-xl text-xs font-bold"
                  value={capacitySettings.maxGeralPerHour}
                  onChange={(e) =>
                    setCapacitySettings((prev) => ({
                      ...prev,
                      maxGeralPerHour: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-xl text-xs font-semibold"
                onClick={handleSaveCapacity}
              >
                Salvar Limites de Capacidade
              </Button>
            </div>
          </div>

          <div id="agendamentos-detalhados-topo" />
          {pendingAppointmentsCount > 0 && (
            <div className="rounded-2xl border-2 border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 p-3 shadow-sm flex items-center justify-between gap-3 mb-2 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500 text-slate-950 font-bold shadow-xs">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-950 dark:text-amber-200">
                    {pendingAppointmentsCount} novo{pendingAppointmentsCount > 1 ? "s" : ""} pedido{pendingAppointmentsCount > 1 ? "s" : ""} de agendamento aguardando confirmação
                  </p>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                    Exibidos no topo da lista abaixo. Clique em &quot;Confirmar Agendamento&quot; para notificar o tutor e liberar o horário.
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-500 text-slate-950 font-black text-xs px-2 py-0.5 shrink-0 animate-pulse">
                {pendingAppointmentsCount} Pendente{pendingAppointmentsCount > 1 ? "s" : ""}
              </Badge>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Confirme os agendamentos pendentes para avisar o cliente automaticamente pelo WhatsApp.
          </p>

          {sortedAgendaAppointments.map((item, idx) => {
            const clientInfo = getClientAbcInfo(item.user_id);
            const clientName = profileById.get(item.user_id)?.full_name || clientInfo?.name;
            const inService = isAppointmentInService(item);
            const isPending = item.status === "pendente";

            return (
              <div
                key={item.id}
                id={isPending && idx === 0 ? "primeiro-agendamento-pendente" : undefined}
                className={cn(
                  "rounded-2xl p-3 shadow-card transition-all",
                  isPending
                    ? "border-2 border-amber-500 bg-amber-50/50 dark:border-amber-500/70 dark:bg-amber-950/30 ring-2 ring-amber-400/30 shadow-md"
                    : inService
                    ? "border-2 border-emerald-500/80 bg-emerald-50/50 dark:border-emerald-500/60 dark:bg-emerald-950/30 ring-1 ring-emerald-400/40 shadow-md"
                    : clientInfo?.abcClass === "A"
                    ? "border-2 border-emerald-500/50 bg-card"
                    : clientInfo?.abcClass === "B"
                    ? "border-2 border-blue-500/40 bg-card"
                    : "bg-card",
                )}
              >
                {isPending && (
                  <div className="mb-2 flex items-center justify-between gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-950 dark:text-amber-200">
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                      </span>
                      🟡 NOVO PEDIDO - AGUARDANDO CONFIRMAÇÃO DA LOJA
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Topo da Agenda
                    </span>
                  </div>
                )}
                {inService && (
                  <div className="mb-2 flex items-center justify-between gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
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
                  {clientInfo && clientInfo.ltvCents > 0 ? ` · Gasto Total: ${formatBRL(clientInfo.ltvCents)}` : ""}
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
                    className="mt-2.5 h-10 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md transition-all hover:scale-[1.005]"
                    disabled={confirmAppointment.isPending}
                    onClick={() => confirmAppointment.mutate(item)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    ✓ Confirmar Agendamento e Notificar Tutor
                  </Button>
                )}

              {/* Recebimento no Balcão da Loja (1 Toque) */}
              <div className="mt-2 rounded-xl border border-border/70 bg-background/60 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1 text-foreground">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    Pagamento no Balcão:
                  </span>
                  <span className="font-bold text-primary">
                    {item.total_cents ? formatBRL(item.total_cents) : "Valor sob consulta"}
                  </span>
                </div>

                {item.payment_status === "pago" ? (
                  <div className="mt-1.5 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ✓ Pago no Caixa via {item.payment_method?.toUpperCase() || "BALCÃO"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.paid_at ? new Date(item.paid_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Confirmado"}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <p className="text-[10px] text-muted-foreground">Receber no caixa com 1 toque:</p>
                    <div className="grid grid-cols-4 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={registerStorePayment.isPending}
                        className="h-7 rounded-lg text-[10px] font-bold border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                        onClick={() => registerStorePayment.mutate({ appointmentId: item.id, method: "credito" })}
                      >
                        <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                        Crédito
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={registerStorePayment.isPending}
                        className="h-7 rounded-lg text-[10px] font-bold border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
                        onClick={() => registerStorePayment.mutate({ appointmentId: item.id, method: "debito" })}
                      >
                        <CreditCard className="h-2.5 w-2.5 mr-0.5" />
                        Débito
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={registerStorePayment.isPending}
                        className="h-7 rounded-lg text-[10px] font-bold border-teal-500/30 text-teal-700 hover:bg-teal-500/10"
                        onClick={() => registerStorePayment.mutate({ appointmentId: item.id, method: "pix" })}
                      >
                        <QrCode className="h-2.5 w-2.5 mr-0.5" />
                        Pix
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={registerStorePayment.isPending}
                        className="h-7 rounded-lg text-[10px] font-bold border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                        onClick={() => registerStorePayment.mutate({ appointmentId: item.id, method: "dinheiro" })}
                      >
                        <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                        Dinheiro
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Chat Interno no App (Substituição do WhatsApp) */}
              <button
                type="button"
                onClick={() =>
                  openInAppChat({
                    contextTag: `Atendimento: ${item.services?.name ?? "Serviço"}`,
                    petName: item.pets?.name,
                    conversationId: item.user_id,
                    defaultText: `Olá ${clientName ? clientName : ""}! Estamos confirmando os detalhes do atendimento de ${item.pets?.name ?? "seu pet"} no Big Dog Pet.`,
                  })
                }
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Conversar no Chat do App (1 Toque)
              </button>

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
          {/* Painel do Simulador de Delivery / Táxi Pet */}
          {showDeliverySimulator ? (
            <DeliverySimulator
              currentUserId={user?.id ?? ""}
              onClose={() => setShowDeliverySimulator(false)}
            />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                  <Truck className="h-6 w-6" />
                </span>
                <div>
                  <h4 className="font-display text-base font-bold text-foreground">
                    🎮 Simulador de Delivery / Táxi Pet (Ao Vivo)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Simule a rota GPS pelas ruas de Franco da Rocha, retirada do pet, chegada à loja e retorno em tempo real a partir do seu PC.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setShowDeliverySimulator(true)}
                className="gap-2 font-bold shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                🎮 Abrir Simulador de Delivery
              </Button>
            </div>
          )}

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

          <div className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  Motoristas e Veículos de Transporte
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Designe motoristas para rotas de leva e traz. Moto atende apenas pets de pequeno porte; médio/grande exigem carro.
                </p>
              </div>

              <Dialog open={isNewDriverDialogOpen} onOpenChange={setIsNewDriverDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground">
                    <Plus className="h-3.5 w-3.5" />
                    + Novo Motorista
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-2xl p-5">
                  <DialogHeader>
                    <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" />
                      Cadastrar / Designar Motorista
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-xl">
                      <button
                        type="button"
                        onClick={() => setNewDriverMode("novo")}
                        className={cn(
                          "py-1.5 text-xs font-bold rounded-lg transition-all",
                          newDriverMode === "novo" ? "bg-card shadow-xs text-primary" : "text-muted-foreground",
                        )}
                      >
                        + Cadastrar Novo
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDriverMode("existente")}
                        className={cn(
                          "py-1.5 text-xs font-bold rounded-lg transition-all",
                          newDriverMode === "existente" ? "bg-card shadow-xs text-primary" : "text-muted-foreground",
                        )}
                      >
                        Promover Usuário
                      </button>
                    </div>

                    {newDriverMode === "novo" ? (
                      <div className="space-y-2.5">
                        <div>
                          <Label className="text-xs font-semibold">Nome Completo do Motorista *</Label>
                          <Input
                            placeholder="Ex: Carlos Motorista"
                            value={newDriverForm.name}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, name: e.target.value })}
                            className="mt-1 h-9 rounded-xl text-xs"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Telefone / WhatsApp *</Label>
                          <Input
                            placeholder="Ex: (11) 99999-9999"
                            value={newDriverForm.phone}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, phone: maskPhoneBR(e.target.value) })}
                            className="mt-1 h-9 rounded-xl text-xs"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">E-mail (opcional para login)</Label>
                          <Input
                            type="email"
                            placeholder="Ex: motorista@bigdog.com"
                            value={newDriverForm.email}
                            onChange={(e) => setNewDriverForm({ ...newDriverForm, email: e.target.value })}
                            className="mt-1 h-9 rounded-xl text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <Label className="text-xs font-semibold">Selecione o Usuário Cadastrado *</Label>
                        <Select
                          value={newDriverForm.existingUserId}
                          onValueChange={(val) => {
                            const foundProfile = profiles?.find((p) => p.id === val);
                            setNewDriverForm({
                              ...newDriverForm,
                              existingUserId: val,
                              name: foundProfile?.full_name || "Motorista",
                              phone: foundProfile?.phone || "",
                            });
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs">
                            <SelectValue placeholder="Escolha um cliente/usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            {(profiles ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.full_name || "Sem nome"} {p.phone ? `(${p.phone})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs font-semibold">Tipo de Veículo *</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setNewDriverForm({ ...newDriverForm, vehicleType: "carro" })}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            newDriverForm.vehicleType === "carro"
                              ? "border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/20"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          <p className="text-xs font-bold flex items-center gap-1.5">🚗 Carro</p>
                          <p className="text-[10px] mt-0.5 opacity-80">Permitido para pets Pequenos, Médios e Grandes</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewDriverForm({ ...newDriverForm, vehicleType: "moto" })}
                          className={cn(
                            "p-2.5 rounded-xl border text-left transition-all",
                            newDriverForm.vehicleType === "moto"
                              ? "border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/20"
                              : "border-border bg-card text-muted-foreground",
                          )}
                        >
                          <p className="text-xs font-bold flex items-center gap-1.5">🏍️ Moto</p>
                          <p className="text-[10px] mt-0.5 opacity-80">Apenas para pets de Porte Pequeno com caixa</p>
                        </button>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs"
                      onClick={() => setIsNewDriverDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl text-xs font-bold bg-primary text-primary-foreground"
                      onClick={() => {
                        if (!newDriverForm.name.trim()) {
                          toast.error("Informe o nome do motorista");
                          return;
                        }
                        registerNewDriver({
                          name: newDriverForm.name,
                          phone: newDriverForm.phone,
                          email: newDriverForm.email,
                          vehicleType: newDriverForm.vehicleType,
                          existingUserId: newDriverMode === "existente" ? newDriverForm.existingUserId : undefined,
                        });
                        setCustomDriversRevision((prev) => prev + 1);
                        setIsNewDriverDialogOpen(false);
                        setNewDriverForm({
                          name: "",
                          phone: "",
                          email: "",
                          vehicleType: "carro",
                          existingUserId: "",
                        });
                        toast.success("Motorista cadastrado com sucesso!");
                      }}
                    >
                      Salvar Motorista
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-3 space-y-2">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-xs hover:border-border transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-bold text-foreground">
                        {driver.full_name ?? driver.phone ?? driver.id.slice(0, 8)}
                      </p>
                      {driver.id === "33333333-3333-3333-3333-333333333333" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] py-0 px-1.5 border-0 font-bold">
                          Oficial
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground capitalize">
                        {driver.vehicle_type === "moto" ? "🏍️ Moto" : "🚗 Carro"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {driver.phone ? `📱 ${driver.phone}` : "Sem telefone"}
                      {driver.email ? ` · ✉️ ${driver.email}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Switcher de Veículo */}
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
                            "px-2.5 py-1 text-[11px] font-semibold transition-colors",
                            driver.vehicle_type === vehicle
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-card text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {vehicleTypeLabels[vehicle]}
                        </button>
                      ))}
                    </div>

                    {/* Botão Ver Rotas no Painel */}
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 rounded-lg text-[11px] font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Link to="/motorista" search={{ driverId: driver.id }}>
                        <Truck className="h-3 w-3" />
                        Ver Rotas
                      </Link>
                    </Button>

                    {/* Excluir customizado */}
                    {driver.is_custom && (
                      <button
                        type="button"
                        onClick={() => {
                          removeManagedDriver(driver.id);
                          setCustomDriversRevision((prev) => prev + 1);
                          toast.success("Motorista removido");
                        }}
                        className="text-muted-foreground hover:text-destructive p-1 rounded-lg transition-colors"
                        title="Remover motorista customizado"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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

          {sortedTransportOrders.map((item) => {
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
            const fullAddress = address ? formatFullAddress(address) : "";
            const wazeUrl = fullAddress ? getWazeUrl(fullAddress) : "";
            const gmapsUrl = fullAddress ? getGoogleMapsUrl(fullAddress) : "";
            const inService = isAppointmentInService(appt);

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl p-3 shadow-card transition-all",
                  inService
                    ? "border-2 border-emerald-500/80 bg-emerald-50/50 dark:border-emerald-500/60 dark:bg-emerald-950/30 ring-1 ring-emerald-400/40 shadow-md"
                    : "bg-card",
                )}
              >
                {inService && (
                  <div className="mb-2 flex items-center justify-between gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                      </span>
                      🟢 Pet em atendimento no petshop
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Início da fila
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      #{item.code} · {appt?.services?.name ?? "Serviço"}
                      {appt?.pets?.name ? ` ${capitalizeWords(appt.pets.name)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appt ? formatDateTime(appt.scheduled_at) : ""}
                      {appt?.pets?.name ? ` · ${capitalizeWords(appt.pets.name)}` : ""}
                      {client?.full_name ? ` · ${client.full_name}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0", statusToneClass(opsStatusTone(currentStatus)))}
                  >
                    {formatOpsStatusWithPet(currentStatus, appt?.pets?.name)}
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
                    {address.city && address.city.toLowerCase() !== address.district?.toLowerCase()
                      ? `, ${address.city}`
                      : ""}
                    {address.state ? ` - ${address.state}` : ""}
                    {address.reference ? ` (${address.reference})` : ""}
                  </p>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {tutorLink && (
                    <a
                      href={tutorLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                      Falar com o tutor
                    </a>
                  )}

                  {fullAddress && (
                    <>
                      <a
                        href={wazeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-600 hover:bg-sky-500/20 dark:text-sky-400 transition-colors"
                        title={`Navegar no Waze até ${fullAddress}`}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        📍 Waze
                      </a>
                      <a
                        href={gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 transition-colors"
                        title={`Navegar no Google Maps até ${fullAddress}`}
                      >
                        <Compass className="h-3.5 w-3.5" />
                        🗺️ Google Maps
                      </a>
                    </>
                  )}
                </div>

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
                    Avançar: {formatOpsStatusWithPet(next, appt?.pets?.name)}
                  </Button>
                )}

                <DriverLiveMap
                  appointmentId={item.appointment_id}
                  active={
                    currentStatus === "em_deslocamento_retirada" ||
                    currentStatus === "em_rota_devolucao"
                  }
                />
                <TransportHistoryList
                  appointmentId={item.appointment_id}
                  currentStatus={currentStatus}
                  petName={appt?.pets?.name}
                />
              </div>
            );
          })}
          {(transportOrders ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido de retirada/devolução.</p>
          )}
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4 space-y-4">
          <AdminOrdersManager
            orders={orders ?? []}
            getClientAbcInfo={getClientAbcInfo}
            onUpdateOrderStatus={(id, status) => updateOrder.mutate({ id, status })}
            isUpdatingStatus={updateOrder.isPending}
            criticalStockCount={curveACriticalAlerts.length}
            onNavigateToProducts={() => setGestaoSubTab("produtos")}
          />
        </TabsContent>

        <TabsContent value="saude" className="mt-4 space-y-4">
          <AdminHealthAlertsGrouped
            alerts={healthAlertItems}
            onCompleteReminder={(reminderId) => completeReturnReminder.mutate(reminderId)}
            onOpenPetRecord={(petId) => {
              setRecordPetId(petId);
              setGestaoSubTab("clinica");
            }}
          />
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
                imageUrl: product.image_url ?? "",
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
                      image_url: values.imageUrl || null,
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
      <div className="flex items-start gap-3">
        {initial.imageUrl ? (
          <img
            src={initial.imageUrl}
            alt={name}
            className="h-11 w-11 shrink-0 rounded-xl object-cover border border-border shadow-xs"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <Badge variant={active ? "default" : "secondary"} className="shrink-0">
              {active ? "ativo" : "inativo"}
            </Badge>
          </div>
          <p className="truncate text-xs capitalize text-muted-foreground">{subtitle}</p>
        </div>
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
