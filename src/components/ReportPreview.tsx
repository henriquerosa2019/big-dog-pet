import { useState, useMemo, useRef, useEffect } from "react";
import { formatBRL, formatDate, CLINIC } from "@/lib/format";
import type { ReportData, ReportRange } from "@/lib/reports";

/**
 * Versão em tela do relatório financeiro — mesmo conteúdo e mesma ordem do PDF
 * gerado por `exportReportPDF`, pra loja conferir antes de baixar (ou nem
 * baixar).
 */

const PIE_COLORS = {
  servicos: { color: "#367cfb", dark: "#1b53b8", label: "Serviços" },
  produtos: { color: "#ff00cc", dark: "#9c007d", label: "Produtos" },
  transporte: { color: "#f7ad00", dark: "#aa7700", label: "Transporte" },
} as const;

/** Igual ao PDF: as tabelas analíticas mostram os 12 maiores valores. */
const ROW_LIMIT = 12;

function FaturamentoPizzaChart3D({ data }: { data: ReportData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const total = data.totals.grossCents;
  const slicesData = useMemo(() => {
    return [
      {
        key: "servicos" as const,
        label: PIE_COLORS.servicos.label,
        value: data.totals.servicesCents,
        color: PIE_COLORS.servicos.color,
        darkColor: PIE_COLORS.servicos.dark,
      },
      {
        key: "produtos" as const,
        label: PIE_COLORS.produtos.label,
        value: data.totals.productsCents,
        color: PIE_COLORS.produtos.color,
        darkColor: PIE_COLORS.produtos.dark,
      },
      {
        key: "transporte" as const,
        label: PIE_COLORS.transporte.label,
        value: data.totals.transportCents,
        color: PIE_COLORS.transporte.color,
        darkColor: PIE_COLORS.transporte.dark,
      },
    ];
  }, [data.totals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayWidth = 400;
    const displayHeight = 260;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (total <= 0) {
      ctx.font = '13px Calibri, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = "#888888";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Sem dados de faturamento no período.", displayWidth / 2, displayHeight / 2);
      return;
    }

    const cx = displayWidth * 0.48;
    const cy = displayHeight * 0.44;
    const rx = 130;
    const ry = 74;
    const depth = 24;
    const explodePx = 6; // Afastamento sutil de 6px aprovado pelo gestor

    // Identifica a maior fatia
    let maxIdx = 0;
    slicesData.forEach((s, idx) => {
      const currentMax = slicesData[maxIdx];
      if (currentMax && s.value > currentMax.value) maxIdx = idx;
    });

    let currentAngle = -Math.PI / 2;
    const slices = slicesData.map((d, index) => {
      const sweep = total > 0 ? (d.value / total) * 2 * Math.PI : 0;
      const start = currentAngle;
      const end = currentAngle + sweep;
      const mid = (start + end) / 2;
      currentAngle = end;

      const isMax = index === maxIdx && d.value > 0;
      const dist = isMax ? explodePx : 0;
      const dx = dist * Math.cos(mid);
      const dy = dist * Math.sin(mid) * (ry / rx);

      return {
        ...d,
        index,
        isMax,
        percent: total > 0 ? (d.value / total) * 100 : 0,
        start,
        end,
        mid,
        dx,
        dy,
      };
    });

    // 1. Paredes laterais 3D
    slices.forEach((f) => {
      if (f.value <= 0) return;
      const scx = cx + f.dx;
      const scy = cy + f.dy;

      // Paredes radiais da fatia destacada
      if (f.dx !== 0 || f.dy !== 0) {
        ctx.fillStyle = f.darkColor;
        ctx.beginPath();
        ctx.moveTo(scx, scy);
        ctx.lineTo(scx + rx * Math.cos(f.start), scy + ry * Math.sin(f.start));
        ctx.lineTo(scx + rx * Math.cos(f.start), scy + ry * Math.sin(f.start) + depth);
        ctx.lineTo(scx, scy + depth);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(scx, scy);
        ctx.lineTo(scx + rx * Math.cos(f.end), scy + ry * Math.sin(f.end));
        ctx.lineTo(scx + rx * Math.cos(f.end), scy + ry * Math.sin(f.end) + depth);
        ctx.lineTo(scx, scy + depth);
        ctx.closePath();
        ctx.fill();
      }

      // Curvatura cilíndrica frontal
      const passos = 50;
      const passoAng = (f.end - f.start) / passos;
      for (let i = 0; i < passos; i++) {
        const a1 = f.start + i * passoAng;
        const a2 = a1 + passoAng;
        const aMid = (a1 + a2) / 2;
        if (Math.sin(aMid) > -0.05) {
          ctx.fillStyle = f.darkColor;
          ctx.beginPath();
          ctx.moveTo(scx + rx * Math.cos(a1), scy + ry * Math.sin(a1));
          ctx.lineTo(scx + rx * Math.cos(a2), scy + ry * Math.sin(a2));
          ctx.lineTo(scx + rx * Math.cos(a2), scy + ry * Math.sin(a2) + depth);
          ctx.lineTo(scx + rx * Math.cos(a1), scy + ry * Math.sin(a1) + depth);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    // 2. Faces superiores elípticas
    slices.forEach((f) => {
      if (f.value <= 0) return;
      const scx = cx + f.dx;
      const scy = cy + f.dy;

      ctx.fillStyle = f.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(scx, scy);
      ctx.ellipse(scx, scy, rx, ry, 0, f.start, f.end);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // 3. Percentuais em branco com sombra no centro das fatias
    slices.forEach((f) => {
      if (f.value <= 0 || f.percent < 4) return;
      const scx = cx + f.dx;
      const scy = cy + f.dy;

      const labelDist = 0.62;
      const lx = scx + rx * labelDist * Math.cos(f.mid);
      const ly = scy + ry * labelDist * Math.sin(f.mid);

      ctx.font = 'bold 13.5px Calibri, "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      const pctText = f.percent.toFixed(1).replace(".", ",") + "%";
      ctx.fillText(pctText, lx, ly);

      ctx.shadowColor = "transparent";
    });
  }, [total, slicesData]);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
      <div className="text-center mb-3">
        <h4 className="text-sm sm:text-base font-bold text-foreground">
          Faturamento por Categoria — Serviços, Produtos e Transporte
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Distribuição percentual da receita realizada no período
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10 py-2">
        {/* Canvas 3D */}
        <div className="relative flex items-center justify-center">
          <canvas ref={canvasRef} className="max-w-full h-auto drop-shadow-sm" />
        </div>

        {/* Legenda Lateral Direita idêntica à imagem de referência */}
        <div className="flex flex-col justify-center space-y-3.5 min-w-[210px] w-full md:w-auto">
          {slicesData.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs sm:text-sm font-medium text-foreground">{s.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-foreground">{formatBRL(s.value)}</span>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    ({pct.toFixed(1).replace(".", ",")}%)
                  </span>
                </div>
              </div>
            );
          })}

          <div className="mt-2 pt-2.5 border-t border-border flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Total Realizado:</span>
            <span className="font-bold text-sm text-primary">{formatBRL(data.totals.grossCents)}</span>
          </div>
          {data.open.grossCents > 0 && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Em aberto:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {formatBRL(data.open.grossCents)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé do gráfico com Campanha Niver mantida */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 text-foreground font-medium">
          <span className="text-base">🎂</span>
          <span>Campanha Niver:</span>
          <span className="text-muted-foreground">
            <strong className="text-primary font-bold">{data.campaignNiver.count}</strong> de{" "}
            {data.campaignNiver.totalServices} agendamentos (
            <strong className="text-primary font-bold">
              {data.campaignNiver.percent.toFixed(1)}%
            </strong>
            )
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-0.5 rounded-full border border-border/50">
          Desconto de 20% no mês de aniversário do pet
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  return (
    <th
      className={`whitespace-nowrap px-2 py-1.5 font-semibold ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  colSpan,
  className,
}: {
  children: React.ReactNode;
  align?: "right" | "center";
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-2 py-1.5 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className ?? ""}`}
    >
      {children}
    </td>
  );
}

/** Rótulo + valor de uma linha no formato de cartão usado no celular. */
function CardLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-xs">{value}</span>
    </div>
  );
}

function Situacao({ realized }: { realized: boolean }) {
  return <>{realized ? "Realizado" : "Em aberto"}</>;
}

export function ReportPreview({
  data,
  range,
  generatedAt,
}: {
  data: ReportData;
  range: ReportRange;
  generatedAt: Date;
}) {
  const [serviceFilter, setServiceFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "realizado" | "aberto">("todos");

  const filteredServices = useMemo(() => {
    return data.services
      .filter((s) => {
        // Filtro de Situação
        if (statusFilter === "realizado" && !s.realized) return false;
        if (statusFilter === "aberto" && s.realized) return false;

        // Filtro de Serviço
        if (serviceFilter === "todos") return true;
        const nameNorm = s.serviceName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        if (serviceFilter === "banho_tosa_higienica") {
          return (
            nameNorm.includes("higienica") ||
            (nameNorm.includes("banho") && nameNorm.includes("tosa") && nameNorm.includes("hig"))
          );
        }
        if (serviceFilter === "banho_e_tosa") {
          return (
            (nameNorm.includes("banho e tosa") || nameNorm.includes("banho + tosa")) &&
            !nameNorm.includes("higienica")
          );
        }
        if (serviceFilter === "banho") {
          return nameNorm.includes("banho") && !nameNorm.includes("tosa");
        }
        if (serviceFilter === "tosa") {
          return nameNorm.includes("tosa") && !nameNorm.includes("banho");
        }
        if (serviceFilter === "veterinario") {
          return (
            nameNorm.includes("veterin") ||
            nameNorm.includes("consulta") ||
            nameNorm.includes("vacina") ||
            nameNorm.includes("exame")
          );
        }
        if (serviceFilter === "hidratacao_escovacao") {
          return nameNorm.includes("hidrata") || nameNorm.includes("escova");
        }
        return true;
      })
      .sort((a, b) => b.priceCents - a.priceCents);
  }, [data.services, serviceFilter, statusFilter]);

  const topServices = filteredServices.slice(0, ROW_LIMIT);
  const totalFilteredCents = useMemo(
    () => filteredServices.reduce((sum, s) => sum + s.priceCents, 0),
    [filteredServices],
  );

  const products = [...data.products].sort(
    (a, b) => b.unitPriceCents * b.quantity - a.unitPriceCents * a.quantity,
  );
  const topProducts = products.slice(0, ROW_LIMIT);
  const totalProductsQuantity = useMemo(
    () => products.reduce((sum, p) => sum + p.quantity, 0),
    [products],
  );
  const totalProductsCents = useMemo(
    () => products.reduce((sum, p) => sum + p.unitPriceCents * p.quantity, 0),
    [products],
  );

  return (
    <div className="mt-3 rounded-2xl bg-card p-3 shadow-card md:p-5">
      <h3 className="font-display text-base md:text-xl">
        Relatório financeiro — {CLINIC.fullName}
      </h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Período: {range.label}</p>
      <p className="text-[11px] text-muted-foreground">
        Gerado em {generatedAt.toLocaleString("pt-BR")}
      </p>

      {/* Gráfico de Pizza 3D Centralizado no Painel (idêntico à referência) */}
      <div className="mt-3">
        <FaturamentoPizzaChart3D data={data} />
      </div>

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
          <SectionTitle>Serviços no período</SectionTitle>
          <span className="text-[11px] text-muted-foreground">
            Mostrando <strong className="text-foreground font-semibold">{filteredServices.length}</strong> serviços
            {filteredServices.length > 0 && ` (${formatBRL(totalFilteredCents)})`}
          </span>
        </div>

        {/* Barra de Filtros por Serviço e Situação solicitada pelo gestor */}
        <div className="mt-2.5 mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-border/80 bg-muted/20 p-2.5">
          {/* Filtro: Serviço */}
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="filter-service" className="text-xs font-semibold text-muted-foreground">
              Serviço:
            </label>
            <select
              id="filter-service"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="todos">Todos os serviços</option>
              <option value="banho_tosa_higienica">Banho + Tosa Higiênica</option>
              <option value="banho_e_tosa">Banho e Tosa</option>
              <option value="banho">Banho</option>
              <option value="tosa">Tosa</option>
              <option value="veterinario">Veterinário</option>
              <option value="hidratacao_escovacao">Hidratação e Escovação</option>
            </select>
          </div>

          {/* Filtro: Situação */}
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="filter-status" className="text-xs font-semibold text-muted-foreground">
              Situação:
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "todos" | "realizado" | "aberto")}
              className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="todos">Todas as situações</option>
              <option value="realizado">Realizado</option>
              <option value="aberto">Em Aberto</option>
            </select>
          </div>

          {/* Atalho para limpar filtros */}
          {(serviceFilter !== "todos" || statusFilter !== "todos") && (
            <button
              type="button"
              onClick={() => {
                setServiceFilter("todos");
                setStatusFilter("todos");
              }}
              className="ml-auto text-xs font-semibold text-primary underline hover:opacity-80"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {filteredServices.length === 0 ? (
          <p className="mt-3 text-center text-xs text-muted-foreground py-5">
            Nenhum serviço encontrado com os filtros selecionados.
          </p>
        ) : (
          <>
            {/* Celular: cada serviço vira um cartão */}
            <ul className="mt-1.5 space-y-1.5 sm:hidden">
              {topServices.map((s) => (
                <li key={s.id} className="rounded-xl surface-paper p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-semibold">{s.serviceName}</p>
                    <p className="shrink-0 text-xs font-semibold text-primary">
                      {formatBRL(s.priceCents)}
                    </p>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <CardLine label="Data" value={formatDate(s.date)} />
                    <CardLine
                      label="Cliente"
                      value={`${s.clientName}${s.petName ? ` · ${s.petName}` : ""}`}
                    />
                    <CardLine label="Situação" value={<Situacao realized={s.realized} />} />
                    {s.isCampaignNiver && <CardLine label="Campanha Niver" value="Sim" />}
                  </div>
                </li>
              ))}
            </ul>

            {/* Celular: totalizador dos serviços */}
            <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-2.5 text-xs font-semibold sm:hidden">
              <span className="text-muted-foreground">Total dos serviços:</span>
              <span className="font-bold text-foreground">{formatBRL(totalFilteredCents)}</span>
            </div>

            {/* Tablet e desktop: tabela */}
            <div className="mt-1.5 hidden overflow-x-auto sm:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <Th>Data</Th>
                    <Th>Cliente</Th>
                    <Th>Pet</Th>
                    <Th>Serviço</Th>
                    <Th>Situação</Th>
                    <Th align="center">Niver</Th>
                    <Th align="right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {topServices.map((s) => (
                    <tr key={s.id} className="border-b border-border/60">
                      <Td>{formatDate(s.date)}</Td>
                      <Td>{s.clientName}</Td>
                      <Td>{s.petName}</Td>
                      <Td>{s.serviceName}</Td>
                      <Td>
                        <Situacao realized={s.realized} />
                      </Td>
                      <Td align="center">{s.isCampaignNiver ? "Sim" : "-"}</Td>
                      <Td align="right">{formatBRL(s.priceCents)}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/80 bg-muted/20 font-bold">
                    <Td colSpan={6} align="right" className="py-2.5 font-bold text-foreground">
                      Total:
                    </Td>
                    <Td align="right" className="py-2.5 font-bold text-foreground text-xs sm:text-sm">
                      {formatBRL(totalFilteredCents)}
                    </Td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filteredServices.length > ROW_LIMIT && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Mostrando os {ROW_LIMIT} maiores de {filteredServices.length} serviços filtrados — a planilha do
                Excel traz a lista completa.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-5">
        <SectionTitle>Produtos vendidos no período</SectionTitle>
        {topProducts.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Nenhum produto vendido no período.
          </p>
        ) : (
          <>
            <ul className="mt-1.5 space-y-1.5 sm:hidden">
              {topProducts.map((p, i) => (
                <li key={`${p.orderId}-${p.productName}-${i}`} className="rounded-xl surface-paper p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-semibold">{p.productName}</p>
                    <p className="shrink-0 text-xs font-semibold text-primary">
                      {formatBRL(p.unitPriceCents * p.quantity)}
                    </p>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <CardLine label="Data" value={formatDate(p.date)} />
                    <CardLine label="Cliente" value={p.clientName} />
                    <CardLine label="Pedido" value={p.orderId.slice(0, 8)} />
                    <CardLine label="Situação" value={<Situacao realized={p.realized} />} />
                    <CardLine label="Qtd" value={p.quantity} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Celular: totalizador dos produtos */}
            <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-2.5 text-xs font-semibold sm:hidden">
              <span className="text-muted-foreground">
                Total dos produtos ({totalProductsQuantity} {totalProductsQuantity === 1 ? "item" : "itens"}):
              </span>
              <span className="font-bold text-foreground">{formatBRL(totalProductsCents)}</span>
            </div>

            <div className="mt-1.5 hidden overflow-x-auto sm:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <Th>Data</Th>
                    <Th>Pedido</Th>
                    <Th>Cliente</Th>
                    <Th>Produto</Th>
                    <Th>Situação</Th>
                    <Th align="center">Qtd</Th>
                    <Th align="right">Subtotal</Th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr
                      key={`${p.orderId}-${p.productName}-${i}`}
                      className="border-b border-border/60"
                    >
                      <Td>{formatDate(p.date)}</Td>
                      <Td>{p.orderId.slice(0, 8)}</Td>
                      <Td>{p.clientName}</Td>
                      <Td>{p.productName}</Td>
                      <Td>
                        <Situacao realized={p.realized} />
                      </Td>
                      <Td align="center">{p.quantity}</Td>
                      <Td align="right">{formatBRL(p.unitPriceCents * p.quantity)}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/80 bg-muted/20 font-bold">
                    <Td colSpan={5} align="right" className="py-2.5 font-bold text-foreground">
                      Total:
                    </Td>
                    <Td align="center" className="py-2.5 font-bold text-foreground text-xs sm:text-sm">
                      {totalProductsQuantity}
                    </Td>
                    <Td align="right" className="py-2.5 font-bold text-foreground text-xs sm:text-sm">
                      {formatBRL(totalProductsCents)}
                    </Td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {products.length > ROW_LIMIT && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mostrando os {ROW_LIMIT} maiores de {products.length} — igual ao PDF. A planilha do
                Excel traz a lista completa.
              </p>
            )}
          </>
        )}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Canal de origem (App x WhatsApp) não é rastreado separadamente hoje: todo agendamento/pedido
        nasce pelo app, e a confirmação final costuma acontecer pelo WhatsApp — como isso não fica
        registrado por pedido, não incluímos essa quebra pra não sugerir uma precisão que não
        existe.
      </p>
    </div>
  );
}
