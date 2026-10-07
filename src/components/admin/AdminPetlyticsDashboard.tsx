import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingBag,
  Award,
  BarChart3,
  Calendar,
  Download,
  Info,
  Search,
  Moon,
  Sun,
  ChevronDown,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ComposedChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import vettyPawSymbol from "@/assets/vetty-paw-symbol.png";

export interface AbcRankItem {
  id: string;
  name: string;
  category: "servico" | "produto" | "veterinaria";
  revenueCents: number;
  quantity: number;
  percentage: number;
  cumulativePercentage: number;
  classification: "A" | "B" | "C";
  marginPercent: number;
  trend: number[];
}

export interface AdminPetlyticsDashboardProps {
  totalRevenueCents?: number;
  grossProfitCents?: number;
  clientsCount?: number;
  averageTicketCents?: number;
  items?: AbcRankItem[];
  onExportReport?: () => void;
}

// Itens com dados para atender tanto o padrão como dados ricos do modelo Petlytics
const DEFAULT_ITEMS: AbcRankItem[] = [
  {
    id: "1",
    name: "Ração Royal Canin Maxi Adult 15kg",
    category: "produto",
    revenueCents: 7011970, // R$ 70.119,70
    quantity: 1450,
    percentage: 80.1,
    cumulativePercentage: 80.1,
    classification: "A",
    marginPercent: 15.32,
    trend: [40, 55, 62, 58, 70, 85, 92],
  },
  {
    id: "2",
    name: "Banho & Tosa Completa (Porte Médio)",
    category: "servico",
    revenueCents: 1425000, // R$ 14.250,00
    quantity: 190,
    percentage: 16.2,
    cumulativePercentage: 88.5,
    classification: "A",
    marginPercent: 62.4,
    trend: [30, 45, 50, 60, 58, 65, 75],
  },
  {
    id: "3",
    name: "Vacina Antirrábica e Polivalente V10",
    category: "veterinaria",
    revenueCents: 330611, // R$ 3.306,11
    quantity: 798,
    percentage: 15.2,
    cumulativePercentage: 95.3,
    classification: "B",
    marginPercent: -9.89,
    trend: [35, 30, 40, 38, 42, 40, 45],
  },
  {
    id: "4",
    name: "Antipulgas Bravecto 10 a 20kg",
    category: "produto",
    revenueCents: 425000,
    quantity: 25,
    percentage: 4.8,
    cumulativePercentage: 96.5,
    classification: "B",
    marginPercent: 24.5,
    trend: [20, 25, 22, 30, 28, 35, 32],
  },
  {
    id: "5",
    name: "Hidratação de Pelagem com Ozonioterapia",
    category: "servico",
    revenueCents: 212500,
    quantity: 42,
    percentage: 2.4,
    cumulativePercentage: 98.9,
    classification: "B",
    marginPercent: 55.0,
    trend: [15, 18, 20, 22, 25, 26, 28],
  },
  {
    id: "6",
    name: "Vacina Antirrábica Simples",
    category: "veterinaria",
    revenueCents: 63336, // R$ 633,36
    quantity: 454,
    percentage: 4.7,
    cumulativePercentage: 99.6,
    classification: "C",
    marginPercent: -7.64,
    trend: [22, 20, 18, 21, 19, 17, 18],
  },
  {
    id: "7",
    name: "Brinquedo Mordedor Resistente",
    category: "produto",
    revenueCents: 127500,
    quantity: 35,
    percentage: 1.4,
    cumulativePercentage: 99.8,
    classification: "C",
    marginPercent: 42.0,
    trend: [10, 12, 14, 11, 15, 14, 16],
  },
  {
    id: "8",
    name: "Corte de Unhas & Limpeza de Ouvido",
    category: "servico",
    revenueCents: 63750,
    quantity: 25,
    percentage: 0.7,
    cumulativePercentage: 100.0,
    classification: "C",
    marginPercent: 78.0,
    trend: [8, 9, 12, 11, 10, 12, 11],
  },
];

// Dados da evolução diária de receita do mês (30 dias)
const DAILY_REVENUE_DATA = [
  { day: "1", revenue: 1650 },
  { day: "2", revenue: 2100 },
  { day: "3", revenue: 1800 },
  { day: "4", revenue: 2950 },
  { day: "5", revenue: 2400 },
  { day: "6", revenue: 1950 },
  { day: "7", revenue: 2800 },
  { day: "8", revenue: 2200 },
  { day: "9", revenue: 2100 },
  { day: "10", revenue: 3100 },
  { day: "11", revenue: 2600 },
  { day: "12", revenue: 2300 },
  { day: "13", revenue: 2850 },
  { day: "14", revenue: 3400 },
  { day: "15", revenue: 2900 },
  { day: "16", revenue: 3800 },
  { day: "17", revenue: 3200 },
  { day: "18", revenue: 2750 },
  { day: "19", revenue: 2900 },
  { day: "20", revenue: 3300 },
  { day: "21", revenue: 2600 },
  { day: "22", revenue: 2850 },
  { day: "23", revenue: 2950 },
  { day: "24", revenue: 3150 },
  { day: "25", revenue: 2800 },
  { day: "26", revenue: 3100 },
  { day: "27", revenue: 2950 },
  { day: "28", revenue: 3600 },
  { day: "29", revenue: 3250 },
  { day: "30", revenue: 3400 },
];

// Curva ABC consolidada (Curva de Pareto)
const PARETO_CURVE_DATA = [
  { label: "A (80.1%)", bar: 80.1, line: 80.1, class: "A" },
  { label: "B (15.2%)", bar: 15.2, line: 95.3, class: "B" },
  { label: "C (4.7%)", bar: 4.7, line: 100.0, class: "C" },
];

export function AdminPetlyticsDashboard({
  totalRevenueCents = 8754021, // R$ 87.540,21 (+8.3%)
  grossProfitCents = 3421015, // R$ 34.210,15 (+11.1%)
  clientsCount = 1450, // 1.450 (+5.5%)
  averageTicketCents = 6037, // R$ 60,37 (+2.7%)
  items = DEFAULT_ITEMS,
  onExportReport,
}: AdminPetlyticsDashboardProps) {
  // Estado de tema interno do dashboard: 'dark' (petlytics padrão com fundo preto/verde) ou 'light' (fundo branco)
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [selectedFilter, setSelectedFilter] = useState<"todos" | "A" | "B" | "C">("todos");
  const [selectedPeriod, setSelectedPeriod] = useState<"mes" | "trimestre" | "ano">("mes");
  const [searchQuery, setSearchQuery] = useState("");

  const isDark = themeMode === "dark";

  // Estatísticas das 3 classes
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
      a: { rev: revA, pct: ((revA / sum) * 100).toFixed(1) },
      b: { rev: revB, pct: ((revB / sum) * 100).toFixed(1) },
      c: { rev: revC, pct: ((revC / sum) * 100).toFixed(1) },
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchFilter = selectedFilter === "todos" || it.classification === selectedFilter;
      const matchSearch =
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [items, selectedFilter, searchQuery]);

  return (
    <div
      className={cn(
        "rounded-3xl border transition-all duration-300 p-4 sm:p-6 space-y-6 shadow-2xl font-sans",
        isDark
          ? "bg-[#0c1412] border-emerald-950/60 text-slate-100"
          : "bg-slate-50 border-slate-200 text-slate-800 shadow-sm"
      )}
    >
      {/* 1. TOPO: HEADER EXCLUSIVO PETLYTICS COM LOGO VETTY E SELETOR PRETO/BRANCO */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pb-4 border-b border-border/40">
        {/* Identidade: Vetty + Petlytics */}
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              "grid h-12 w-12 place-items-center rounded-2xl shadow-md border transition-transform hover:scale-105",
              isDark
                ? "bg-gradient-to-br from-[#102a24] to-[#0a1815] border-emerald-500/40 text-emerald-400 shadow-emerald-950/50"
                : "bg-gradient-to-br from-emerald-50 to-teal-100 border-emerald-200 text-emerald-700 shadow-slate-200"
            )}
          >
            <img
              src={vettyPawSymbol}
              alt="Vetty"
              className="h-7 w-7 object-contain drop-shadow"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-1.5">
                <span className={isDark ? "text-white" : "text-slate-900"}>VETTY</span>
                <span className="text-emerald-500 font-extrabold text-sm sm:text-base tracking-widest uppercase">
                  BI
                </span>
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-black px-2 py-0.5 tracking-wider rounded-md",
                  isDark
                    ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-400"
                    : "bg-emerald-100 border-emerald-300 text-emerald-800"
                )}
              >
                PETLYTICS ENGINE
              </Badge>
            </div>
            <p className={cn("text-xs font-semibold", isDark ? "text-emerald-500/80" : "text-emerald-700")}>
              RELATÓRIOS INTELIGENTES & CURVA ABC · <span className={isDark ? "text-slate-400" : "text-slate-500"}>Janeiro 2024</span>
            </p>
          </div>
        </div>

        {/* Controles: Busca, Alternador Preto/Branco, Exportar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campo de Busca Rápida */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-full sm:w-48 transition-colors",
              isDark
                ? "bg-[#14221e] border-emerald-900/60 text-slate-200 focus-within:border-emerald-500"
                : "bg-white border-slate-300 text-slate-800 focus-within:border-emerald-600"
            )}
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-xs placeholder:text-muted-foreground"
            />
          </div>

          {/* Alternador de Tema (Fundo Preto Petlytics vs Fundo Branco) */}
          <div
            className={cn(
              "flex items-center p-1 rounded-xl border gap-1",
              isDark ? "bg-[#14221e] border-emerald-900/60" : "bg-white border-slate-300"
            )}
          >
            <button
              type="button"
              onClick={() => setThemeMode("dark")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                isDark
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              )}
              title="Visual Petlytics (Fundo Escuro Neon)"
            >
              <Moon className="h-3 w-3" />
              <span>Preto</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode("light")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                !isDark
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
              title="Visual Claro (Fundo Branco)"
            >
              <Sun className="h-3 w-3" />
              <span>Branco</span>
            </button>
          </div>

          {/* Botão de Exportação */}
          {onExportReport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportReport}
              className={cn(
                "h-8 rounded-xl text-xs font-bold gap-1.5 transition-all",
                isDark
                  ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 hover:text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              )}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          )}
        </div>
      </div>

      {/* 2. 4 CARDS DE MÉTRICAS COM MINI GRÁFICOS (EXATAMENTE COMO NO MODELO PETLYTICS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Receita Total */}
        <div
          className={cn(
            "rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-36",
            isDark
              ? "bg-[#101b17] border-emerald-900/60 shadow-lg shadow-emerald-950/20"
              : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>RECEITA TOTAL (R$)</span>
              <span className="text-emerald-500 font-bold text-[11px]">+8.3%</span>
            </div>
            <div className="text-2xl font-black tracking-tight mt-1">
              {formatBRL(totalRevenueCents)}
            </div>
          </div>
          {/* Mini Gráfico Neon */}
          <div className="h-10 w-full mt-2 -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DAILY_REVENUE_DATA.slice(-8)}>
                <defs>
                  <linearGradient id="glowGreen1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#glowGreen1)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Lucro Bruto */}
        <div
          className={cn(
            "rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-36",
            isDark
              ? "bg-[#101b17] border-emerald-900/60 shadow-lg shadow-emerald-950/20"
              : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>LUCRO BRUTO (R$)</span>
              <span className="text-emerald-500 font-bold text-[11px]">+11.1%</span>
            </div>
            <div className="text-2xl font-black tracking-tight mt-1">
              {formatBRL(grossProfitCents)}
            </div>
          </div>
          {/* Mini Gráfico Neon */}
          <div className="h-10 w-full mt-2 -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DAILY_REVENUE_DATA.slice(-8)}>
                <defs>
                  <linearGradient id="glowGreen2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="url(#glowGreen2)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Clientes Atendidos */}
        <div
          className={cn(
            "rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-36",
            isDark
              ? "bg-[#101b17] border-emerald-900/60 shadow-lg shadow-emerald-950/20"
              : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>CLIENTES ATENDIDOS</span>
              <span className="text-emerald-500 font-bold text-[11px]">+5.5%</span>
            </div>
            <div className="text-2xl font-black tracking-tight mt-1">
              {clientsCount.toLocaleString("pt-BR")}
            </div>
          </div>
          {/* Mini Gráfico Neon */}
          <div className="h-10 w-full mt-2 -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DAILY_REVENUE_DATA.slice(-8)}>
                <defs>
                  <linearGradient id="glowGreen3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  fill="url(#glowGreen3)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 4: Tickets Médios */}
        <div
          className={cn(
            "rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-36",
            isDark
              ? "bg-[#101b17] border-emerald-900/60 shadow-lg shadow-emerald-950/20"
              : "bg-white border-slate-200 shadow-sm"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>TICKETS MÉDIOS</span>
              <span className="text-emerald-500 font-bold text-[11px]">+2.7%</span>
            </div>
            <div className="text-2xl font-black tracking-tight mt-1">
              {formatBRL(averageTicketCents)}
            </div>
          </div>
          {/* Mini Gráfico Neon */}
          <div className="h-10 w-full mt-2 -mb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DAILY_REVENUE_DATA.slice(-8)}>
                <defs>
                  <linearGradient id="glowGreen4" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#glowGreen4)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO CENTRAL COM OS 3 GRÁFICOS: EVOLUÇÃO DIÁRIA + ANÁLISE CURVA ABC + DETALHAMENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Gráfico 1: Evolução da Receita Diária */}
        <div
          className={cn(
            "lg:col-span-4 rounded-2xl p-4 border flex flex-col justify-between",
            isDark ? "bg-[#101b17] border-emerald-900/60" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide">
              EVOLUÇÃO DA RECEITA DIÁRIA (R$)
            </span>
            <span className="text-[10px] text-muted-foreground">avg R$ 2,8k</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAILY_REVENUE_DATA}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? "#142c23" : "#e2e8f0"}
                />
                <XAxis
                  dataKey="day"
                  stroke={isDark ? "#4b6b5f" : "#94a3b8"}
                  fontSize={10}
                  tickLine={false}
                  interval={4}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(val: number) => [`R$ ${val.toLocaleString("pt-BR")}`, "Receita"]}
                  labelFormatter={(lbl) => `Dia ${lbl}`}
                  contentStyle={{
                    backgroundColor: isDark ? "#091411" : "#ffffff",
                    borderColor: isDark ? "#10b981" : "#cbd5e1",
                    color: isDark ? "#ffffff" : "#0f172a",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#10b981"
                  radius={[3, 3, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Análise Curva ABC - Receita (Pareto) */}
        <div
          className={cn(
            "lg:col-span-5 rounded-2xl p-4 border flex flex-col justify-between",
            isDark ? "bg-[#101b17] border-emerald-900/60" : "bg-white border-slate-200"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
              ANÁLISE CURVA ABC - RECEITA <span className={isDark ? "text-slate-400" : "text-slate-500"}>(Janeiro 2024)</span>
            </span>
            <span className="text-[10px] text-muted-foreground">Categorias: 100+ items</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={PARETO_CURVE_DATA}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? "#142c23" : "#e2e8f0"}
                />
                <XAxis
                  dataKey="label"
                  stroke={isDark ? "#4b6b5f" : "#94a3b8"}
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke={isDark ? "#4b6b5f" : "#94a3b8"}
                  fontSize={10}
                  unit="%"
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    `${val}%`,
                    name === "bar" ? "Fatia da Classe" : "Acumulado Pareto",
                  ]}
                  contentStyle={{
                    backgroundColor: isDark ? "#091411" : "#ffffff",
                    borderColor: isDark ? "#10b981" : "#cbd5e1",
                    color: isDark ? "#ffffff" : "#0f172a",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="bar"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={50}
                />
                <Line
                  type="monotone"
                  dataKey="line"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#34d399" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bloco 3: Detalhamento Curva ABC */}
        <div
          className={cn(
            "lg:col-span-3 rounded-2xl p-4 border flex flex-col justify-between space-y-3",
            isDark ? "bg-[#101b17] border-emerald-900/60" : "bg-white border-slate-200"
          )}
        >
          <div className="border-b border-border/40 pb-2">
            <span className="text-xs font-bold uppercase tracking-wide">
              DETALHAMENTO CURVA ABC
            </span>
          </div>

          <div className="space-y-3">
            {/* Classe A */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Classe A
                </span>
                <span className="text-emerald-400 font-extrabold">
                  80.1% / R$ 70.119,70
                </span>
              </div>
              <div className="w-full bg-emerald-950/40 h-2 rounded-full overflow-hidden border border-emerald-900/40">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: "80.1%" }} />
              </div>
            </div>

            {/* Classe B */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-teal-400">
                  <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />
                  Classe B
                </span>
                <span className="text-teal-400 font-extrabold">
                  15.2% / R$ 13.306,11
                </span>
              </div>
              <div className="w-full bg-teal-950/40 h-2 rounded-full overflow-hidden border border-teal-900/40">
                <div className="bg-teal-500 h-full rounded-full" style={{ width: "15.2%" }} />
              </div>
            </div>

            {/* Classe C */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-lime-400">
                  <span className="h-2.5 w-2.5 rounded-sm bg-lime-500" />
                  Classe C
                </span>
                <span className="text-lime-400 font-extrabold">
                  4.7% / R$ 4.114,40
                </span>
              </div>
              <div className="w-full bg-lime-950/40 h-2 rounded-full overflow-hidden border border-lime-900/40">
                <div className="bg-lime-500 h-full rounded-full" style={{ width: "4.7%" }} />
              </div>
            </div>
          </div>

          <div
            className={cn(
              "text-[10px] p-2.5 rounded-xl border flex items-center gap-2",
              isDark
                ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>Foco 80/20: 80% do seu faturamento vem dos 20% principais itens.</span>
          </div>
        </div>
      </div>

      {/* 4. TABELA COMPLETA DE TOP PRODUTOS & SERVIÇOS */}
      <div
        className={cn(
          "rounded-2xl border p-4 sm:p-5 space-y-4",
          isDark ? "bg-[#101b17] border-emerald-900/60" : "bg-white border-slate-200"
        )}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              TOP PRODUTOS & SERVIÇOS
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Classificação por margem de lucro e faturamento bruto
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtros ABC */}
            <div
              className={cn(
                "flex items-center gap-1 p-1 rounded-xl border",
                isDark ? "bg-[#14221e] border-emerald-900/60" : "bg-slate-100 border-slate-300"
              )}
            >
              {(["todos", "A", "B", "C"] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedFilter(tag)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                    selectedFilter === tag
                      ? isDark
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-900 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tag === "todos" ? "Todos" : `Classe ${tag}`}
                </button>
              ))}
            </div>

            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-2 py-1 gap-1",
                isDark ? "border-emerald-800 text-emerald-400" : "border-slate-300 text-slate-700"
              )}
            >
              Interactive table
              <ChevronDown className="h-3 w-3" />
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={cn(
                  "border-b text-[10px] uppercase font-black",
                  isDark
                    ? "border-emerald-950 text-slate-400"
                    : "border-slate-200 text-slate-500"
                )}
              >
                <th className="py-2.5 pr-2">Rank</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Categoria</th>
                <th className="py-2.5 px-3 text-center">Classe ABC</th>
                <th className="py-2.5 px-3 text-right">Vendas</th>
                <th className="py-2.5 px-3 text-right">Receita (R$)</th>
                <th className="py-2.5 px-3 text-right">Lucro (%)</th>
                <th className="py-2.5 pl-3 text-center w-28">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={cn(
                    "transition-colors",
                    isDark ? "hover:bg-[#142520]" : "hover:bg-slate-50"
                  )}
                >
                  <td className="py-3 pr-2 font-bold text-muted-foreground">
                    #{idx + 1}
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-lg text-xs font-bold shrink-0",
                          item.category === "servico"
                            ? "bg-sky-500/10 text-sky-400"
                            : item.category === "veterinaria"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-emerald-500/10 text-emerald-400"
                        )}
                      >
                        {item.category === "servico" ? "✂️" : item.category === "veterinaria" ? "💉" : "📦"}
                      </div>
                      <span className="font-bold text-sm">{item.name}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="capitalize text-muted-foreground font-semibold">
                      {item.category}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <Badge
                      className={cn(
                        "text-[10px] font-black px-2.5 py-0.5",
                        item.classification === "A"
                          ? "bg-emerald-600 text-white"
                          : item.classification === "B"
                          ? "bg-teal-600 text-white"
                          : "bg-amber-600 text-white"
                      )}
                    >
                      {item.classification}
                    </Badge>
                  </td>

                  <td className="py-3 px-3 text-right font-medium">
                    {item.quantity.toLocaleString("pt-BR")}
                  </td>

                  <td className="py-3 px-3 text-right font-black text-sm">
                    {formatBRL(item.revenueCents)}
                  </td>

                  <td
                    className={cn(
                      "py-3 px-3 text-right font-black",
                      item.marginPercent >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}
                  >
                    {item.marginPercent >= 0 ? `+${item.marginPercent}%` : `${item.marginPercent}%`}
                  </td>

                  {/* Sparkline de Performance */}
                  <td className="py-3 pl-3 text-center">
                    <div className="h-6 w-24 mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={item.trend.map((val, i) => ({ step: i, val }))}
                        >
                          <Area
                            type="monotone"
                            dataKey="val"
                            stroke={item.marginPercent >= 0 ? "#10b981" : "#ef4444"}
                            strokeWidth={2}
                            fill={item.marginPercent >= 0 ? "#10b981" : "#ef4444"}
                            fillOpacity={0.2}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
