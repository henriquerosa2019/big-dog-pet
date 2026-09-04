import { formatBRL, formatDate, CLINIC } from "@/lib/format";
import type { ReportData, ReportRange } from "@/lib/reports";

/**
 * Versão em tela do relatório financeiro — mesmo conteúdo e mesma ordem do PDF
 * gerado por `exportReportPDF`, pra loja conferir antes de baixar (ou nem
 * baixar).
 *
 * Responsivo em três faixas: no celular cada linha vira um cartão empilhado
 * (tabela de 7 colunas não cabe em 360px e rolagem lateral é ruim de ler); a
 * partir de `sm` aparecem as tabelas; a partir de `md` o gráfico e o resumo
 * ficam lado a lado, aproveitando a largura de tablet e desktop.
 *
 * As cores das barras são as mesmas do PDF; a paleta foi validada pra contraste
 * e daltonismo, e cada barra também leva o valor escrito, então a leitura nunca
 * depende só da cor.
 */

const BAR_COLORS = {
  servicos: "#4F46E5",
  produtos: "#10A37F",
  transporte: "#D97706",
} as const;

/** Igual ao PDF: as tabelas analíticas mostram os 12 maiores valores. */
const ROW_LIMIT = 12;

function Bars({ data }: { data: ReportData }) {
  const bars = [
    { label: "Serviços", value: data.totals.servicesCents, color: BAR_COLORS.servicos },
    { label: "Produtos", value: data.totals.productsCents, color: BAR_COLORS.produtos },
    { label: "Transporte", value: data.totals.transportCents, color: BAR_COLORS.transporte },
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="flex h-40 items-end gap-3 md:h-48">
      {bars.map((bar) => (
        <div key={bar.label} className="flex h-full flex-1 flex-col justify-end">
          <p className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">
            {formatBRL(bar.value)}
          </p>
          <div
            className="rounded-t-[4px]"
            style={{
              height: `${Math.max(2, (bar.value / max) * 100)}%`,
              backgroundColor: bar.color,
            }}
          />
          <p className="pt-1.5 text-center text-[11px] text-muted-foreground">{bar.label}</p>
        </div>
      ))}
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

function Td({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  return (
    <td
      className={`px-2 py-1.5 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
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
  const services = [...data.services].sort((a, b) => b.priceCents - a.priceCents);
  const products = [...data.products].sort(
    (a, b) => b.unitPriceCents * b.quantity - a.unitPriceCents * a.quantity,
  );
  const topServices = services.slice(0, ROW_LIMIT);
  const topProducts = products.slice(0, ROW_LIMIT);

  const resumo = [
    ["Serviços prestados", data.totals.servicesCents, data.open.servicesCents],
    ["Vendas de produtos", data.totals.productsCents, data.open.productsCents],
    ["Taxas de retirada/entrega", data.totals.transportCents, data.open.transportCents],
  ] as const;

  return (
    <div className="mt-3 rounded-2xl bg-card p-3 shadow-card md:p-5">
      <h3 className="font-display text-base md:text-xl">
        Relatório financeiro — {CLINIC.fullName}
      </h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Período: {range.label}</p>
      <p className="text-[11px] text-muted-foreground">
        Gerado em {generatedAt.toLocaleString("pt-BR")}
      </p>

      <div className="mt-3 gap-5 md:grid md:grid-cols-2 md:items-start">
        <Bars data={data} />

        <div className="mt-4 md:mt-0">
          <SectionTitle>Resumo consolidado</SectionTitle>
          <table className="mt-1.5 w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <Th>Categoria</Th>
                <Th align="right">Realizado</Th>
                <Th align="right">Em aberto</Th>
              </tr>
            </thead>
            <tbody>
              {resumo.map(([label, realizado, aberto]) => (
                <tr key={label} className="border-b border-border/60">
                  <Td>{label}</Td>
                  <Td align="right">{formatBRL(realizado)}</Td>
                  <Td align="right">{formatBRL(aberto)}</Td>
                </tr>
              ))}
              <tr className="border-b border-border/60 font-semibold text-primary">
                <Td>Receita bruta total</Td>
                <Td align="right">{formatBRL(data.totals.grossCents)}</Td>
                <Td align="right">{formatBRL(data.open.grossCents)}</Td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Campanha Niver: {data.campaignNiver.count} de {data.campaignNiver.totalServices}{" "}
            agendamentos ({data.campaignNiver.percent.toFixed(1)}%)
          </p>
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle>Serviços no período</SectionTitle>
        {topServices.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">Nenhum serviço no período.</p>
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
              </table>
            </div>

            {services.length > ROW_LIMIT && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mostrando os {ROW_LIMIT} maiores de {services.length} — igual ao PDF. A planilha do
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
