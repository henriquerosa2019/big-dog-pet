import React from "react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

// Paleta de cores para as barras horizontais conforme o modelo enviado pelo gestor
const BAR_COLORS = [
  "#1e4a79", // 1º / Classe A (Azul Escuro / Marinho)
  "#2b75b8", // 2º / Classe A (Azul Médio / Steel Blue)
  "#149d8c", // 3º / Classe B (Teal / Verde Petróleo)
  "#48bb78", // 4º / Classe C (Verde Suave)
  "#319795", // 5º
  "#d69e2e", // 6º (Dourado / Âmbar)
];

export type AbcBarItem = {
  name: string;
  classTag?: "A" | "B" | "C";
  valueCents: number;
  subtext?: string;
};

export type AbcDonutSlice = {
  label: string;
  valueCents: number;
  percent: number;
  color?: string;
  subtext?: string;
};

const DEFAULT_DONUT_COLORS = [
  "#2563eb", // Azul 600
  "#4f46e5", // Índigo 600
  "#10b981", // Esmeralda 500
  "#f59e0b", // Âmbar 500
  "#0d9488", // Teal 600
  "#8b5cf6", // Roxo 500
  "#ec4899", // Rosa 500
];

/**
 * Gráfico de Barras Horizontais Executivo
 * Formato idêntico ao modelo fornecido pelo gestor:
 * - Eixo com nomes à esquerda com classe (A, B, C)
 * - Linha divisória vertical
 * - Barras coloridas sólidas com valor faturado em negrito à direita
 */
export function AbcHorizontalBarChart({
  title,
  tagLabel = "Top Faturamento",
  description,
  items,
  totalCents,
  footerMetric,
  maxItems = 5,
}: {
  title: string;
  tagLabel?: string;
  description?: string;
  items: AbcBarItem[];
  totalCents?: number;
  footerMetric?: string;
  maxItems?: number;
}) {
  const displayItems = items.slice(0, maxItems);
  const maxValue = displayItems.reduce((max, cur) => Math.max(max, cur.valueCents), 0);

  return (
    <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-card flex flex-col justify-between border border-border/50">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <span className="text-primary">📊</span> {title}
          </h3>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-secondary text-secondary-foreground rounded-lg">
            {tagLabel}
          </span>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-4">{description}</p>
        )}
      </div>

      {displayItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Sem dados para o período selecionado.
        </div>
      ) : (
        <div className="space-y-3.5 my-auto py-2">
          {displayItems.map((item, index) => {
            const barWidthPercent = maxValue > 0 ? Math.max(6, Math.round((item.valueCents / maxValue) * 100)) : 0;
            const barColor = BAR_COLORS[index % BAR_COLORS.length];

            return (
              <div key={item.name + index} className="grid grid-cols-12 items-center gap-2 sm:gap-3">
                {/* Nome do item à esquerda com classe */}
                <div className="col-span-5 sm:col-span-4 text-right font-medium text-xs sm:text-sm text-foreground/90 truncate">
                  <span title={item.name}>{item.name}</span>{" "}
                  {item.classTag && (
                    <span
                      className={cn(
                        "font-bold text-[11px] sm:text-xs",
                        item.classTag === "A"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : item.classTag === "B"
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      ({item.classTag})
                    </span>
                  )}
                </div>

                {/* Linha vertical e barra horizontal */}
                <div className="col-span-7 sm:col-span-8 flex items-center gap-2.5 border-l-2 border-border/80 pl-2.5 py-0.5">
                  <div
                    className="h-7 sm:h-8 rounded-r-md transition-all duration-500 flex items-center"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: barColor,
                    }}
                  />
                  <span className="font-extrabold text-foreground text-xs sm:text-sm whitespace-nowrap">
                    {formatBRL(item.valueCents)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(totalCents !== undefined || footerMetric) && (
        <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
          {totalCents !== undefined && (
            <span>
              Total no período: <strong className="text-foreground">{formatBRL(totalCents)}</strong>
            </span>
          )}
          {footerMetric && (
            <span className="font-medium text-primary">{footerMetric}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Gráfico de Pizza / Donut Executivo em SVG responsivo
 * Totalmente fluido, acessível, sem dependência de canvas externa, compatível com Dark Mode
 */
export function AbcDonutChart({
  title,
  tagLabel = "Visão Pizza",
  description,
  slices,
  totalCents,
  centerLabel = "Total",
}: {
  title: string;
  tagLabel?: string;
  description?: string;
  slices: AbcDonutSlice[];
  totalCents?: number;
  centerLabel?: string;
}) {
  const radius = 70;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  // Filtra fatias com percentual > 0
  const validSlices = slices.filter((s) => s.percent > 0);
  const sumPercent = validSlices.reduce((acc, s) => acc + s.percent, 0);

  let accumulatedPercent = 0;

  return (
    <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-card flex flex-col justify-between border border-border/50">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <span className="text-amber-500">🍕</span> {title}
          </h3>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-lg">
            {tagLabel}
          </span>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
        )}
      </div>

      {validSlices.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Sem dados suficientes para gerar a divisão.
        </div>
      ) : (
        <>
          {/* SVG Donut */}
          <div className="relative flex items-center justify-center my-3">
            <svg
              viewBox="0 0 200 200"
              className="w-44 h-44 sm:w-48 sm:h-48 transform -rotate-90 overflow-visible"
            >
              {/* Círculo de fundo */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-secondary/40"
              />

              {/* Fatias */}
              {validSlices.map((slice, i) => {
                const normalizedPercent = sumPercent > 0 ? (slice.percent / sumPercent) * 100 : 0;
                const dashLength = (normalizedPercent / 100) * circumference;
                const dashOffset = -((accumulatedPercent / 100) * circumference);
                accumulatedPercent += normalizedPercent;

                const color = slice.color || DEFAULT_DONUT_COLORS[i % DEFAULT_DONUT_COLORS.length];

                return (
                  <circle
                    key={slice.label + i}
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-700 hover:opacity-90"
                  />
                );
              })}
            </svg>

            {/* Texto Central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                {centerLabel}
              </span>
              <span className="text-xs sm:text-sm font-bold text-foreground mt-0.5">
                {totalCents !== undefined ? formatBRL(totalCents) : "100%"}
              </span>
            </div>
          </div>

          {/* Cards de Legenda abaixo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50 text-center">
            {validSlices.slice(0, 6).map((slice, i) => {
              const color = slice.color || DEFAULT_DONUT_COLORS[i % DEFAULT_DONUT_COLORS.length];

              return (
                <div
                  key={slice.label + i}
                  className="p-2 rounded-xl bg-secondary/30 border border-border/40 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <p className="text-[10px] uppercase font-bold text-muted-foreground truncate" title={slice.label}>
                      {slice.label}
                    </p>
                  </div>
                  <p className="text-xs font-extrabold text-foreground">
                    {formatBRL(slice.valueCents)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {slice.percent.toFixed(1)}% {slice.subtext ? `· ${slice.subtext}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
