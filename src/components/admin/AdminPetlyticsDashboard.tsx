import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingBag,
  Award,
  Layers,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Filter,
  Download,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";

export interface AbcRankItem {
  id: string;
  name: string;
  category: "servico" | "produto";
  revenueCents: number;
  quantity: number;
  percentage: number;
  cumulativePercentage: number;
  classification: "A" | "B" | "C";
}

export interface AdminPetlyticsDashboardProps {
  totalRevenueCents?: number;
  grossProfitCents?: number;
  clientsCount?: number;
  averageTicketCents?: number;
  items?: AbcRankItem[];
  onExportReport?: () => void;
}

// Dados padrão executivos para representação fiel ao modelo Petlytics
const DEFAULT_ITEMS: AbcRankItem[] = [
  {
    id: "1",
    name: "Banho & Tosa Completa (Porte Médio)",
    category: "servico",
    revenueCents: 1425000, // R$ 14.250,00
    quantity: 190,
    percentage: 33.5,
    cumulativePercentage: 33.5,
    classification: "A",
  },
  {
    id: "2",
    name: "Ração Royal Canin Maxi Adult 15kg",
    category: "produto",
    revenueCents: 1084000, // R$ 10.840,00
    quantity: 28,
    percentage: 25.5,
    cumulativePercentage: 59.0,
    classification: "A",
  },
  {
    id: "3",
    name: "Consulta Clínica Geral & Vacinação",
    category: "servico",
    revenueCents: 915000, // R$ 9.150,00
    quantity: 61,
    percentage: 21.5,
    cumulativePercentage: 80.5,
    classification: "A",
  },
  {
    id: "4",
    name: "Antipulgas Bravecto 10 a 20kg",
    category: "produto",
    revenueCents: 425000, // R$ 4.250,00
    quantity: 25,
    percentage: 10.0,
    cumulativePercentage: 90.5,
    classification: "B",
  },
  {
    id: "5",
    name: "Hidratação de Pelagem com Ozonioterapia",
    category: "servico",
    revenueCents: 212500, // R$ 2.125,00
    quantity: 42,
    percentage: 5.0,
    cumulativePercentage: 95.5,
    classification: "B",
  },
  {
    id: "6",
    name: "Brinquedo Mordedor Resistente",
    category: "produto",
    revenueCents: 127500, // R$ 1.275,00
    quantity: 35,
    percentage: 3.0,
    cumulativePercentage: 98.5,
    classification: "C",
  },
  {
    id: "7",
    name: "Corte de Unhas & Limpeza de Ouvido",
    category: "servico",
    revenueCents: 63750, // R$ 637,50
    quantity: 25,
    percentage: 1.5,
    cumulativePercentage: 100.0,
    classification: "C",
  },
];

export function AdminPetlyticsDashboard({
  totalRevenueCents = 4250000, // R$ 42.500,00
  grossProfitCents = 2465000, // R$ 24.650,00 (58% margem)
  clientsCount = 312,
  averageTicketCents = 13620, // R$ 136,20
  items = DEFAULT_ITEMS,
  onExportReport,
}: AdminPetlyticsDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<"todos" | "A" | "B" | "C">("todos");
  const [selectedPeriod, setSelectedPeriod] = useState<"mes" | "trimestre" | "ano">("mes");

  // Estatísticas por classe ABC
  const abcStats = useMemo(() => {
    let revA = 0;
    let revB = 0;
    let revC = 0;

    items.forEach((it) => {
      if (it.classification === "A") revA += it.revenueCents;
      if (it.classification === "B") revB += it.revenueCents;
      if (it.classification === "C") revC += it.revenueCents;
    });

    const sum = revA + revB + revC || 1;
    return {
      a: { rev: revA, pct: Math.round((revA / sum) * 100) },
      b: { rev: revB, pct: Math.round((revB / sum) * 100) },
      c: { rev: revC, pct: Math.round((revC / sum) * 100) },
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedFilter === "todos") return items;
    return items.filter((it) => it.classification === selectedFilter);
  }, [items, selectedFilter]);

  return (
    <div className="space-y-4">
      {/* Topo do Dashboard */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                Relatórios Inteligentes & Curva ABC
              </h2>
              <Badge variant="outline" className="text-[10px] uppercase font-bold bg-muted/60 text-muted-foreground">
                Petlytics BI
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Análise de Pareto (80/20) para serviços e produtos com máxima rentabilidade.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border/60">
            {(["mes", "trimestre", "ano"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                  selectedPeriod === p
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "mes" ? "Este Mês" : p === "trimestre" ? "Trimestre" : "Ano"}
              </button>
            ))}
          </div>

          {onExportReport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportReport}
              className="h-8 rounded-xl text-xs font-bold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {/* 4 Cards de Métricas (KPIs Executivos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Receita Total */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Receita Total</span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-foreground">
            {formatBRL(totalRevenueCents)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+18.4% vs mês anterior</span>
          </div>
        </div>

        {/* Lucro Bruto */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Lucro Estimado</span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-foreground">
            {formatBRL(grossProfitCents)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600">
            <span>Margem Operacional de 58%</span>
          </div>
        </div>

        {/* Clientes Únicos */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Clientes Atendidos</span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/10 text-purple-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-foreground">
            {clientsCount}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600">
            <span>+42 novos tutores</span>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase">Ticket Médio</span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-foreground">
            {formatBRL(averageTicketCents)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
            <span>+12% com combos e táxi pet</span>
          </div>
        </div>
      </div>

      {/* Bloco Central: Curva ABC de Pareto com Gráfico Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Painel da Curva ABC (Pareto) */}
        <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Composição da Curva ABC
              </h3>
              <Badge variant="outline" className="text-[10px] font-bold">
                Princípio 80/20
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Distribuição proporcional da receita por categoria de relevância estratégica:
            </p>

            <div className="space-y-3">
              {/* Classe A */}
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-blue-600" />
                    <span className="text-xs font-black text-blue-900 dark:text-blue-200">
                      Classe A (Essenciais)
                    </span>
                  </div>
                  <span className="text-xs font-black text-blue-900 dark:text-blue-200">
                    {abcStats.a.pct}% da receita
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${abcStats.a.pct}%` }} />
                </div>
                <p className="text-[10px] text-blue-800/80 dark:text-blue-300">
                  {formatBRL(abcStats.a.rev)} gerados pelos seus 20% principais itens.
                </p>
              </div>

              {/* Classe B */}
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-teal-600" />
                    <span className="text-xs font-black text-teal-900 dark:text-teal-200">
                      Classe B (Intermediários)
                    </span>
                  </div>
                  <span className="text-xs font-black text-teal-900 dark:text-teal-200">
                    {abcStats.b.pct}% da receita
                  </span>
                </div>
                <div className="w-full bg-teal-200 dark:bg-teal-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-600 h-full rounded-full" style={{ width: `${abcStats.b.pct}%` }} />
                </div>
                <p className="text-[10px] text-teal-800/80 dark:text-teal-300">
                  {formatBRL(abcStats.b.rev)} com potencial de alavancagem para Classe A.
                </p>
              </div>

              {/* Classe C */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                      Classe C (Cauda Longa)
                    </span>
                  </div>
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                    {abcStats.c.pct}% da receita
                  </span>
                </div>
                <div className="w-full bg-amber-200 dark:bg-amber-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${abcStats.c.pct}%` }} />
                </div>
                <p className="text-[10px] text-amber-800/80 dark:text-amber-300">
                  {formatBRL(abcStats.c.rev)} para manter giro sem sobrecarregar estoque.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-2.5 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Dica Estratégica:</strong> Mantenha estoque de segurança contínuo para itens da <strong>Classe A</strong> e nunca deixe faltar insumos para os banhos de porte médio.
            </span>
          </div>
        </div>

        {/* Tabela de Top Itens do Portfólio (2/3 da tela) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
            <h3 className="text-sm font-black text-foreground">
              Ranking de Faturamento & Classificação ABC
            </h3>

            {/* Filtro por Classe */}
            <div className="flex items-center gap-1">
              {(["todos", "A", "B", "C"] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedFilter(tag)}
                  className={cn(
                    "px-2 py-0.5 text-xs font-bold rounded-lg transition-all",
                    selectedFilter === tag
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tag === "todos" ? "Todos" : `Classe ${tag}`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-black text-[10px] uppercase">
                  <th className="py-2 pr-2">Item / Descrição</th>
                  <th className="py-2 px-2 text-center">Tipo</th>
                  <th className="py-2 px-2 text-center">Classe</th>
                  <th className="py-2 px-2 text-right">Qtd</th>
                  <th className="py-2 px-2 text-right">Faturamento</th>
                  <th className="py-2 pl-2 text-right">% Acum.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-muted-foreground w-4">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-foreground">
                          {item.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] font-bold uppercase",
                          item.category === "servico" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}
                      >
                        {item.category}
                      </Badge>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <Badge
                        className={cn(
                          "text-[10px] font-black px-2 py-0.5",
                          item.classification === "A"
                            ? "bg-blue-600 text-white"
                            : item.classification === "B"
                            ? "bg-teal-600 text-white"
                            : "bg-amber-500 text-slate-950"
                        )}
                      >
                        {item.classification}
                      </Badge>
                    </td>

                    <td className="py-2.5 px-2 text-right font-medium text-muted-foreground">
                      {item.quantity}
                    </td>

                    <td className="py-2.5 px-2 text-right font-black text-foreground">
                      {formatBRL(item.revenueCents)}
                    </td>

                    <td className="py-2.5 pl-2 text-right font-bold text-muted-foreground">
                      {item.cumulativePercentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
