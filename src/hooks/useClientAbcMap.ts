import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isServiceExecuted, hasTransportFee } from "@/lib/transport";
import { digitsOnly, formatBRL } from "@/lib/format";

export type ClientAbcClass = "A" | "B" | "C";

export type ClientAbcActionSuggestion = {
  tone: "vip" | "regular" | "standard";
  badgeLabel: string;
  badgeClass: string;
  cardBorderClass: string;
  title: string;
  actionSummary: string;
  discountPercent?: number | undefined;
  suggestedOffer: string;
  whatsappMessageTemplate: (clientName: string, petName?: string) => string;
};

export type ClientAbcInfo = {
  userId: string;
  name: string;
  phone?: string | null | undefined;
  abcClass: ClientAbcClass;
  ltvCents: number;
  visitsCount: number;
  ordersCount: number;
  totalTransactions: number;
  rank: number;
  suggestion: ClientAbcActionSuggestion;
};

export function useClientAbcMap() {
  // 1. Busca todos os agendamentos não cancelados para compor o faturamento histórico dos tutores
  const { data: rawAppointments } = useQuery({
    queryKey: ["client-abc-map-appointments"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, status, ops_status, scheduled_at, user_id, service_price_cents, transport_price_cents, logistics_type")
        .neq("status", "cancelado");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Busca todos os pedidos não cancelados da loja
  const { data: rawOrders } = useQuery({
    queryKey: ["client-abc-map-orders"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at, user_id, customer_name, phone, total_cents")
        .neq("status", "cancelado");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Busca perfis
  const { data: profiles } = useQuery({
    queryKey: ["client-abc-map-profiles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { clientMapById, clientMapByPhone } = useMemo(() => {
    type Agg = {
      id: string;
      name: string;
      phone?: string | null | undefined;
      totalCents: number;
      visitsCount: number;
      ordersCount: number;
    };

    const map = new Map<string, Agg>();

    // Inicializa perfis
    for (const p of profiles ?? []) {
      map.set(p.id, {
        id: p.id,
        name: p.full_name?.trim() || "Cliente",
        phone: p.phone ?? undefined,
        totalCents: 0,
        visitsCount: 0,
        ordersCount: 0,
      });
    }

    // Acumula agendamentos
    for (const a of rawAppointments ?? []) {
      const key = a.user_id || "anonimo";
      let agg = map.get(key);
      if (!agg) {
        agg = {
          id: key,
          name: "Cliente",
          phone: undefined,
          totalCents: 0,
          visitsCount: 0,
          ordersCount: 0,
        };
        map.set(key, agg);
      }

      const svcPrice = a.service_price_cents ?? 0;
      const transPrice = hasTransportFee(a.logistics_type) ? (a.transport_price_cents ?? 0) : 0;
      agg.totalCents += svcPrice + transPrice;
      agg.visitsCount += 1;
    }

    // Acumula pedidos
    for (const o of rawOrders ?? []) {
      const key = o.user_id || (o.phone ? `tel_${digitsOnly(o.phone)}` : `ord_${o.id}`);
      let agg = map.get(key);
      if (!agg) {
        agg = {
          id: key,
          name: o.customer_name?.trim() || "Cliente Loja",
          phone: o.phone ?? undefined,
          totalCents: 0,
          visitsCount: 0,
          ordersCount: 0,
        };
        map.set(key, agg);
      }

      if (o.customer_name && (!agg.name || agg.name === "Cliente")) {
        agg.name = o.customer_name.trim();
      }
      if (o.phone && !agg.phone) {
        agg.phone = o.phone;
      }

      agg.totalCents += o.total_cents ?? 0;
      agg.ordersCount += 1;
    }

    // Ordena decrescente por faturamento total acumulado
    const sorted = Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
    const totalRevenueCents = sorted.reduce((acc, cur) => acc + cur.totalCents, 0);

    let accumulatedCents = 0;
    const byId = new Map<string, ClientAbcInfo>();
    const byPhone = new Map<string, ClientAbcInfo>();

    sorted.forEach((item, index) => {
      accumulatedCents += item.totalCents;
      const accumulatedSharePercent =
        totalRevenueCents > 0 ? (accumulatedCents / totalRevenueCents) * 100 : 0;

      let abcClass: ClientAbcClass = "C";
      if (item.totalCents > 0 && (accumulatedSharePercent <= 70.01 || index === 0)) {
        abcClass = "A";
      } else if (item.totalCents > 0 && accumulatedSharePercent <= 90.01) {
        abcClass = "B";
      } else {
        abcClass = "C";
      }

      let suggestion: ClientAbcActionSuggestion;

      if (abcClass === "A") {
        suggestion = {
          tone: "vip",
          badgeLabel: "💎 Tutor VIP (Classe A)",
          badgeClass:
            "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
          cardBorderClass: "border-emerald-500/60 ring-1 ring-emerald-500/30",
          title: "💎 RECOMENDAÇÃO VIP (Top Clientes)",
          actionSummary: `Cliente VIP com faturamento de ${formatBRL(item.totalCents)}! Priorize o atendimento e aplique 10% de cortesia fidelidade ou hidratação brinde.`,
          discountPercent: 10,
          suggestedOffer: "10% Desconto VIP Fidelidade",
          whatsappMessageTemplate: (clientName, petName) =>
            `Olá ${clientName}! Tudo bem? Seu agendamento${petName ? ` para o(a) ${petName}` : ""} está confirmado com prioridade VIP no Big Dog Pet! 🐾 Como agradecimento por ser nossa cliente especial, preparamos 10% de desconto fidelidade neste atendimento. Esperamos vocês com muito carinho!`,
        };
      } else if (abcClass === "B") {
        suggestion = {
          tone: "regular",
          badgeLabel: "📈 Tutor Regular (Classe B)",
          badgeClass:
            "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30",
          cardBorderClass: "border-blue-500/50",
          title: "📈 OPORTUNIDADE DE UPGRADE DE TICKET",
          actionSummary: `Cliente regular com ${item.visitsCount + item.ordersCount} atendimentos. Ofereça combo promocional com 5% de desconto para promovê-lo a VIP.`,
          discountPercent: 5,
          suggestedOffer: "5% no Combo Adicional",
          whatsappMessageTemplate: (clientName, petName) =>
            `Olá ${clientName}! Confirmamos com sucesso o agendamento${petName ? ` do(a) ${petName}` : ""} no Big Dog Pet! 🐾 Que tal aproveitar e adicionar uma hidratação especial ou tosa higiênica com 5% de desconto promocional hoje? Nos avise para já deixarmos preparado!`,
        };
      } else {
        suggestion = {
          tone: "standard",
          badgeLabel: "🎯 Tutor Classe C",
          badgeClass:
            "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
          cardBorderClass: "border-border/60",
          title: "🎯 FIDELIZAÇÃO DE CLIENTE",
          actionSummary:
            "Cliente esporádico ou novo. Excelente oportunidade para entregar o cartão fidelidade carimbado na retirada.",
          discountPercent: undefined,
          suggestedOffer: "Cartão Fidelidade / Pacote Mensal",
          whatsappMessageTemplate: (clientName, petName) =>
            `Olá ${clientName}! Seu agendamento${petName ? ` para o(a) ${petName}` : ""} no Big Dog Pet está confirmado! Conheça também nossos pacotes mensais de banho com descontos exclusivos. Até logo!`,
        };
      }

      const info: ClientAbcInfo = {
        userId: item.id,
        name: item.name,
        phone: item.phone ?? undefined,
        abcClass,
        ltvCents: item.totalCents,
        visitsCount: item.visitsCount,
        ordersCount: item.ordersCount,
        totalTransactions: item.visitsCount + item.ordersCount,
        rank: index + 1,
        suggestion,
      };

      byId.set(item.id, info);
      if (item.phone) {
        const d = digitsOnly(item.phone);
        if (d.length >= 8) {
          byPhone.set(d.slice(-9), info);
        }
      }
    });

    return { clientMapById: byId, clientMapByPhone: byPhone };
  }, [rawAppointments, rawOrders, profiles]);

  const getClientAbcInfo = (
    userId?: string | null | undefined,
    phone?: string | null | undefined,
  ): ClientAbcInfo | null => {
    if (userId && clientMapById.has(userId)) {
      return clientMapById.get(userId)!;
    }
    if (phone) {
      const d = digitsOnly(phone);
      if (d.length >= 8) {
        const suffix = d.slice(-9);
        if (clientMapByPhone.has(suffix)) {
          return clientMapByPhone.get(suffix)!;
        }
      }
    }
    return null;
  };

  return { getClientAbcInfo };
}
