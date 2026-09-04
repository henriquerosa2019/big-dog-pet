import { startOfDay, startOfMonth, startOfWeek } from "date-fns";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CLINIC, formatBRL, formatDate } from "./format";
import {
  hasTransportFee,
  isServiceExecuted,
  logisticsTypeLabels,
  type LogisticsType,
} from "./transport";

export type ReportPeriod = "hoje" | "semana" | "mes" | "personalizado";

export type ReportRange = {
  start: Date;
  end: Date;
  label: string;
  /** Usado só pro nome do arquivo (yyyy-mm-dd_yyyy-mm-dd). */
  fileSuffix: string;
};

function toFileDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve o período escolhido em datas concretas. "Semana" é a semana
 * corrente (segunda a hoje), igual ao resto do Dashboard admin
 * (startOfWeek(now, {weekStartsOn:1})), pra não ter dois conceitos
 * diferentes de "semana" no mesmo painel.
 */
export function resolveReportRange(
  period: ReportPeriod,
  fromISO: string,
  toISO: string,
): ReportRange {
  const now = new Date();
  const endOfNow = now;
  const dayStart = startOfDay(now);

  if (period === "hoje") {
    return {
      start: dayStart,
      end: endOfNow,
      label: `Hoje (${formatDate(dayStart)})`,
      fileSuffix: toFileDate(dayStart),
    };
  }
  if (period === "semana") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    return {
      start,
      end: endOfNow,
      label: `Semana atual (${formatDate(start)} a ${formatDate(endOfNow)})`,
      fileSuffix: `${toFileDate(start)}_${toFileDate(endOfNow)}`,
    };
  }
  if (period === "mes") {
    const start = startOfMonth(now);
    return {
      start,
      end: endOfNow,
      label: `Mês atual (${formatDate(start)} a ${formatDate(endOfNow)})`,
      fileSuffix: `${toFileDate(start)}_${toFileDate(endOfNow)}`,
    };
  }
  // personalizado
  const start = fromISO ? new Date(`${fromISO}T00:00:00`) : dayStart;
  const end = toISO ? new Date(`${toISO}T23:59:59`) : endOfNow;
  return {
    start,
    end,
    label: `${formatDate(start)} a ${formatDate(end)}`,
    fileSuffix: `${toFileDate(start)}_${toFileDate(end)}`,
  };
}

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  status: string;
  ops_status: string | null;
  origin: string | null;
  user_id: string;
  service_price_cents: number | null;
  transport_price_cents: number | null;
  logistics_type: string | null;
  services: { name: string } | null;
  pets: { name: string } | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  customer_name: string | null;
  order_items: { product_name: string; quantity: number; unit_price_cents: number }[] | null;
};

export type ReportData = {
  services: {
    id: string;
    date: string;
    clientName: string;
    petName: string;
    serviceName: string;
    status: string;
    isCampaignNiver: boolean;
    priceCents: number;
    /** Servico ja executado (receita realizada) x apenas agendado (em aberto). */
    realized: boolean;
  }[];
  products: {
    orderId: string;
    date: string;
    clientName: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    /** Pedido ja entregue (receita realizada) x ainda em aberto. */
    realized: boolean;
  }[];
  transport: {
    id: string;
    date: string;
    clientName: string;
    modalityLabel: string;
    feeCents: number;
    realized: boolean;
  }[];
  /** Somas de receita REALIZADA (servico executado / pedido entregue). */
  totals: {
    servicesCents: number;
    productsCents: number;
    transportCents: number;
    grossCents: number;
  };
  /** Somas do que esta agendado/nao entregue - ainda nao virou receita. */
  open: {
    servicesCents: number;
    productsCents: number;
    transportCents: number;
    grossCents: number;
  };
  campaignNiver: { count: number; totalServices: number; percent: number };
};

/**
 * Agrega agendamentos + pedidos já filtrados pelo período em linhas
 * analíticas por categoria (Serviços/Produtos/Transporte) + resumo
 * consolidado. Cancelados são excluídos de tudo — não representam receita
 * real. `clientNameById` é o mesmo mapa de tutores (profileById) já
 * carregado no Dashboard, evitando uma query nova só pra nome.
 */
export function buildReportData(
  appointments: AppointmentRow[],
  orders: OrderRow[],
  clientNameById: Map<string, string | null>,
): ReportData {
  const services: ReportData["services"] = [];
  const transport: ReportData["transport"] = [];
  let servicesCents = 0;
  let transportCents = 0;
  let openServicesCents = 0;
  let openTransportCents = 0;
  let campaignCount = 0;
  let totalConsideredServices = 0;

  for (const a of appointments) {
    if (a.status === "cancelado") continue;
    totalConsideredServices += 1;
    const clientName = clientNameById.get(a.user_id) ?? "Cliente";
    const isCampaign = a.origin === "campanha_niver";
    if (isCampaign) campaignCount += 1;
    const priceCents = a.service_price_cents ?? 0;
    const realized = isServiceExecuted(a);
    services.push({
      id: a.id,
      date: a.scheduled_at,
      clientName: clientName ?? "Cliente",
      petName: a.pets?.name ?? "",
      serviceName: a.services?.name ?? "Serviço",
      status: a.status,
      isCampaignNiver: isCampaign,
      priceCents,
      realized,
    });
    if (realized) servicesCents += priceCents;
    else openServicesCents += priceCents;

    const feeCents = a.transport_price_cents ?? 0;
    if (feeCents > 0 && hasTransportFee(a.logistics_type)) {
      transport.push({
        id: a.id,
        date: a.scheduled_at,
        clientName: clientName ?? "Cliente",
        modalityLabel:
          logisticsTypeLabels[a.logistics_type as LogisticsType] ?? a.logistics_type!,
        feeCents,
        realized,
      });
      if (realized) transportCents += feeCents;
      else openTransportCents += feeCents;
    }
  }

  const products: ReportData["products"] = [];
  let productsCents = 0;
  let openProductsCents = 0;
  for (const o of orders) {
    if (o.status === "cancelado") continue;
    const clientName = o.customer_name ?? "Cliente";
    const realized = o.status === "entregue";
    for (const item of o.order_items ?? []) {
      products.push({
        orderId: o.id,
        date: o.created_at,
        clientName,
        productName: item.product_name,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
        realized,
      });
      const lineCents = item.unit_price_cents * item.quantity;
      if (realized) productsCents += lineCents;
      else openProductsCents += lineCents;
    }
  }

  const grossCents = servicesCents + productsCents + transportCents;
  const openGrossCents = openServicesCents + openProductsCents + openTransportCents;

  return {
    services,
    products,
    transport,
    totals: { servicesCents, productsCents, transportCents, grossCents },
    open: {
      servicesCents: openServicesCents,
      productsCents: openProductsCents,
      transportCents: openTransportCents,
      grossCents: openGrossCents,
    },
    campaignNiver: {
      count: campaignCount,
      totalServices: totalConsideredServices,
      percent: totalConsideredServices > 0 ? (campaignCount / totalConsideredServices) * 100 : 0,
    },
  };
}

const CHANNEL_NOTE =
  'Canal de origem (App x WhatsApp) não é rastreado separadamente hoje: todo agendamento/pedido nasce pelo app, e a confirmação final costuma acontecer pelo WhatsApp — como isso não fica registrado por pedido, não incluímos essa quebra pra não sugerir uma precisão que não existe.';

export function exportReportXLSX(data: ReportData, range: ReportRange): void {
  const wb = XLSX.utils.book_new();

  const resumoRows: (string | number)[][] = [
    [`Relatório financeiro — ${CLINIC.fullName}`],
    ["Período", range.label],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
    ["Categoria", "Realizado (R$)", "Em aberto (R$)"],
    ["Serviços prestados", data.totals.servicesCents / 100, data.open.servicesCents / 100],
    ["Vendas de produtos", data.totals.productsCents / 100, data.open.productsCents / 100],
    [
      "Taxas de retirada/entrega",
      data.totals.transportCents / 100,
      data.open.transportCents / 100,
    ],
    ["Receita bruta total", data.totals.grossCents / 100, data.open.grossCents / 100],
    [],
    [
      "Critério",
      "Realizado = serviço concluído (ou transporte já além do atendimento) e pedido entregue. Em aberto = agendado/não entregue, ainda não é receita.",
    ],
    [],
    [
      "Uso da Campanha Niver",
      `${data.campaignNiver.count} de ${data.campaignNiver.totalServices} agendamentos (${data.campaignNiver.percent.toFixed(1)}%)`,
    ],
    [],
    ["Observação", CHANNEL_NOTE],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), "Resumo");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.services.map((s) => ({
        Data: formatDate(s.date),
        Cliente: s.clientName,
        Pet: s.petName,
        Serviço: s.serviceName,
        Status: s.status,
        Situação: s.realized ? "Realizado" : "Em aberto",
        "Campanha Niver": s.isCampaignNiver ? "Sim" : "Não",
        "Valor (R$)": s.priceCents / 100,
      })),
    ),
    "Serviços",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.products.map((p) => ({
        Data: formatDate(p.date),
        Pedido: p.orderId.slice(0, 8),
        Cliente: p.clientName,
        Produto: p.productName,
        Situação: p.realized ? "Realizado" : "Em aberto",
        Quantidade: p.quantity,
        "Valor unitário (R$)": p.unitPriceCents / 100,
        "Subtotal (R$)": (p.unitPriceCents * p.quantity) / 100,
      })),
    ),
    "Produtos",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      data.transport.map((t) => ({
        Data: formatDate(t.date),
        Cliente: t.clientName,
        Modalidade: t.modalityLabel,
        Situação: t.realized ? "Realizado" : "Em aberto",
        "Taxa (R$)": t.feeCents / 100,
      })),
    ),
    "Transporte",
  );

  XLSX.writeFile(wb, `relatorio-financeiro-${range.fileSuffix}.xlsx`);
}

/** Barra horizontal simples desenhada com formas vetoriais do próprio
 * jsPDF — evita depender de rasterizar um gráfico de outra lib (Recharts é
 * SVG e exigiria canvas/html2canvas só pra isso), então o PDF fica
 * autocontido e sem risco de imagem cortada/borrada. */
function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  bars: { label: string; valueCents: number; color: [number, number, number] }[],
) {
  const max = Math.max(1, ...bars.map((b) => b.valueCents));
  const gap = 8;
  const barWidth = (width - gap * (bars.length - 1)) / bars.length;
  bars.forEach((bar, i) => {
    const barHeight = Math.max(1, (bar.valueCents / max) * height);
    const bx = x + i * (barWidth + gap);
    const by = y + (height - barHeight);
    doc.setFillColor(...bar.color);
    doc.rect(bx, by, barWidth, barHeight, "F");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(formatBRL(bar.valueCents), bx + barWidth / 2, by - 2, { align: "center" });
    doc.text(bar.label, bx + barWidth / 2, y + height + 5, { align: "center" });
  });
}

export function exportReportPDF(data: ReportData, range: ReportRange): void {
  const doc = new jsPDF();
  const marginX = 14;
  let cursorY = 18;

  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(`Relatório financeiro — ${CLINIC.fullName}`, marginX, cursorY);
  cursorY += 7;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Período: ${range.label}`, marginX, cursorY);
  cursorY += 5;
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, marginX, cursorY);
  cursorY += 12;

  drawBarChart(doc, marginX, cursorY, 180, 45, [
    { label: "Serviços", valueCents: data.totals.servicesCents, color: [79, 70, 229] },
    { label: "Produtos", valueCents: data.totals.productsCents, color: [16, 163, 127] },
    { label: "Transporte", valueCents: data.totals.transportCents, color: [217, 119, 6] },
  ]);
  cursorY += 45 + 14;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [["Resumo consolidado", "Realizado", "Em aberto"]],
    body: [
      [
        "Serviços prestados",
        formatBRL(data.totals.servicesCents),
        formatBRL(data.open.servicesCents),
      ],
      [
        "Vendas de produtos",
        formatBRL(data.totals.productsCents),
        formatBRL(data.open.productsCents),
      ],
      [
        "Taxas de retirada/entrega",
        formatBRL(data.totals.transportCents),
        formatBRL(data.open.transportCents),
      ],
      ["Receita bruta total", formatBRL(data.totals.grossCents), formatBRL(data.open.grossCents)],
      [
        "Uso da Campanha Niver",
        `${data.campaignNiver.count} de ${data.campaignNiver.totalServices} agendamentos (${data.campaignNiver.percent.toFixed(1)}%)`,
        "",
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  });

  // @ts-expect-error jspdf-autotable anexa lastAutoTable ao doc em runtime
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 10;

  const topServices = [...data.services].sort((a, b) => b.priceCents - a.priceCents).slice(0, 12);
  if (topServices.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Serviços no período", marginX, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      margin: { left: marginX, right: marginX },
      head: [["Data", "Cliente", "Pet", "Serviço", "Situação", "Niver", "Valor"]],
      body: topServices.map((s) => [
        formatDate(s.date),
        s.clientName,
        s.petName,
        s.serviceName,
        s.realized ? "Realizado" : "Em aberto",
        s.isCampaignNiver ? "Sim" : "-",
        formatBRL(s.priceCents),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    // @ts-expect-error idem
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 10;
  }

  const topProducts = [...data.products]
    .sort((a, b) => b.unitPriceCents * b.quantity - a.unitPriceCents * a.quantity)
    .slice(0, 12);
  if (topProducts.length > 0) {
    if (cursorY > 250) {
      doc.addPage();
      cursorY = 18;
    }
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Produtos vendidos no período", marginX, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      margin: { left: marginX, right: marginX },
      head: [["Data", "Pedido", "Cliente", "Produto", "Situação", "Qtd", "Subtotal"]],
      body: topProducts.map((p) => [
        formatDate(p.date),
        p.orderId.slice(0, 8),
        p.clientName,
        p.productName,
        p.realized ? "Realizado" : "Em aberto",
        String(p.quantity),
        formatBRL(p.unitPriceCents * p.quantity),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 163, 127] },
    });
    // @ts-expect-error idem
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 10;
  }

  if (cursorY > 260) {
    doc.addPage();
    cursorY = 18;
  }
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(doc.splitTextToSize(CHANNEL_NOTE, 180), marginX, cursorY);

  doc.save(`relatorio-financeiro-${range.fileSuffix}.pdf`);
}
