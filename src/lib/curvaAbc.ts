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
