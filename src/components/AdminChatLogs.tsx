import { useState, useMemo } from "react";
import {
  Search,
  Calendar,
  MessageCircle,
  Clock,
  User,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useChatQueue,
  getChatLogs,
  getMessagesForConversation,
  openInAppChat,
  type ChatConversationSummary,
  type ChatMessage,
  type ChatPeriodFilter,
} from "@/lib/inAppChat";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/format";

export function AdminChatLogs() {
  const { refresh } = useChatQueue();
  const [searchTerm, setSearchTerm] = useState("");
  const [period, setPeriod] = useState<ChatPeriodFilter>("todos");
  const [selectedConv, setSelectedConv] = useState<ChatConversationSummary | null>(null);

  // Conversas filtradas
  const logs = useMemo(() => {
    return getChatLogs({ search: searchTerm, period });
  }, [searchTerm, period]);

  // Mensagens da conversa selecionada para visualização de transcrição
  const transcriptMessages = useMemo(() => {
    if (!selectedConv) return [];
    return getMessagesForConversation(selectedConv.conversationId);
  }, [selectedConv]);

  // Totais para os cards de KPI
  const stats = useMemo(() => {
    const all = getChatLogs({ period: "todos" });
    const abertos = all.filter((c) => c.status === "aberto" || c.unreadCountStore > 0).length;
    const respondidos = all.filter((c) => c.status === "respondido").length;
    const fechados = all.filter((c) => c.status === "fechado").length;
    const totalMsgs = all.reduce((acc, c) => acc + c.messageCount, 0);
    return {
      total: all.length,
      abertos,
      respondidos,
      fechados,
      totalMsgs,
    };
  }, []);

  const handleOpenInLiveChat = (conv: ChatConversationSummary) => {
    openInAppChat({
      conversationId: conv.conversationId,
      tutorName: conv.tutorName,
      petName: conv.petName ?? undefined,
      contextTag: conv.contextTag ?? undefined,
    });
  };

  const handleExportCsv = () => {
    try {
      const headers = ["Data/Hora", "Tutor", "Telefone", "Pet", "Contexto", "Status", "Ultima Mensagem", "Qtd Mensagens"];
      const rows = logs.map((l) => [
        `"${new Date(l.lastMessageAt || Date.now()).toLocaleString("pt-BR")}"`,
        `"${(l.tutorName || "").replace(/"/g, '""')}"`,
        `"${(l.tutorPhone || "").replace(/"/g, '""')}"`,
        `"${(l.petName || "").replace(/"/g, '""')}"`,
        `"${(l.contextTag || "").replace(/"/g, '""')}"`,
        `"${l.status || ""}"`,
        `"${(l.lastMessageText || l.lastMessage?.text || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        l.messageCount || 0,
      ]);

      const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `log_atendimentos_chat_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Relatório de atendimentos exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar CSV:", err);
      toast.error("Não foi possível exportar a planilha no momento.");
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header do Módulo de Logs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Log e Histórico de Atendimentos do Chat
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro de todas as conversas entre clientes/tutores e a loja com filtros por período e tutor.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="h-8 gap-1.5 text-xs rounded-xl font-semibold border-primary/30 text-primary hover:bg-primary/5"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV / Excel
        </Button>
      </div>

      {/* 2. KPIs de Atendimento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl border bg-card p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total de Chamados
          </p>
          <p className="mt-1 text-2xl font-bold font-display text-foreground">
            {stats.total}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {stats.totalMsgs} mensagens registradas
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
            Aguardando Loja
          </p>
          <p className="mt-1 text-2xl font-bold font-display text-amber-950 dark:text-amber-100">
            {stats.abertos}
          </p>
          <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-0.5">
            Precisam de resposta
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
            Respondidos
          </p>
          <p className="mt-1 text-2xl font-bold font-display text-emerald-950 dark:text-emerald-100">
            {stats.respondidos}
          </p>
          <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-0.5">
            Atendimento em dia
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-3 shadow-xs">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Filtrados
          </p>
          <p className="mt-1 text-2xl font-bold font-display text-primary">
            {logs.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Exibidos no filtro atual
          </p>
        </div>
      </div>

      {/* 3. Barra de Filtros: Busca e Período (Hoje, Semana, Mês, Todos) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3.5 rounded-2xl border border-border/80 shadow-xs">
        {/* Campo de Busca por Tutor/Pet */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome do tutor, pet, telefone ou conteúdo da conversa..."
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>

        {/* Filtros Rápidos de Período */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Button
            size="sm"
            variant={period === "hoje" ? "default" : "outline"}
            onClick={() => setPeriod("hoje")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Hoje
          </Button>
          <Button
            size="sm"
            variant={period === "semana" ? "default" : "outline"}
            onClick={() => setPeriod("semana")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Semana (7 dias)
          </Button>
          <Button
            size="sm"
            variant={period === "mes" ? "default" : "outline"}
            onClick={() => setPeriod("mes")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Mês Atual
          </Button>
          <Button
            size="sm"
            variant={period === "todos" ? "default" : "outline"}
            onClick={() => setPeriod("todos")}
            className="h-8 rounded-xl text-xs font-semibold px-3"
          >
            Todos
          </Button>
        </div>
      </div>

      {/* 4. Listagem das Conversas do Log */}
      <div className="space-y-2.5">
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 p-8 text-center text-xs text-muted-foreground">
            Nenhum registro de atendimento encontrado para os filtros selecionados.
          </div>
        ) : (
          logs.map((item) => {
            const isAberto = item.status === "aberto" || item.unreadCountStore > 0;

            return (
              <div
                key={item.conversationId}
                className={cn(
                  "rounded-2xl border p-4 transition-all bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3",
                  isAberto ? "border-amber-500/40 bg-amber-500/[0.02]" : "border-border/80"
                )}
              >
                {/* Informações Principais */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      {item.tutorName}
                    </span>
                    {item.tutorPhone && (
                      <span className="text-xs text-muted-foreground">
                        {item.tutorPhone}
                      </span>
                    )}
                    {item.petName && (
                      <Badge variant="secondary" className="text-[10px] font-semibold py-0.5">
                        🐾 {item.petName}
                      </Badge>
                    )}
                    {item.contextTag && (
                      <Badge variant="outline" className="text-[10px] font-semibold py-0.5 border-primary/30 text-primary">
                        <Tag className="mr-1 h-3 w-3" />
                        {item.contextTag}
                      </Badge>
                    )}
                    {isAberto ? (
                      <Badge className="bg-amber-500 text-amber-950 text-[10px] font-bold">
                        Aguardando Resposta
                      </Badge>
                    ) : item.status === "fechado" ? (
                      <Badge variant="outline" className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/40">
                        🏁 Finalizado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-medium text-emerald-600 border-emerald-500/40">
                        Respondido
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    <strong className="text-foreground/80">Última msg: </strong>
                    {item.lastMessageText || item.lastMessage?.text || "(Mensagem iniciada)"}
                  </p>

                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    Última interação: {formatDateTime(item.lastMessageAt)} · {item.messageCount} mensagens trocadas
                  </p>
                </div>

                {/* Ações de Consulta e Resposta */}
                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedConv(item)}
                    className="h-8 rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver Transcrição
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleOpenInLiveChat(item)}
                    className="h-8 rounded-xl text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Responder no Chat
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Modal de Transcrição Completa da Conversa */}
      <Dialog open={Boolean(selectedConv)} onOpenChange={(open) => !open && setSelectedConv(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border/80 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  Transcrição de Atendimento · {selectedConv?.tutorName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedConv?.petName ? `Pet: ${selectedConv.petName} · ` : ""}
                  {selectedConv?.contextTag ? `Contexto: ${selectedConv.contextTag} · ` : ""}
                  ID: {selectedConv?.conversationId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Histórico das Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {transcriptMessages.map((m) => {
              const isLoja = m.senderRole === "loja";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "p-3 rounded-2xl max-w-[85%] text-xs shadow-xs",
                    isLoja
                      ? "ml-auto bg-primary text-primary-foreground rounded-br-none"
                      : "mr-auto bg-card border border-border text-foreground rounded-bl-none"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-[10px] uppercase">
                      {m.senderName} ({m.senderRole})
                    </span>
                    <span className="text-[10px] opacity-75">
                      {formatDateTime(m.createdAt)}
                    </span>
                  </div>
                  {m.contextTag && (
                    <div className="mb-1 text-[10px] font-semibold opacity-90">
                      🏷️ {m.contextTag}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-border/80 bg-card flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedConv(null)}
              className="h-8 rounded-xl text-xs font-semibold"
            >
              Fechar
            </Button>
            {selectedConv && (
              <Button
                size="sm"
                onClick={() => {
                  handleOpenInLiveChat(selectedConv);
                  setSelectedConv(null);
                }}
                className="h-8 rounded-xl text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Continuar Conversa no Chat
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
