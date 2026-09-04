import { startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import * as XLSX from "xlsx";
import { formatBRL, formatDate } from "./format";

export type AbcClass = "A" | "B" | "C";

export type AbcPeriod = "hoje" | "semana" | "mes" | "ano" | "todos" | "personalizado";

export type ProductAbcItem = {
  rank: number;
  id: string;
  name: string;
  category: string;
  quantitySold: number;
  ordersCount: number;
  totalRevenueCents: number;
  avgUnitPriceCents: number;
  revenueSharePercent: number;
  accumulatedSharePercent: number;
  abcClass: AbcClass;
  currentStock?: number | null | undefined;
};

export type ServiceAbcItem = {
  rank: number;
  id: string;
  name: string;
  category: string;
  executedCount: number;
  totalRevenueCents: number;
  avgTicketCents: number;
  revenueSharePercent: number;
  accumulatedSharePercent: number;
  abcClass: AbcClass;
  durationMin?: number | null | undefined;
};

export type AbcClassStats = {
  revenueCents: number;
  itemsCount: number;
  revenueShare: number;
  catalogShare: number;
  unitsTotal: number;
};

export type AbcSummary = {
  totalRevenueCents: number;
  totalItemsCount: number;
  totalUnitsOrExecutions: number;
  classA: AbcClassStats;
  classB: AbcClassStats;
  classC: AbcClassStats;
  paretoRatio: string;
};

export function resolveAbcRange(
  period: AbcPeriod,
  fromISO?: string,
  toISO?: string,
): { start: Date | null; end: Date; label: string } {
  const now = new Date();
  const endOfNow = now;

  if (period === "hoje") {
    const start = startOfDay(now);
    return { start, end: endOfNow, label: `Hoje (${formatDate(start)})` };
  }
  if (period === "semana") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return {
      start,
      end: endOfNow,
      label: `Esta Semana (${formatDate(start)} a ${formatDate(endOfNow)})`,
    };
  }
  if (period === "mes") {
    const start = startOfMonth(now);
    return {
      start,
      end: endOfNow,
      label: `Este Mês (${formatDate(start)} a ${formatDate(endOfNow)})`,
    };
  }
  if (period === "ano") {
    const start = startOfYear(now);
    return {
      start,
      end: endOfNow,
      label: `Ano Atual (${formatDate(start)} a ${formatDate(endOfNow)})`,
    };
  }
  if (period === "personalizado") {
    const start = fromISO ? new Date(`${fromISO}T00:00:00`) : startOfMonth(now);
    const end = toISO ? new Date(`${toISO}T23:59:59`) : endOfNow;
    return {
      start,
      end,
      label: `${formatDate(start)} a ${formatDate(end)}`,
    };
  }
  // "todos"
  return { start: null, end: endOfNow, label: "Todo o Histórico" };
}

export function calculateProductAbc(
  rawItems: Array<{
    productId?: string | null | undefined;
    productName: string;
    category?: string | null | undefined;
    quantity: number;
    unitPriceCents: number;
    orderId: string;
    stock?: number | null | undefined;
  }>,
): { items: ProductAbcItem[]; summary: AbcSummary; categories: string[] } {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      quantitySold: number;
      ordersSet: Set<string>;
      totalRevenueCents: number;
      stock?: number | null | undefined;
    }
  >();

  const allCategories = new Set<string>();

  for (const item of rawItems) {
    const key = (item.productId || item.productName).trim().toLowerCase();
    const cat = item.category?.trim() || "Geral";
    allCategories.add(cat);

    const existing = map.get(key);
    const qty = Math.max(0, item.quantity);
    const revenue = qty * Math.max(0, item.unitPriceCents);

    if (existing) {
      existing.quantitySold += qty;
      existing.ordersSet.add(item.orderId);
      existing.totalRevenueCents += revenue;
      if (item.stock !== undefined && item.stock !== null) {
        existing.stock = item.stock;
      }
    } else {
      const ordersSet = new Set<string>();
      ordersSet.add(item.orderId);
      map.set(key, {
        id: item.productId || key,
        name: item.productName,
        category: cat,
        quantitySold: qty,
        ordersSet,
        totalRevenueCents: revenue,
        stock: item.stock !== null && item.stock !== undefined ? item.stock : undefined,
      });
    }
  }

  // Ordena por faturamento total decrescente
  const sorted = Array.from(map.values()).sort(
    (a, b) => b.totalRevenueCents - a.totalRevenueCents,
  );

  const totalRevenueCents = sorted.reduce((acc, cur) => acc + cur.totalRevenueCents, 0);
  const totalUnits = sorted.reduce((acc, cur) => acc + cur.quantitySold, 0);
  const totalItemsCount = sorted.length;

  let accumulatedCents = 0;
  let classARevenue = 0;
  let classBRevenue = 0;
  let classCRevenue = 0;
  let classACount = 0;
  let classBCount = 0;
  let classCCount = 0;
  let classAUnits = 0;
  let classBUnits = 0;
  let classCUnits = 0;

  const items: ProductAbcItem[] = sorted.map((p, index) => {
    accumulatedCents += p.totalRevenueCents;
    const revenueSharePercent =
      totalRevenueCents > 0 ? (p.totalRevenueCents / totalRevenueCents) * 100 : 0;
    const accumulatedSharePercent =
      totalRevenueCents > 0 ? (accumulatedCents / totalRevenueCents) * 100 : 0;

    // Regra clássica de Pareto ABC:
    // A: até 70% da receita acumulada (ou o 1º item)
    // B: de 70% a 90%
    // C: acima de 90%
    let abcClass: AbcClass = "C";
    if (accumulatedSharePercent <= 70.01 || index === 0) {
      abcClass = "A";
      classARevenue += p.totalRevenueCents;
      classACount += 1;
      classAUnits += p.quantitySold;
    } else if (accumulatedSharePercent <= 90.01) {
      abcClass = "B";
      classBRevenue += p.totalRevenueCents;
      classBCount += 1;
      classBUnits += p.quantitySold;
    } else {
      abcClass = "C";
      classCRevenue += p.totalRevenueCents;
      classCCount += 1;
      classCUnits += p.quantitySold;
    }

    const avgUnitPriceCents =
      p.quantitySold > 0 ? Math.round(p.totalRevenueCents / p.quantitySold) : 0;

    return {
      rank: index + 1,
      id: p.id,
      name: p.name,
      category: p.category,
      quantitySold: p.quantitySold,
      ordersCount: p.ordersSet.size,
      totalRevenueCents: p.totalRevenueCents,
      avgUnitPriceCents,
      revenueSharePercent,
      accumulatedSharePercent,
      abcClass,
      currentStock: p.stock,
    };
  });

  const summary: AbcSummary = {
    totalRevenueCents,
    totalItemsCount,
    totalUnitsOrExecutions: totalUnits,
    classA: {
      revenueCents: classARevenue,
      itemsCount: classACount,
      revenueShare: totalRevenueCents > 0 ? (classARevenue / totalRevenueCents) * 100 : 0,
      catalogShare: totalItemsCount > 0 ? (classACount / totalItemsCount) * 100 : 0,
      unitsTotal: classAUnits,
    },
    classB: {
      revenueCents: classBRevenue,
      itemsCount: classBCount,
      revenueShare: totalRevenueCents > 0 ? (classBRevenue / totalRevenueCents) * 100 : 0,
      catalogShare: totalItemsCount > 0 ? (classBCount / totalItemsCount) * 100 : 0,
      unitsTotal: classBUnits,
    },
    classC: {
      revenueCents: classCRevenue,
      itemsCount: classCCount,
      revenueShare: totalRevenueCents > 0 ? (classCRevenue / totalRevenueCents) * 100 : 0,
      catalogShare: totalItemsCount > 0 ? (classCCount / totalItemsCount) * 100 : 0,
      unitsTotal: classCUnits,
    },
    paretoRatio:
      totalItemsCount > 0 && totalRevenueCents > 0
        ? `${((classARevenue / totalRevenueCents) * 100).toFixed(0)}% da receita gerada por ${((classACount / totalItemsCount) * 100).toFixed(0)}% dos itens`
        : "Sem dados suficientes no período",
  };

  return {
    items,
    summary,
    categories: Array.from(allCategories).sort(),
  };
}

export function calculateServiceAbc(
  rawServices: Array<{
    serviceId?: string | null | undefined;
    serviceName: string;
    category?: string | null | undefined;
    priceCents: number;
    durationMin?: number | null | undefined;
  }>,
): { items: ServiceAbcItem[]; summary: AbcSummary; categories: string[] } {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      category: string;
      executedCount: number;
      totalRevenueCents: number;
      durationMin?: number | null | undefined;
    }
  >();

  const allCategories = new Set<string>();

  for (const s of rawServices) {
    const key = (s.serviceId || s.serviceName).trim().toLowerCase();
    const cat = s.category?.trim() || "Geral";
    allCategories.add(cat);

    const existing = map.get(key);
    const price = Math.max(0, s.priceCents);

    if (existing) {
      existing.executedCount += 1;
      existing.totalRevenueCents += price;
      if (s.durationMin && !existing.durationMin) {
        existing.durationMin = s.durationMin;
      }
    } else {
      map.set(key, {
        id: s.serviceId || key,
        name: s.serviceName,
        category: cat,
        executedCount: 1,
        totalRevenueCents: price,
        durationMin: s.durationMin ?? undefined,
      });
    }
  }

  // Ordena por faturamento total decrescente
  const sorted = Array.from(map.values()).sort(
    (a, b) => b.totalRevenueCents - a.totalRevenueCents,
  );

  const totalRevenueCents = sorted.reduce((acc, cur) => acc + cur.totalRevenueCents, 0);
  const totalExecutions = sorted.reduce((acc, cur) => acc + cur.executedCount, 0);
  const totalItemsCount = sorted.length;

  let accumulatedCents = 0;
  let classARevenue = 0;
  let classBRevenue = 0;
  let classCRevenue = 0;
  let classACount = 0;
  let classBCount = 0;
  let classCCount = 0;
  let classAUnits = 0;
  let classBUnits = 0;
  let classCUnits = 0;

  const items: ServiceAbcItem[] = sorted.map((s, index) => {
    accumulatedCents += s.totalRevenueCents;
    const revenueSharePercent =
      totalRevenueCents > 0 ? (s.totalRevenueCents / totalRevenueCents) * 100 : 0;
    const accumulatedSharePercent =
      totalRevenueCents > 0 ? (accumulatedCents / totalRevenueCents) * 100 : 0;

    let abcClass: AbcClass = "C";
    if (accumulatedSharePercent <= 70.01 || index === 0) {
      abcClass = "A";
      classARevenue += s.totalRevenueCents;
      classACount += 1;
      classAUnits += s.executedCount;
    } else if (accumulatedSharePercent <= 90.01) {
      abcClass = "B";
      classBRevenue += s.totalRevenueCents;
      classBCount += 1;
      classBUnits += s.executedCount;
    } else {
      abcClass = "C";
      classCRevenue += s.totalRevenueCents;
      classCCount += 1;
      classCUnits += s.executedCount;
    }

    const avgTicketCents =
      s.executedCount > 0 ? Math.round(s.totalRevenueCents / s.executedCount) : 0;

    return {
      rank: index + 1,
      id: s.id,
      name: s.name,
      category: s.category,
      executedCount: s.executedCount,
      totalRevenueCents: s.totalRevenueCents,
      avgTicketCents,
      revenueSharePercent,
      accumulatedSharePercent,
      abcClass,
      durationMin: s.durationMin,
    };
  });

  const summary: AbcSummary = {
    totalRevenueCents,
    totalItemsCount,
    totalUnitsOrExecutions: totalExecutions,
    classA: {
      revenueCents: classARevenue,
      itemsCount: classACount,
      revenueShare: totalRevenueCents > 0 ? (classARevenue / totalRevenueCents) * 100 : 0,
      catalogShare: totalItemsCount > 0 ? (classACount / totalItemsCount) * 100 : 0,
      unitsTotal: classAUnits,
    },
    classB: {
      revenueCents: classBRevenue,
      itemsCount: classBCount,
      revenueShare: totalRevenueCents > 0 ? (classBRevenue / totalRevenueCents) * 100 : 0,
      catalogShare: totalItemsCount > 0 ? (classBCount / totalItemsCount) * 100 : 0,
      unitsTotal: classBUnits,
    },
    classC: {
      revenueCents: classCRevenue,
      itemsCount: classCCount,
      revenueShare: totalRevenueCents > 0 ? (classCRevenue / totalRevenueCents) * 100 : 0,
      catalogShare: totalItemsCount > 0 ? (classCCount / totalItemsCount) * 100 : 0,
      unitsTotal: classCUnits,
    },
    paretoRatio:
      totalItemsCount > 0 && totalRevenueCents > 0
        ? `${((classARevenue / totalRevenueCents) * 100).toFixed(0)}% da receita gerada por ${((classACount / totalItemsCount) * 100).toFixed(0)}% dos serviços`
        : "Sem dados suficientes no período",
  };

  return {
    items,
    summary,
    categories: Array.from(allCategories).sort(),
  };
}

export function exportProductAbcXLSX(
  items: ProductAbcItem[],
  summary: AbcSummary,
  periodLabel: string,
) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo
  const resumoData = [
    ["RELATÓRIO CURVA ABC - PRODUTOS VENDIDOS"],
    ["Período:", periodLabel],
    ["Gerado em:", new Date().toLocaleString("pt-BR")],
    [],
    ["Classe", "Faturamento (R$)", "% da Receita", "Qtd Itens", "% do Catálogo", "Unidades Vendidas"],
    [
      "Classe A (Alto Impacto - 70%)",
      summary.classA.revenueCents / 100,
      `${summary.classA.revenueShare.toFixed(1)}%`,
      summary.classA.itemsCount,
      `${summary.classA.catalogShare.toFixed(1)}%`,
      summary.classA.unitsTotal,
    ],
    [
      "Classe B (Médio Impacto - 20%)",
      summary.classB.revenueCents / 100,
      `${summary.classB.revenueShare.toFixed(1)}%`,
      summary.classB.itemsCount,
      `${summary.classB.catalogShare.toFixed(1)}%`,
      summary.classB.unitsTotal,
    ],
    [
      "Classe C (Baixo Impacto - 10%)",
      summary.classC.revenueCents / 100,
      `${summary.classC.revenueShare.toFixed(1)}%`,
      summary.classC.itemsCount,
      `${summary.classC.catalogShare.toFixed(1)}%`,
      summary.classC.unitsTotal,
    ],
    [
      "TOTAL GERAL",
      summary.totalRevenueCents / 100,
      "100.0%",
      summary.totalItemsCount,
      "100.0%",
      summary.totalUnitsOrExecutions,
    ],
  ];

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");

  // Aba 2: Lista Completa
  const rows = items.map((it) => ({
    "Posição (#)": it.rank,
    Classe: it.abcClass,
    Produto: it.name,
    Categoria: it.category,
    "Qtd Vendida": it.quantitySold,
    "Nº de Pedidos": it.ordersCount,
    "Preço Médio (R$)": it.avgUnitPriceCents / 100,
    "Faturamento Total (R$)": it.totalRevenueCents / 100,
    "% da Receita": Number(it.revenueSharePercent.toFixed(2)),
    "% Acumulada": Number(it.accumulatedSharePercent.toFixed(2)),
    "Estoque Atual": it.currentStock ?? "N/A",
  }));

  const wsItens = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsItens, "Curva ABC Produtos");

  const filename = `Curva_ABC_Produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportServiceAbcXLSX(
  items: ServiceAbcItem[],
  summary: AbcSummary,
  periodLabel: string,
) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo
  const resumoData = [
    ["RELATÓRIO CURVA ABC - SERVIÇOS EXECUTADOS"],
    ["Período:", periodLabel],
    ["Gerado em:", new Date().toLocaleString("pt-BR")],
    [],
    ["Classe", "Faturamento (R$)", "% da Receita", "Qtd Serviços", "% do Catálogo", "Atendimentos"],
    [
      "Classe A (Carro-chefe - 70%)",
      summary.classA.revenueCents / 100,
      `${summary.classA.revenueShare.toFixed(1)}%`,
      summary.classA.itemsCount,
      `${summary.classA.catalogShare.toFixed(1)}%`,
      summary.classA.unitsTotal,
    ],
    [
      "Classe B (Intermediários - 20%)",
      summary.classB.revenueCents / 100,
      `${summary.classB.revenueShare.toFixed(1)}%`,
      summary.classB.itemsCount,
      `${summary.classB.catalogShare.toFixed(1)}%`,
      summary.classB.unitsTotal,
    ],
    [
      "Classe C (Baixa Demanda - 10%)",
      summary.classC.revenueCents / 100,
      `${summary.classC.revenueShare.toFixed(1)}%`,
      summary.classC.itemsCount,
      `${summary.classC.catalogShare.toFixed(1)}%`,
      summary.classC.unitsTotal,
    ],
    [
      "TOTAL GERAL",
      summary.totalRevenueCents / 100,
      "100.0%",
      summary.totalItemsCount,
      "100.0%",
      summary.totalUnitsOrExecutions,
    ],
  ];

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");

  // Aba 2: Lista Completa
  const rows = items.map((it) => ({
    "Posição (#)": it.rank,
    Classe: it.abcClass,
    Serviço: it.name,
    Categoria: it.category,
    "Atendimentos Executados": it.executedCount,
    "Ticket Médio (R$)": it.avgTicketCents / 100,
    "Faturamento Total (R$)": it.totalRevenueCents / 100,
    "% da Receita": Number(it.revenueSharePercent.toFixed(2)),
    "% Acumulada": Number(it.accumulatedSharePercent.toFixed(2)),
    "Duração (min)": it.durationMin ?? "N/A",
  }));

  const wsItens = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsItens, "Curva ABC Serviços");

  const filename = `Curva_ABC_Servicos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// -------------------------------------------------------------
// CURVA ABC DE CLIENTES (TUTORES)
// -------------------------------------------------------------

export type ClientConsumptionProfile =
  | "hibrido"
  | "apenas_servicos"
  | "apenas_produtos"
  | "sem_consumo";

export type ClientRetentionStatus = "ativo" | "alerta" | "em_risco";

export type ClientAbcItem = {
  rank: number;
  id: string;
  name: string;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  petNames: string[];
  totalRevenueCents: number;
  servicesRevenueCents: number;
  productsRevenueCents: number;
  servicesCount: number;
  ordersCount: number;
  totalTransactions: number;
  revenueSharePercent: number;
  accumulatedSharePercent: number;
  abcClass: AbcClass;
  consumptionProfile: ClientConsumptionProfile;
  retentionStatus: ClientRetentionStatus;
  lastActivityDate?: string | null | undefined;
  daysSinceLastActivity?: number | null | undefined;
};

export type ClientAbcClassStats = {
  revenueCents: number;
  clientsCount: number;
  revenueShare: number;
  clientsShare: number;
  avgLtvCents: number;
  servicesRevenueCents: number;
  productsRevenueCents: number;
};

export type ClientAbcSummary = {
  totalRevenueCents: number;
  totalClientsCount: number;
  avgLtvCents: number;
  classA: ClientAbcClassStats;
  classB: ClientAbcClassStats;
  classC: ClientAbcClassStats;
  paretoRatio: string;
  retention: {
    activeCount: number;
    warningCount: number;
    atRiskCount: number;
    atRiskVipsCount: number;
  };
  consumption: {
    hybridCount: number;
    hybridRevenueCents: number;
    servicesOnlyCount: number;
    servicesOnlyRevenueCents: number;
    productsOnlyCount: number;
    productsOnlyRevenueCents: number;
  };
};

export type RawClientAppointment = {
  id: string;
  userId: string;
  clientName?: string | null | undefined;
  scheduledAt: string;
  totalCents: number;
  petName?: string | null | undefined;
};

export type RawClientOrder = {
  id: string;
  userId?: string | null | undefined;
  customerName?: string | null | undefined;
  customerPhone?: string | null | undefined;
  createdAt: string;
  totalCents: number;
};

export type RawClientProfile = {
  id: string;
  fullName?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  petNames?: string[] | undefined;
};

export function calculateClientAbc(
  appointments: RawClientAppointment[],
  orders: RawClientOrder[],
  profiles: RawClientProfile[],
  referenceDate: Date = new Date(),
): {
  items: ClientAbcItem[];
  summary: ClientAbcSummary;
} {
  type ClientAgg = {
    id: string;
    name: string;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    petNamesSet: Set<string>;
    servicesRevenueCents: number;
    productsRevenueCents: number;
    servicesCount: number;
    ordersCount: number;
    lastActivityDate?: string | null | undefined;
  };

  const map = new Map<string, ClientAgg>();

  // 1. Inicializa o mapa com perfis conhecidos
  for (const p of profiles) {
    map.set(p.id, {
      id: p.id,
      name: p.fullName?.trim() || "Cliente Sem Nome",
      phone: p.phone ?? undefined,
      email: p.email ?? undefined,
      petNamesSet: new Set(p.petNames ?? []),
      servicesRevenueCents: 0,
      productsRevenueCents: 0,
      servicesCount: 0,
      ordersCount: 0,
      lastActivityDate: undefined,
    });
  }

  // 2. Acumula agendamentos executados/considerados
  for (const a of appointments) {
    const key = a.userId || "anonimo";
    let agg = map.get(key);
    if (!agg) {
      agg = {
        id: key,
        name: a.clientName?.trim() || "Cliente",
        phone: undefined,
        email: undefined,
        petNamesSet: new Set(),
        servicesRevenueCents: 0,
        productsRevenueCents: 0,
        servicesCount: 0,
        ordersCount: 0,
        lastActivityDate: undefined,
      };
      map.set(key, agg);
    }

    if (a.clientName && (!agg.name || agg.name === "Cliente Sem Nome" || agg.name === "Cliente")) {
      agg.name = a.clientName.trim();
    }
    if (a.petName) {
      agg.petNamesSet.add(a.petName.trim());
    }

    agg.servicesRevenueCents += a.totalCents;
    agg.servicesCount += 1;

    if (!agg.lastActivityDate || new Date(a.scheduledAt) > new Date(agg.lastActivityDate)) {
      agg.lastActivityDate = a.scheduledAt;
    }
  }

  // 3. Acumula pedidos de produtos entregues/considerados
  for (const o of orders) {
    const key = o.userId || (o.customerPhone ? `tel_${o.customerPhone}` : `order_${o.id}`);
    let agg = map.get(key);
    if (!agg) {
      agg = {
        id: key,
        name: o.customerName?.trim() || "Cliente Loja",
        phone: o.customerPhone ?? undefined,
        email: undefined,
        petNamesSet: new Set(),
        servicesRevenueCents: 0,
        productsRevenueCents: 0,
        servicesCount: 0,
        ordersCount: 0,
        lastActivityDate: undefined,
      };
      map.set(key, agg);
    }

    if (o.customerName && (!agg.name || agg.name === "Cliente Sem Nome" || agg.name === "Cliente")) {
      agg.name = o.customerName.trim();
    }
    if (o.customerPhone && !agg.phone) {
      agg.phone = o.customerPhone;
    }

    agg.productsRevenueCents += o.totalCents;
    agg.ordersCount += 1;

    if (!agg.lastActivityDate || new Date(o.createdAt) > new Date(agg.lastActivityDate)) {
      agg.lastActivityDate = o.createdAt;
    }
  }

  // 4. Filtra clientes que tiveram faturamento > 0 no período e ordena decrescente
  const activeClients = Array.from(map.values())
    .map((c) => ({
      ...c,
      totalRevenueCents: c.servicesRevenueCents + c.productsRevenueCents,
      totalTransactions: c.servicesCount + c.ordersCount,
    }))
    .filter((c) => c.totalRevenueCents > 0)
    .sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);

  const totalRevenueCents = activeClients.reduce((acc, c) => acc + c.totalRevenueCents, 0);
  const totalClientsCount = activeClients.length;

  let accumulatedCents = 0;
  let classARevenue = 0;
  let classBRevenue = 0;
  let classCRevenue = 0;
  let classAServices = 0;
  let classBServices = 0;
  let classCServices = 0;
  let classAProducts = 0;
  let classBProducts = 0;
  let classCProducts = 0;
  let classACount = 0;
  let classBCount = 0;
  let classCCount = 0;

  let activeRetentionCount = 0;
  let warningRetentionCount = 0;
  let atRiskRetentionCount = 0;
  let atRiskVipsCount = 0;

  let hybridCount = 0;
  let hybridRevenueCents = 0;
  let servicesOnlyCount = 0;
  let servicesOnlyRevenueCents = 0;
  let productsOnlyCount = 0;
  let productsOnlyRevenueCents = 0;

  const refTime = referenceDate.getTime();

  const items: ClientAbcItem[] = activeClients.map((client, index) => {
    accumulatedCents += client.totalRevenueCents;
    const revenueSharePercent =
      totalRevenueCents > 0 ? (client.totalRevenueCents / totalRevenueCents) * 100 : 0;
    const accumulatedSharePercent =
      totalRevenueCents > 0 ? (accumulatedCents / totalRevenueCents) * 100 : 0;

    let abcClass: AbcClass = "C";
    if (accumulatedSharePercent <= 70.01 || index === 0) {
      abcClass = "A";
      classARevenue += client.totalRevenueCents;
      classAServices += client.servicesRevenueCents;
      classAProducts += client.productsRevenueCents;
      classACount += 1;
    } else if (accumulatedSharePercent <= 90.01) {
      abcClass = "B";
      classBRevenue += client.totalRevenueCents;
      classBServices += client.servicesRevenueCents;
      classBProducts += client.productsRevenueCents;
      classBCount += 1;
    } else {
      abcClass = "C";
      classCRevenue += client.totalRevenueCents;
      classCServices += client.servicesRevenueCents;
      classCProducts += client.productsRevenueCents;
      classCCount += 1;
    }

    // Perfil de consumo
    let consumptionProfile: ClientConsumptionProfile = "sem_consumo";
    if (client.servicesRevenueCents > 0 && client.productsRevenueCents > 0) {
      consumptionProfile = "hibrido";
      hybridCount += 1;
      hybridRevenueCents += client.totalRevenueCents;
    } else if (client.servicesRevenueCents > 0) {
      consumptionProfile = "apenas_servicos";
      servicesOnlyCount += 1;
      servicesOnlyRevenueCents += client.totalRevenueCents;
    } else if (client.productsRevenueCents > 0) {
      consumptionProfile = "apenas_produtos";
      productsOnlyCount += 1;
      productsOnlyRevenueCents += client.totalRevenueCents;
    }

    // Radar de retenção
    let daysSinceLastActivity: number | undefined = undefined;
    let retentionStatus: ClientRetentionStatus = "ativo";

    if (client.lastActivityDate) {
      const actTime = new Date(client.lastActivityDate).getTime();
      daysSinceLastActivity = Math.max(0, Math.floor((refTime - actTime) / (1000 * 60 * 60 * 24)));
      if (daysSinceLastActivity < 30) {
        retentionStatus = "ativo";
        activeRetentionCount += 1;
      } else if (daysSinceLastActivity <= 60) {
        retentionStatus = "alerta";
        warningRetentionCount += 1;
        if (abcClass === "A") atRiskVipsCount += 1;
      } else {
        retentionStatus = "em_risco";
        atRiskRetentionCount += 1;
        if (abcClass === "A") atRiskVipsCount += 1;
      }
    } else {
      retentionStatus = "ativo";
      activeRetentionCount += 1;
    }

    return {
      rank: index + 1,
      id: client.id,
      name: client.name,
      phone: client.phone ?? undefined,
      email: client.email ?? undefined,
      petNames: Array.from(client.petNamesSet),
      totalRevenueCents: client.totalRevenueCents,
      servicesRevenueCents: client.servicesRevenueCents,
      productsRevenueCents: client.productsRevenueCents,
      servicesCount: client.servicesCount,
      ordersCount: client.ordersCount,
      totalTransactions: client.totalTransactions,
      revenueSharePercent,
      accumulatedSharePercent,
      abcClass,
      consumptionProfile,
      retentionStatus,
      lastActivityDate: client.lastActivityDate ?? undefined,
      daysSinceLastActivity,
    };
  });

  const avgLtvCents = totalClientsCount > 0 ? Math.round(totalRevenueCents / totalClientsCount) : 0;

  const summary: ClientAbcSummary = {
    totalRevenueCents,
    totalClientsCount,
    avgLtvCents,
    classA: {
      revenueCents: classARevenue,
      clientsCount: classACount,
      revenueShare: totalRevenueCents > 0 ? (classARevenue / totalRevenueCents) * 100 : 0,
      clientsShare: totalClientsCount > 0 ? (classACount / totalClientsCount) * 100 : 0,
      avgLtvCents: classACount > 0 ? Math.round(classARevenue / classACount) : 0,
      servicesRevenueCents: classAServices,
      productsRevenueCents: classAProducts,
    },
    classB: {
      revenueCents: classBRevenue,
      clientsCount: classBCount,
      revenueShare: totalRevenueCents > 0 ? (classBRevenue / totalRevenueCents) * 100 : 0,
      clientsShare: totalClientsCount > 0 ? (classBCount / totalClientsCount) * 100 : 0,
      avgLtvCents: classBCount > 0 ? Math.round(classBRevenue / classBCount) : 0,
      servicesRevenueCents: classBServices,
      productsRevenueCents: classBProducts,
    },
    classC: {
      revenueCents: classCRevenue,
      clientsCount: classCCount,
      revenueShare: totalRevenueCents > 0 ? (classCRevenue / totalRevenueCents) * 100 : 0,
      clientsShare: totalClientsCount > 0 ? (classCCount / totalClientsCount) * 100 : 0,
      avgLtvCents: classCCount > 0 ? Math.round(classCRevenue / classCCount) : 0,
      servicesRevenueCents: classCServices,
      productsRevenueCents: classCProducts,
    },
    paretoRatio:
      totalClientsCount > 0 && totalRevenueCents > 0
        ? `${((classARevenue / totalRevenueCents) * 100).toFixed(0)}% da receita gerada por ${((classACount / totalClientsCount) * 100).toFixed(0)}% dos tutores`
        : "Sem dados suficientes no período",
    retention: {
      activeCount: activeRetentionCount,
      warningCount: warningRetentionCount,
      atRiskCount: atRiskRetentionCount,
      atRiskVipsCount,
    },
    consumption: {
      hybridCount,
      hybridRevenueCents,
      servicesOnlyCount,
      servicesOnlyRevenueCents,
      productsOnlyCount,
      productsOnlyRevenueCents,
    },
  };

  return { items, summary };
}

export function exportClientAbcXLSX(
  items: ClientAbcItem[],
  summary: ClientAbcSummary,
  periodLabel: string,
) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo Executivo
  const resumoData = [
    ["RELATÓRIO CURVA ABC - CLIENTES (TUTORES)"],
    ["Período:", periodLabel],
    ["Gerado em:", new Date().toLocaleString("pt-BR")],
    [],
    ["Classe", "Faturamento (R$)", "% da Receita", "Qtd Tutores", "% da Base", "Gasto Médio por Tutor (R$)"],
    [
      "Classe A (Tutores VIP - 70%)",
      summary.classA.revenueCents / 100,
      `${summary.classA.revenueShare.toFixed(1)}%`,
      summary.classA.clientsCount,
      `${summary.classA.clientsShare.toFixed(1)}%`,
      summary.classA.avgLtvCents / 100,
    ],
    [
      "Classe B (Tutores Regulares - 20%)",
      summary.classB.revenueCents / 100,
      `${summary.classB.revenueShare.toFixed(1)}%`,
      summary.classB.clientsCount,
      `${summary.classB.clientsShare.toFixed(1)}%`,
      summary.classB.avgLtvCents / 100,
    ],
    [
      "Classe C (Esporádicos - 10%)",
      summary.classC.revenueCents / 100,
      `${summary.classC.revenueShare.toFixed(1)}%`,
      summary.classC.clientsCount,
      `${summary.classC.clientsShare.toFixed(1)}%`,
      summary.classC.avgLtvCents / 100,
    ],
    [
      "TOTAL GERAL",
      summary.totalRevenueCents / 100,
      "100.0%",
      summary.totalClientsCount,
      "100.0%",
      summary.avgLtvCents / 100,
    ],
    [],
    ["RADAR DE FREQUÊNCIA & RETENÇÃO DE CLIENTES"],
    ["Status", "Quantidade de Tutores", "% da Base"],
    [
      "Ativos (< 30 dias)",
      summary.retention.activeCount,
      summary.totalClientsCount > 0
        ? `${((summary.retention.activeCount / summary.totalClientsCount) * 100).toFixed(1)}%`
        : "0%",
    ],
    [
      "Em Alerta (30 a 60 dias sem visita)",
      summary.retention.warningCount,
      summary.totalClientsCount > 0
        ? `${((summary.retention.warningCount / summary.totalClientsCount) * 100).toFixed(1)}%`
        : "0%",
    ],
    [
      "Em Risco de Abandono (> 60 dias sem visita)",
      summary.retention.atRiskCount,
      summary.totalClientsCount > 0
        ? `${((summary.retention.atRiskCount / summary.totalClientsCount) * 100).toFixed(1)}%`
        : "0%",
    ],
    ["VIPs (Classe A) em Risco", summary.retention.atRiskVipsCount, "-"],
    [],
    ["PERFIL DE CONSUMO & VENDAS COMBINADAS (SERVIÇOS + LOJA)"],
    ["Perfil", "Tutores", "Faturamento Total (R$)", "Ticket Médio (R$)"],
    [
      "Híbridos (Serviços + Loja)",
      summary.consumption.hybridCount,
      summary.consumption.hybridRevenueCents / 100,
      summary.consumption.hybridCount > 0
        ? summary.consumption.hybridRevenueCents / summary.consumption.hybridCount / 100
        : 0,
    ],
    [
      "Apenas Serviços (Banho/Tosa)",
      summary.consumption.servicesOnlyCount,
      summary.consumption.servicesOnlyRevenueCents / 100,
      summary.consumption.servicesOnlyCount > 0
        ? summary.consumption.servicesOnlyRevenueCents / summary.consumption.servicesOnlyCount / 100
        : 0,
    ],
    [
      "Apenas Loja Virtual",
      summary.consumption.productsOnlyCount,
      summary.consumption.productsOnlyRevenueCents / 100,
      summary.consumption.productsOnlyCount > 0
        ? summary.consumption.productsOnlyRevenueCents / summary.consumption.productsOnlyCount / 100
        : 0,
    ],
  ];

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Executivo");

  // Aba 2: Lista Completa de Clientes
  const profileLabelMap: Record<ClientConsumptionProfile, string> = {
    hibrido: "Híbrido (Serviço + Loja)",
    apenas_servicos: "Apenas Serviços",
    apenas_produtos: "Apenas Loja",
    sem_consumo: "Sem Consumo",
  };

  const retentionLabelMap: Record<ClientRetentionStatus, string> = {
    ativo: "Ativo (< 30d)",
    alerta: "Em Alerta (30-60d)",
    em_risco: "Em Risco (> 60d)",
  };

  const rows = items.map((it) => ({
    "Posição (#)": it.rank,
    Classe: it.abcClass,
    Tutor: it.name,
    Telefone: it.phone || "Não informado",
    Pets: it.petNames.length > 0 ? it.petNames.join(", ") : "Não informado",
    "Visitas Serviços": it.servicesCount,
    "Compras Loja": it.ordersCount,
    "Total Transações": it.totalTransactions,
    "Faturamento Serviços (R$)": it.servicesRevenueCents / 100,
    "Faturamento Loja (R$)": it.productsRevenueCents / 100,
    "Faturamento Total (R$)": it.totalRevenueCents / 100,
    "% da Receita": Number(it.revenueSharePercent.toFixed(2)),
    "% Acumulada": Number(it.accumulatedSharePercent.toFixed(2)),
    "Perfil de Consumo": profileLabelMap[it.consumptionProfile],
    "Última Atividade": it.lastActivityDate
      ? new Date(it.lastActivityDate).toLocaleDateString("pt-BR")
      : "N/A",
    "Dias Sem Atividade": it.daysSinceLastActivity ?? "N/A",
    "Status Retenção": retentionLabelMap[it.retentionStatus],
  }));

  const wsItens = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsItens, "Curva ABC Clientes");

  const filename = `Curva_ABC_Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

