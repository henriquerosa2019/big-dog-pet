import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  Filter,
  Package,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import {
  calculateProductAbc,
  exportProductAbcXLSX,
  resolveAbcRange,
  type AbcClass,
  type AbcPeriod,
  type ProductAbcItem,
} from "@/lib/curvaAbc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CurvaAbcProdutos() {
  const [period, setPeriod] = useState<AbcPeriod>("mes");
  const [fromISO, setFromISO] = useState("");
  const [toISO, setToISO] = useState("");
  const [classFilter, setClassFilter] = useState<"todas" | AbcClass>("todas");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<"entregues" | "todos">("entregues");
  const [search, setSearch] = useState("");

  const range = useMemo(() => resolveAbcRange(period, fromISO, toISO), [period, fromISO, toISO]);

  // Busca dados de pedidos e itens
  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ["curva-abc-orders", period, fromISO, toISO, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, status, created_at, order_items(product_id, product_name, quantity, unit_price_cents)",
        );

      if (statusFilter === "entregues") {
        query = query.eq("status", "entregue");
      } else {
        query = query.neq("status", "cancelado");
      }

      if (range.start) {
        query = query.gte("created_at", range.start.toISOString());
      }
      query = query.lte("created_at", range.end.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Busca produtos do catálogo para ter categorias e estoque atualizados
  const { data: catalogProducts } = useQuery({
    queryKey: ["curva-abc-catalog-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, stock");
      if (error) throw error;
      return data ?? [];
    },
  });

  const catalogMap = useMemo(() => {
    const map = new Map<string, { category: string; stock: number }>();
    for (const p of catalogProducts ?? []) {
      map.set(p.id, { category: p.category, stock: p.stock });
      map.set(p.name.trim().toLowerCase(), { category: p.category, stock: p.stock });
    }
    return map;
  }, [catalogProducts]);

  // Processa itens e calcula a Curva ABC
  const { allItems, summary, categories } = useMemo(() => {
    const flattened: Array<{
      productId?: string | null | undefined;
      productName: string;
      category?: string | null | undefined;
      quantity: number;
      unitPriceCents: number;
      orderId: string;
      stock?: number | null | undefined;
    }> = [];

    for (const o of rawOrders ?? []) {
      for (const item of o.order_items ?? []) {
        const catInfo =
          (item.product_id ? catalogMap.get(item.product_id) : null) ||
          catalogMap.get(item.product_name.trim().toLowerCase());

        flattened.push({
          productId: item.product_id ?? null,
          productName: item.product_name,
          category: catInfo?.category || "Geral",
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
          orderId: o.id,
          stock: catInfo?.stock ?? null,
        });
      }
    }

    const res = calculateProductAbc(flattened);
    return {
      allItems: res.items,
      summary: res.summary,
      categories: res.categories,
    };
  }, [rawOrders, catalogMap]);

  // Itens filtrados para a tabela e visualização
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesClass = classFilter === "todas" || item.abcClass === classFilter;
      const matchesCategory = categoryFilter === "todas" || item.category === categoryFilter;
      const matchesSearch =
        !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
      return matchesClass && matchesCategory && matchesSearch;
    });
  }, [allItems, classFilter, categoryFilter, search]);

  // Distribuição de faturamento por categoria (Dashboard 3)
  const categoryRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of allItems) {
      map.set(item.category, (map.get(item.category) || 0) + item.totalRevenueCents);
    }
    return Array.from(map.entries())
      .map(([name, cents]) => ({
        name,
        cents,
        percent: summary.totalRevenueCents > 0 ? (cents / summary.totalRevenueCents) * 100 : 0,
      }))
      .sort((a, b) => b.cents - a.cents);
  }, [allItems, summary.totalRevenueCents]);

  const topChampions = useMemo(() => {
    return allItems.filter((i) => i.abcClass === "A").slice(0, 6);
  }, [allItems]);

  const classCItems = useMemo(() => {
    return allItems.filter((i) => i.abcClass === "C");
  }, [allItems]);

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS GERENCIAIS */}
      <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-primary" /> Filtros da Curva ABC de Produtos
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Período atual: <strong className="text-foreground">{range.label}</strong>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 text-xs gap-1.5"
            disabled={allItems.length === 0}
            onClick={() => exportProductAbcXLSX(allItems, summary, range.label)}
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            Exportar Excel (.xlsx)
          </Button>
        </div>

        {/* Período */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {(
            [
              ["hoje", "Hoje"],
              ["semana", "Semana"],
              ["mes", "Mês"],
              ["ano", "Ano"],
              ["todos", "Tudo"],
              ["personalizado", "Personal."],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPeriod(val)}
              className={cn(
                "rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors",
                period === val
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "personalizado" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <Label htmlFor="prod-from" className="text-[11px]">De</Label>
              <Input
                id="prod-from"
                type="date"
                value={fromISO}
                onChange={(e) => setFromISO(e.target.value)}
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="prod-to" className="text-[11px]">Até</Label>
              <Input
                id="prod-to"
                type="date"
                value={toISO}
                onChange={(e) => setToISO(e.target.value)}
                className="mt-1 h-9 text-xs rounded-xl"
              />
            </div>
          </div>
        )}

        {/* Filtros secundários: Classe, Categoria e Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/40">
          <div>
            <Label className="text-[11px] text-muted-foreground">Filtrar por Classe</Label>
            <div className="flex gap-1 mt-1">
              {(["todas", "A", "B", "C"] as const).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  className={cn(
                    "flex-1 rounded-lg py-1 text-xs font-semibold transition-colors",
                    classFilter === cls
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                  )}
                >
                  {cls === "todas" ? "Todas" : `Classe ${cls}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Categoria</Label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs"
            >
              <option value="todas">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Buscar Produto</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground rounded-2xl bg-card">
          Calculando análise da Curva ABC de produtos...
        </div>
      ) : allItems.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-card shadow-card">
          <Package className="h-10 w-10 text-muted-foreground/50 mx-auto" />
          <p className="mt-2 text-sm font-semibold">Nenhuma venda de produto registrada no período</p>
          <p className="text-xs text-muted-foreground mt-1">
            Altere o filtro de período acima (ex: selecione "Ano" ou "Tudo") para visualizar a análise completa.
          </p>
        </div>
      ) : (
        <>
          {/* DASHBOARD 1: DISTRIBUIÇÃO EXECUTIVA DA CURVA ABC */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dashboard 1 · Distribuição e Pareto da Curva ABC
                </p>
                <p className="text-base font-display text-primary mt-0.5">
                  {formatBRL(summary.totalRevenueCents)} faturados em {summary.totalUnitsOrExecutions} produtos
                </p>
              </div>
              <Badge variant="outline" className="text-[11px] bg-secondary border-primary/20">
                {summary.paretoRatio}
              </Badge>
            </div>

            {/* Barra visual proporcional */}
            <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
              <div
                style={{ width: `${Math.max(2, summary.classA.revenueShare)}%` }}
                className="bg-emerald-500 transition-all"
                title={`Classe A: ${summary.classA.revenueShare.toFixed(1)}%`}
              />
              <div
                style={{ width: `${Math.max(2, summary.classB.revenueShare)}%` }}
                className="bg-blue-500 transition-all"
                title={`Classe B: ${summary.classB.revenueShare.toFixed(1)}%`}
              />
              <div
                style={{ width: `${Math.max(2, summary.classC.revenueShare)}%` }}
                className="bg-amber-500 transition-all"
                title={`Classe C: ${summary.classC.revenueShare.toFixed(1)}%`}
              />
            </div>

            {/* 3 Cards de Classes A, B e C */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Card Classe A */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Classe A · Alto Impacto</Badge>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.classA.revenueShare.toFixed(1)}% da Receita
                  </span>
                </div>
                <p className="font-display text-lg mt-2 text-foreground">
                  {formatBRL(summary.classA.revenueCents)}
                </p>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{summary.classA.itemsCount} produtos ({summary.classA.catalogShare.toFixed(0)}% do catálogo)</span>
                  <span>{summary.classA.unitsTotal} unid.</span>
                </div>
                <p className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 p-1.5 rounded-lg">
                  🎯 <strong>Ação de Gestão:</strong> Seus carros-chefes. Nunca permita ruptura de estoque destes itens.
                </p>
              </div>

              {/* Card Classe B */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-blue-600 text-white hover:bg-blue-700">Classe B · Médio Impacto</Badge>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {summary.classB.revenueShare.toFixed(1)}% da Receita
                  </span>
                </div>
                <p className="font-display text-lg mt-2 text-foreground">
                  {formatBRL(summary.classB.revenueCents)}
                </p>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{summary.classB.itemsCount} produtos ({summary.classB.catalogShare.toFixed(0)}% do catálogo)</span>
                  <span>{summary.classB.unitsTotal} unid.</span>
                </div>
                <p className="mt-2 text-[10px] text-blue-700 dark:text-blue-300 font-medium bg-blue-500/10 p-1.5 rounded-lg">
                  ⚖️ <strong>Ação de Gestão:</strong> Itens com giro estável. Monitore reposições sem inflar capital.
                </p>
              </div>

              {/* Card Classe C */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-amber-600 text-white hover:bg-amber-700">Classe C · Cauda Longa</Badge>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {summary.classC.revenueShare.toFixed(1)}% da Receita
                  </span>
                </div>
                <p className="font-display text-lg mt-2 text-foreground">
                  {formatBRL(summary.classC.revenueCents)}
                </p>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{summary.classC.itemsCount} produtos ({summary.classC.catalogShare.toFixed(0)}% do catálogo)</span>
                  <span>{summary.classC.unitsTotal} unid.</span>
                </div>
                <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-300 font-medium bg-amber-500/10 p-1.5 rounded-lg">
                  ⚠️ <strong>Ação de Gestão:</strong> Baixo giro. Considere promoções ou descontinuação para não reter capital.
                </p>
              </div>
            </div>
          </div>

          {/* DASHBOARDS 2 E 3 (LADO A LADO) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* DASHBOARD 2: TOP PRODUTOS CAMPEÕES (CLASSE A) */}
            <div className="rounded-2xl bg-card p-3.5 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Dashboard 2 · Campeões de Faturamento (Classe A)
                </p>
                <Badge variant="outline" className="text-[10px]">Top {topChampions.length}</Badge>
              </div>
              <div className="space-y-2">
                {topChampions.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-xl surface-paper text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold truncate text-foreground">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.quantitySold} vendidos · {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary">{formatBRL(item.totalRevenueCents)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.revenueSharePercent.toFixed(1)}% da receita
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DASHBOARD 3: PARTICIPAÇÃO POR CATEGORIA DE PRODUTO */}
            <div className="rounded-2xl bg-card p-3.5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> Dashboard 3 · Eficiência por Categoria
              </p>
              <div className="space-y-2.5">
                {categoryRevenue.slice(0, 5).map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{cat.name}</span>
                      <span className="font-semibold text-foreground">
                        {formatBRL(cat.cents)} ({cat.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${cat.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DASHBOARD 4: DIAGNÓSTICO DE RISCO / CAPITAL PARADO (CLASSE C) */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  Dashboard 4 · Alerta de Baixo Giro & Capital Retido (Classe C)
                </p>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-800 dark:text-amber-300 text-[10px]">
                {classCItems.length} Itens em Atenção
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estes {classCItems.length} produtos representam juntos apenas{" "}
              <strong>{summary.classC.revenueShare.toFixed(1)}% do seu faturamento</strong>.
              Considere ações de queima de estoque ou substituição de fornecedor para aumentar o giro.
            </p>
            {classCItems.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {classCItems.slice(0, 6).map((item) => (
                  <Badge key={item.id} variant="secondary" className="text-[11px] py-0.5">
                    {item.name} ({item.quantitySold} unid. · {formatBRL(item.totalRevenueCents)})
                  </Badge>
                ))}
                {classCItems.length > 6 && (
                  <Badge variant="outline" className="text-[11px]">
                    +{classCItems.length - 6} outros itens
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* TABELA ANALÍTICA DETALHADA DA CURVA ABC */}
          <div className="rounded-2xl bg-card p-3.5 shadow-card space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tabela Analítica da Curva ABC de Produtos
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Exibindo {filteredItems.length} de {allItems.length} produtos
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-2">Classe</th>
                    <th className="py-2.5 px-3">Produto</th>
                    <th className="py-2.5 px-3">Categoria</th>
                    <th className="py-2.5 px-2 text-right">Qtd</th>
                    <th className="py-2.5 px-2 text-right">Preço Médio</th>
                    <th className="py-2.5 px-3 text-right">Faturamento</th>
                    <th className="py-2.5 px-2 text-right">% Fat.</th>
                    <th className="py-2.5 px-3 text-right">% Acum.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-2 px-3 font-semibold text-muted-foreground">{item.rank}</td>
                      <td className="py-2 px-2">
                        <span
                          className={cn(
                            "inline-block w-6 h-6 rounded-md font-bold text-center leading-6 text-xs",
                            item.abcClass === "A" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                            item.abcClass === "B" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                            item.abcClass === "C" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {item.abcClass}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-foreground">{item.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{item.category}</td>
                      <td className="py-2 px-2 text-right font-medium">{item.quantitySold}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {formatBRL(item.avgUnitPriceCents)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-primary">
                        {formatBRL(item.totalRevenueCents)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {item.revenueSharePercent.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-muted-foreground">
                        {item.accumulatedSharePercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
