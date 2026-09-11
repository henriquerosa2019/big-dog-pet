import { useState, useMemo } from "react";
import {
  ShoppingBag,
  Package,
  Search,
  MessageCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { openInAppChat } from "@/components/InAppChatDrawer";
import {
  formatBRL,
  formatDateTime,
  digitsOnly,
  orderStatusTone,
  statusToneClass,
  isOrderInService,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export interface OrderItem {
  product_name: string;
  quantity: number;
}

export interface AdminOrderRecord {
  id: string;
  user_id?: string | null;
  total_cents: number;
  status: string;
  created_at: string;
  customer_name?: string | null;
  phone?: string | null;
  order_items: OrderItem[];
}

export interface AdminOrdersManagerProps {
  orders: AdminOrderRecord[];
  getClientAbcInfo: (userId?: string | null, phone?: string | null) => {
    abcClass: "A" | "B" | "C";
    ltvCents: number;
    suggestion: {
      badgeClass: string;
      badgeLabel: string;
      tip: string;
    };
  } | null;
  onUpdateOrderStatus: (id: string, status: string) => void;
  isUpdatingStatus?: boolean;
  criticalStockCount?: number;
  onNavigateToProducts?: () => void;
}

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; tone: "pending" | "success" | "danger" | "neutral"; icon: typeof Package }
> = {
  novo: { label: "Novo Pedido", tone: "pending", icon: Clock },
  em_preparo: { label: "Em Preparo", tone: "success", icon: Package },
  entregue: { label: "Entregue", tone: "neutral", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", tone: "danger", icon: RotateCcw },
};

export function AdminOrdersManager({
  orders,
  getClientAbcInfo,
  onUpdateOrderStatus,
  isUpdatingStatus,
  criticalStockCount = 0,
  onNavigateToProducts,
}: AdminOrdersManagerProps) {
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Métricas rápidas
  const metrics = useMemo(() => {
    const list = orders ?? [];
    const pending = list.filter((o) => o.status === "novo" || o.status === "em_preparo").length;
    const delivered = list.filter((o) => o.status === "entregue").length;
    const cancelled = list.filter((o) => o.status === "cancelado").length;
    const totalRevenue = list
      .filter((o) => o.status !== "cancelado")
      .reduce((sum, o) => sum + (o.total_cents || 0), 0);

    const todayStr = new Date().toDateString();
    const todayOrders = list.filter(
      (o) => new Date(o.created_at).toDateString() === todayStr
    ).length;

    return {
      total: list.length,
      pending,
      delivered,
      cancelled,
      totalRevenue,
      todayOrders,
    };
  }, [orders]);

  // Lista filtrada e ordenada (em preparo / novos primeiro, depois mais recentes)
  const filteredOrders = useMemo(() => {
    let list = [...(orders ?? [])];

    // Ordenação: em atendimento/preparo primeiro, depois data decrescente
    list.sort((a, b) => {
      const aInService = isOrderInService(a) ? 1 : 0;
      const bInService = isOrderInService(b) ? 1 : 0;
      if (bInService !== aInService) return bInService - aInService;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Filtro por status
    if (statusFilter === "pendentes") {
      list = list.filter((o) => o.status === "novo" || o.status === "em_preparo");
    } else if (statusFilter !== "todos") {
      list = list.filter((o) => o.status === statusFilter);
    }

    // Filtro por busca de texto
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((order) => {
        const name = (order.customer_name ?? "").toLowerCase();
        const phone = (order.phone ?? "").toLowerCase();
        const id = order.id.toLowerCase();
        const items = order.order_items
          .map((i) => i.product_name.toLowerCase())
          .join(" ");
        return (
          name.includes(term) ||
          phone.includes(term) ||
          id.includes(term) ||
          items.includes(term)
        );
      });
    }

    return list;
  }, [orders, statusFilter, searchTerm]);

  return (
    <div id="pedidos-loja-topo" className="space-y-4">
      {/* 1. Header do Módulo de Pedidos */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground font-display flex items-center gap-2">
              Pedidos na Loja (Produtos)
              {metrics.pending > 0 && (
                <Badge className="bg-blue-600 text-white font-extrabold text-[11px] px-2 py-0.5 animate-pulse">
                  {metrics.pending} em preparo
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Separação, embalagem e entrega de produtos para clientes e tutores
            </p>
          </div>
        </div>

        {criticalStockCount > 0 && onNavigateToProducts && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToProducts}
            className="text-xs font-semibold border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5 self-start sm:self-auto"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>{criticalStockCount} item(ns) em estoque baixo</span>
          </Button>
        )}
      </div>

      {/* 2. Mini Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-card border rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Pedidos</span>
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-foreground">{metrics.total}</span>
            {metrics.todayOrders > 0 && (
              <span className="text-[11px] text-blue-600 font-bold">
                +{metrics.todayOrders} hoje
              </span>
            )}
          </div>
        </div>

        <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 text-xs font-medium">
            <span>Abertos / Em Preparo</span>
            <Clock className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-blue-950 dark:text-blue-100">
              {metrics.pending}
            </span>
            {metrics.pending > 0 && (
              <span className="inline-flex items-center text-[10px] bg-blue-600 text-white font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                Urgente
              </span>
            )}
          </div>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-medium">
            <span>Entregues</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-1">
            <span className="text-xl font-black text-emerald-950 dark:text-emerald-100">
              {metrics.delivered}
            </span>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Faturamento Loja</span>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-foreground">
              {formatBRL(metrics.totalRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, telefone, produto ou ID..."
            className="pl-9 h-10 rounded-xl bg-card border-border/80 text-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          <Button
            size="sm"
            variant={statusFilter === "todos" ? "default" : "outline"}
            onClick={() => setStatusFilter("todos")}
            className="rounded-xl text-xs h-9 px-3 shrink-0 font-semibold"
          >
            Todos ({metrics.total})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "pendentes" ? "default" : "outline"}
            onClick={() => setStatusFilter("pendentes")}
            className={cn(
              "rounded-xl text-xs h-9 px-3 shrink-0 font-semibold gap-1.5",
              statusFilter === "pendentes"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : metrics.pending > 0
                ? "border-blue-400 text-blue-700 dark:text-blue-300"
                : ""
            )}
          >
            Em Preparo / Novos
            {metrics.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px] font-black">
                {metrics.pending}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "entregue" ? "default" : "outline"}
            onClick={() => setStatusFilter("entregue")}
            className="rounded-xl text-xs h-9 px-3 shrink-0 font-semibold"
          >
            Entregues ({metrics.delivered})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "cancelado" ? "default" : "outline"}
            onClick={() => setStatusFilter("cancelado")}
            className="rounded-xl text-xs h-9 px-3 shrink-0 font-semibold"
          >
            Cancelados ({metrics.cancelled})
          </Button>
        </div>
      </div>

      {/* 4. Listagem de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border/80 bg-card/60 p-8 text-center space-y-2">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">
            {searchTerm || statusFilter !== "todos"
              ? "Nenhum pedido encontrado para o filtro selecionado"
              : "Nenhum pedido de produtos cadastrado"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchTerm || statusFilter !== "todos"
              ? "Tente alterar os termos de busca ou mudar a aba de status acima."
              : "Assim que clientes realizarem pedidos na loja de produtos, eles aparecerão aqui ordenados por prioridade de atendimento."}
          </p>
          {(searchTerm || statusFilter !== "todos") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("todos");
              }}
              className="mt-2 text-xs rounded-xl"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const clientInfo = getClientAbcInfo(order.user_id, order.phone);
            const inService = isOrderInService(order);
            const cleanPhone = order.phone ? digitsOnly(order.phone) : "";

            return (
              <div
                key={order.id}
                className={cn(
                  "rounded-2xl p-3.5 sm:p-4 transition-all shadow-card border",
                  inService
                    ? "border-2 border-blue-500/80 bg-blue-50/40 dark:border-blue-500/60 dark:bg-blue-950/20 ring-1 ring-blue-400/40 shadow-md"
                    : clientInfo?.abcClass === "A"
                    ? "border-emerald-500/60 bg-card"
                    : clientInfo?.abcClass === "B"
                    ? "border-blue-500/40 bg-card"
                    : "border-border/80 bg-card hover:border-border"
                )}
              >
                {/* Banner de Prioridade no Topo da Fila */}
                {inService && (
                  <div className="mb-3 flex items-center justify-between gap-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                      </span>
                      {order.status === "novo" ? "Novo Pedido Aguardando Separação" : "Em Preparo / Atendimento"}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      Início da fila
                    </span>
                  </div>
                )}

                {/* Topo do Card: Cliente, Data e Preço */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                      #{order.id.slice(0, 8)}
                    </span>
                    <h4 className="font-bold text-sm sm:text-base text-foreground">
                      {order.customer_name || "Cliente"}
                    </h4>
                    {clientInfo && (
                      <Badge className={cn("text-[10px] font-bold px-1.5 py-0.2", clientInfo.suggestion.badgeClass)}>
                        {clientInfo.suggestion.badgeLabel}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-base sm:text-lg font-black text-primary font-display">
                      {formatBRL(order.total_cents)}
                    </span>
                  </div>
                </div>

                {/* Subinfo: Data, Telefone e Ações de Contato */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDateTime(order.created_at)}</span>
                  {order.phone && (
                    <>
                      <span>·</span>
                      <span className="font-medium">{order.phone}</span>
                    </>
                  )}
                  {clientInfo && clientInfo.ltvCents > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        LTV: {formatBRL(clientInfo.ltvCents)}
                      </span>
                    </>
                  )}
                </div>

                {/* Itens do Pedido */}
                <div className="mt-3 rounded-xl bg-muted/40 p-2.5 border border-border/50 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Produtos ({order.order_items.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.order_items.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-xs font-medium text-foreground border border-border/60 shadow-2xs"
                      >
                        <span className="font-bold text-primary">{item.quantity}x</span>
                        <span className="truncate max-w-[200px]">{item.product_name}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dicas de Ação de Fidelidade */}
                {clientInfo?.abcClass === "A" && (
                  <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-emerald-900 dark:text-emerald-200">
                      🎁 <strong>Ação VIP Loja:</strong> Cliente VIP comprando produtos! Enviar amostra/petisco cortesia e bilhete carinhoso na sacola.
                    </span>
                  </div>
                )}
                {clientInfo?.abcClass === "B" && (
                  <div className="mt-2 rounded-xl bg-blue-500/10 border border-blue-500/30 p-2 text-xs flex items-center justify-between gap-2">
                    <span className="text-blue-900 dark:text-blue-200">
                      📈 <strong>Ação Regular Loja:</strong> Enviar cupom promocional para o próximo banho/tosa junto com os produtos.
                    </span>
                  </div>
                )}

                {/* Rodapé: Contato Rápido e Seleção de Status */}
                <div className="mt-3 pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  {/* Botão de Contato */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openInAppChat({
                          conversationId: order.user_id,
                          tutorId: order.user_id,
                          tutorName: order.customer_name || "Cliente",
                          tutorPhone: order.phone || undefined,
                          contextTag: `Pedido Loja #${order.id.slice(0, 8)}`,
                          defaultText: `Olá, ${order.customer_name || "cliente"}! Referente ao seu pedido #${order.id.slice(0, 8)} na Big Dog Pet:`,
                        })
                      }
                      className="h-8 px-2.5 text-xs font-semibold rounded-lg hover:bg-card text-primary border-primary/30"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" />
                      Chat
                    </Button>
                  </div>

                  {/* Botões de Status do Pedido */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1 hidden sm:inline">
                      Status:
                    </span>
                    {(["novo", "em_preparo", "entregue", "cancelado"] as const).map((status) => {
                      const isActive = order.status === status;
                      const cfg = ORDER_STATUS_CONFIG[status];
                      return (
                        <button
                          key={status}
                          disabled={isUpdatingStatus}
                          onClick={() => onUpdateOrderStatus(order.id, status)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                            isActive
                              ? cn(
                                  "bg-primary text-primary-foreground shadow-xs font-bold",
                                  statusToneClass(orderStatusTone(status))
                                )
                              : "bg-secondary/70 text-secondary-foreground hover:bg-secondary"
                          )}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
