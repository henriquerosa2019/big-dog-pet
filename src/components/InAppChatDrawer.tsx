import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  X,
  Volume2,
  Sparkles,
  CheckCheck,
  Tag,
  ArrowLeft,
  Search,
  User,
  Clock,
  ChevronRight,
  MessageSquare,
  PowerOff,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import {
  useInAppChat,
  useChatQueue,
  type ChatMessage,
  type ChatConversationSummary,
  openInAppChat,
  type OpenChatDetail,
  getOrCreateTutorSessionId,
  getActiveTutorConversationId,
  getMessagesForConversation,
  markConversationAsRead,
  getPetEmoji,
  getAppRole,
  setAppRole,
  type SimulationRole,
  type SenderRole,
  type RecipientRole,
} from "@/lib/inAppChat";
import { supabase } from "@/integrations/supabase/client";
import { playChatNotificationSound } from "@/lib/soundAlerts";
import { cn } from "@/lib/utils";

export { openInAppChat, type OpenChatDetail };

export function InAppChatDrawer() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const [isPreviewClient, setIsPreviewClient] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("bigdog_preview_mode") === "cliente";
  });
  const [activeRole, setActiveRole] = useState<SimulationRole>(() => getAppRole(pathname));

  useEffect(() => {
    const handleRoleUpdate = () => {
      setIsPreviewClient(sessionStorage.getItem("bigdog_preview_mode") === "cliente");
      setActiveRole(getAppRole(pathname));
    };
    window.addEventListener("storage", handleRoleUpdate);
    window.addEventListener("bigdog_preview_change", handleRoleUpdate);
    window.addEventListener("bigdog_role_change", handleRoleUpdate);
    return () => {
      window.removeEventListener("storage", handleRoleUpdate);
      window.removeEventListener("bigdog_preview_change", handleRoleUpdate);
      window.removeEventListener("bigdog_role_change", handleRoleUpdate);
    };
  }, [pathname]);

  useEffect(() => {
    setActiveRole(getAppRole(pathname));
  }, [pathname]);

  const isStore = activeRole === "loja";
  const isDriver = activeRole === "motorista";
  const isTutor = activeRole === "tutor";

  const handleSwitchRole = (newRole: SimulationRole) => {
    setAppRole(newRole);
    setIsOpen(false); // Fecha o drawer para que o usuário veja a perspectiva do destinatário (com o badge vermelho no topo!)

    if (newRole === "tutor") {
      if (pathname.startsWith("/admin") || pathname === "/motorista") {
        navigate({ to: "/", search: { preview: "cliente" } as any });
      }
    } else if (newRole === "loja") {
      if (!pathname.startsWith("/admin")) {
        navigate({ to: "/admin" });
      }
    } else if (newRole === "motorista") {
      if (pathname !== "/motorista") {
        navigate({ to: "/motorista" });
      }
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [activeContextTag, setActiveContextTag] = useState<string | null>(null);
  const [activePetName, setActivePetName] = useState<string | null>(null);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [activePetSpecies, setActivePetSpecies] = useState<string | null>(null);
  const [activeTutorName, setActiveTutorName] = useState<string | null>(null);
  const [activeSenderName, setActiveSenderName] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string>(() =>
    !isStore && !isDriver ? getActiveTutorConversationId(user?.id) : "geral"
  );

  // Se for Loja, começa na Fila de Atendimentos. Se for Tutor ou Motorista em corrida, vai direto na sua conversa.
  const [isViewingQueue, setIsViewingQueue] = useState<boolean>(isStore);
  const [queueSearch, setQueueSearch] = useState("");
  const [queueTab, setQueueTab] = useState<"abertos" | "finalizados">("abertos");

  const {
    conversations,
    openConversations,
    closedConversations,
    unreadConversationsCount,
    totalUnread,
    refresh: refreshQueue,
  } = useChatQueue();

  // Se o contexto atual for Tutor, garante que acesse a conversa com mensagens ou sua sessão e saia da fila
  useEffect(() => {
    if (isTutor) {
      const tutorConvId = getActiveTutorConversationId(user?.id);
      if (!activeConversationId || activeConversationId === "geral") {
        setActiveConversationId(tutorConvId);
      }
      setIsViewingQueue(false);
    }
  }, [isTutor, user?.id]);

  const {
    messages,
    unreadCount,
    hasNewMessage,
    isClosed,
    send,
    closeCurrentConversation,
    markAsRead,
  } = useInAppChat({
    role: isTutor ? "tutor" : "loja",
    conversationId: activeConversationId,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Escuta evento global disparado por botões de 1 toque em qualquer tela
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const custom = e as CustomEvent<OpenChatDetail>;
      if (custom.detail) {
        if (custom.detail.contextTag) setActiveContextTag(custom.detail.contextTag);
        if (custom.detail.defaultText) setInputText(custom.detail.defaultText);
        if (custom.detail.petName) setActivePetName(custom.detail.petName);
        if (custom.detail.petId) setActivePetId(custom.detail.petId);
        if (custom.detail.petSpecies) setActivePetSpecies(custom.detail.petSpecies);
        if (custom.detail.tutorName) setActiveTutorName(custom.detail.tutorName);
        if (custom.detail.senderRole) setRoleOverride(custom.detail.senderRole);
        if (custom.detail.senderName) setActiveSenderName(custom.detail.senderName);

        if (custom.detail.conversationId) {
          setActiveConversationId(custom.detail.conversationId);
          setIsViewingQueue(false); // Entra diretamente na conversa acionada
        } else if (!isStore && !isDriver) {
          const tutorConvId = getActiveTutorConversationId(user?.id);
          setActiveConversationId(tutorConvId);
          setIsViewingQueue(false);
        }
      } else {
        // Se a loja clicou sem especificar tutor, abre a fila; se tutor, vai direto na conversa relevante
        if (isStore) {
          setIsViewingQueue(true);
        } else {
          const tutorConvId = getActiveTutorConversationId(user?.id);
          setActiveConversationId(tutorConvId);
          setIsViewingQueue(false);
        }
      }
      setIsOpen(true);
    };

    window.addEventListener("open_inapp_chat", handleOpenChat);
    return () => window.removeEventListener("open_inapp_chat", handleOpenChat);
  }, [isStore, isDriver, user?.id]);

  // Sincroniza dados da conversa ativa (nome do tutor, pet, tag) a partir do histórico
  useEffect(() => {
    if (!activeConversationId || activeConversationId === "geral") return;
    const convMsgs = getMessagesForConversation(activeConversationId);
    if (convMsgs.length > 0) {
      const last = convMsgs[convMsgs.length - 1];
      if (last.tutorName && (!activeTutorName || activeTutorName === "Tutor")) {
        setActiveTutorName(last.tutorName);
      }
      if (last.petName && !activePetName) {
        setActivePetName(last.petName);
      }
      if (last.petSpecies && !activePetSpecies) {
        setActivePetSpecies(last.petSpecies);
      }
      if (last.contextTag && !activeContextTag) {
        setActiveContextTag(last.contextTag);
      }
    }
  }, [activeConversationId, activeTutorName, activePetName, activePetSpecies, activeContextTag]);

  // Busca espécie do pet no banco de dados se tivermos o petId
  useEffect(() => {
    if (!activePetId) return;
    supabase
      .from("pets")
      .select("species, name")
      .eq("id", activePetId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.species) setActivePetSpecies(data.species);
        if (data?.name && !activePetName) setActivePetName(data.name);
      });
  }, [activePetId, activePetName]);

  // Se o tutor estiver logado e não tiver pet selecionado, busca o primeiro pet cadastrado
  useEffect(() => {
    if (isStore || !user?.id || activePetSpecies) return;
    supabase
      .from("pets")
      .select("name, species")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.species) {
          setActivePetSpecies(data.species);
          if (!activePetName && data.name) setActivePetName(data.name);
        }
      });
  }, [isStore, user?.id, activePetSpecies, activePetName]);

  // Ao abrir uma conversa específica, rola pro final e marca como lida para o papel ativo
  useEffect(() => {
    if (isOpen && !isViewingQueue && activeConversationId) {
      if (isStore) {
        markConversationAsRead(activeConversationId, "loja");
      } else {
        markConversationAsRead(activeConversationId, "tutor");
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [isOpen, isViewingQueue, activeConversationId]);

  // Se uma nova mensagem do destinatário chegar com o chat já aberto, marca como lida e rola pro final
  useEffect(() => {
    if (!isOpen || isViewingQueue || !activeConversationId || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    if (isStore && lastMsg.senderRole === "tutor" && !lastMsg.readByStore) {
      markConversationAsRead(activeConversationId, "loja");
    } else if (isTutor && lastMsg.senderRole !== "tutor" && !lastMsg.readByTutor) {
      markConversationAsRead(activeConversationId, "tutor");
    }

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  }, [messages.length, isOpen, isViewingQueue, isStore, isTutor, activeConversationId]);

  const handleOpenConversationFromQueue = (conv: ChatConversationSummary) => {
    setActiveConversationId(conv.conversationId);
    setActiveTutorName(conv.tutorName);
    setActivePetName(conv.petName ?? null);
    setActivePetId(conv.petId ?? null);
    setActivePetSpecies(conv.petSpecies ?? null);
    setActiveContextTag(conv.contextTag ?? null);
    setIsViewingQueue(false);
    markConversationAsRead(conv.conversationId, "loja");
    refreshQueue();
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    if (isDriver) {
      const senderName = activeSenderName || "João (Motorista Big Dog)";
      const senderRole: SenderRole = "motorista";
      const recipientRole: RecipientRole = "tutor";
      const targetConvId =
        activeConversationId && activeConversationId !== "geral"
          ? activeConversationId
          : user?.id || "geral";

      send({
        text,
        conversationId: targetConvId,
        senderId: user?.id || "motorista",
        senderName,
        senderRole,
        recipientRole,
        tutorName: activeTutorName || "Tutor",
        tutorId: targetConvId !== "geral" ? targetConvId : null,
        contextTag: activeContextTag,
        petName: activePetName,
        petId: activePetId,
        petSpecies: activePetSpecies,
        status: "respondido",
      });
    } else if (isStore) {
      const senderName = "Equipe Big Dog";
      const senderRole: SenderRole = "loja";
      const recipientRole: RecipientRole = "tutor";

      send({
        text,
        conversationId: activeConversationId,
        senderId: user?.id || "loja",
        senderName,
        senderRole,
        recipientRole,
        tutorName: activeTutorName || "Tutor",
        tutorId: activeConversationId !== "geral" ? activeConversationId : null,
        contextTag: activeContextTag,
        petName: activePetName,
        petId: activePetId,
        petSpecies: activePetSpecies,
        status: "respondido",
      });
    } else {
      const tutorName =
        activeTutorName ||
        (typeof user?.user_metadata?.["full_name"] === "string"
          ? user.user_metadata["full_name"]
          : "Henrique (Tutor)");
      const senderRole: SenderRole = "tutor";
      const recipientRole: RecipientRole = "loja";
      const tutorConvId =
        activeConversationId && activeConversationId !== "geral"
          ? activeConversationId
          : user?.id || getOrCreateTutorSessionId();

      send({
        text,
        conversationId: tutorConvId,
        senderId: user?.id || getOrCreateTutorSessionId(),
        senderName: tutorName,
        senderRole,
        recipientRole,
        tutorName,
        tutorId: tutorConvId,
        contextTag: activeContextTag,
        petName: activePetName || "Thor (simulação)",
        petId: activePetId,
        petSpecies: activePetSpecies || "cão",
        status: "aberto",
      });
    }

    setInputText("");
    setActiveContextTag(null);
    refreshQueue();
  };

  const handleConfirmClose = () => {
    // Se o usuário digitou uma resposta antes de finalizar, envia a mensagem primeiro!
    const pendingText = inputText.trim();
    if (pendingText) {
      handleSend();
    }
    const roleForClose: "tutor" | "loja" | "motorista" = isDriver ? "motorista" : isStore ? "loja" : "tutor";
    const actorName = isDriver
      ? (activeSenderName || "Motorista Big Dog")
      : isStore
      ? "Equipe Big Dog"
      : (typeof user?.user_metadata?.["full_name"] === "string" ? user.user_metadata["full_name"] : (activeTutorName || "Tutor"));

    closeCurrentConversation(actorName, roleForClose);
    setConfirmCloseOpen(false);
    refreshQueue();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredQueue = useMemo(() => {
    const list = queueTab === "abertos" ? openConversations : closedConversations;
    if (!queueSearch.trim()) return list;
    const term = queueSearch.toLowerCase();
    return list.filter(
      (c) =>
        c.tutorName.toLowerCase().includes(term) ||
        (c.petName && c.petName.toLowerCase().includes(term)) ||
        (c.contextTag && c.contextTag.toLowerCase().includes(term)) ||
        c.lastMessageText.toLowerCase().includes(term)
    );
  }, [queueTab, openConversations, closedConversations, queueSearch]);

  // Emoji elegante dinâmico (🐱 gato, 🐶 cão ou 🐾 patinhas)
  const petEmoji = useMemo(
    () => getPetEmoji(activePetSpecies, activePetName),
    [activePetSpecies, activePetName]
  );


  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "agora";
      if (diffMins < 60) return `há ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `há ${diffHours}h`;
      return new Date(isoString).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md bg-background"
      >
        {/* Cabeçalho do Chat */}
        <SheetHeader className="border-b border-border/80 bg-card p-3.5 space-y-2">
          {/* Seletor rápido de teste de homologação para admin */}
          {isAdmin && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs mb-1">
              <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                🧪 Simulação Chat:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchRole("tutor")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                    isTutor
                      ? "bg-primary text-white shadow-xs"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  🐾 Tutor
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole("loja")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                    isStore
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  🏬 Loja
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole("motorista")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                    isDriver
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  🚚 Motorista
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {isStore && !isViewingQueue ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-xl"
                  onClick={() => {
                    setIsViewingQueue(true);
                    refreshQueue();
                  }}
                  title="Voltar para a Fila de Atendimentos"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                  {totalUnread > 0 && isStore && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 text-[9px] font-bold text-white items-center justify-center">
                        !
                      </span>
                    </span>
                  )}
                </div>
              )}

              <div className="min-w-0">
                <SheetTitle className="text-sm font-bold flex items-center gap-1.5 truncate">
                  {isDriver ? (
                    <>
                      🚚 Motorista · {activeTutorName || "Tutor"}
                      {activePetName ? ` · 🐾 ${activePetName}` : ""}
                    </>
                  ) : isStore ? (
                    isViewingQueue ? (
                      <>
                        Fila de Atendimento (Loja)
                        {totalUnread > 0 && (
                          <Badge variant="destructive" className="animate-pulse text-[10px] py-0 px-1.5">
                            {totalUnread} pendente(s)
                          </Badge>
                        )}
                      </>
                    ) : (
                      <>
                        💬 {activeTutorName || "Tutor"}
                        {activePetName ? ` · 🐾 ${activePetName}` : ""}
                      </>
                    )
                  ) : (
                    <>
                      Bate-papo Big Dog
                      {hasNewMessage && (
                        <Badge variant="destructive" className="animate-pulse text-[10px] py-0 px-1.5">
                          (Msg Nova)
                        </Badge>
                      )}
                    </>
                  )}
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
                  {isDriver
                    ? "Contato direto de transporte e rota com o tutor"
                    : isStore
                    ? (isViewingQueue ? "Ordens de chegada e chamados de tutores" : "Atendimento individual em tempo real")
                    : "Atendimento direto com a equipe · Sem WhatsApp"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => playChatNotificationSound()}
                title="Testar som de 2 toques do bate-papo"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
              </button>

              {/* Botão Fechar Janela do Chat */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 px-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground gap-1 transition-colors cursor-pointer"
                title="Fechar janela do chat (a conversa continua salva)"
              >
                <X className="h-4 w-4" />
                <span className="text-[11px]">Fechar</span>
              </Button>
            </div>
          </div>

          {/* Contexto Ativo de 1 Toque (Vacina, Retorno, Consulta) */}
          {!isViewingQueue && activeContextTag && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <span className="flex items-center gap-1.5 truncate">
                <Tag className="h-3.5 w-3.5 shrink-0" />
                Sobre: {activeContextTag}
                {activePetName ? ` (${activePetName})` : ""}
              </span>
              <button
                type="button"
                onClick={() => setActiveContextTag(null)}
                className="ml-1 text-primary/70 hover:text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </SheetHeader>

        {/* CORPO DO DRAWER: SE FOR LOJA E ESTIVER NA FILA, RENDERIZA A FILA DE ATENDIMENTOS */}
        {isStore && isViewingQueue ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
            {/* Barra de Busca e Tabs de Tutores na Fila */}
            <div className="p-3 border-b border-border/60 bg-card space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="Buscar tutor, pet ou assunto..."
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>

              {/* Tabs Em Aberto vs Finalizados */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQueueTab("abertos")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    queueTab === "abertos"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>Em Aberto</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 font-bold",
                      unreadConversationsCount > 0 ? "bg-emerald-500/15 text-emerald-600" : ""
                    )}
                  >
                    {openConversations.length}
                  </Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueTab("finalizados")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    queueTab === "finalizados"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>Finalizados</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold">
                    {closedConversations.length}
                  </Badge>
                </button>
              </div>
            </div>

            {/* Lista da Fila de Chamados */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredQueue.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {queueTab === "abertos"
                    ? "Nenhum chamado de tutor em aberto no momento."
                    : "Nenhum atendimento finalizado encontrado."}
                </div>
              ) : (
                filteredQueue.map((conv) => {
                  const isClosed = conv.status === "fechado";
                  const hasUnread = !isClosed && conv.unreadCountStore > 0;
                  const isAberto = !isClosed && conv.status === "aberto";

                  return (
                    <button
                      key={conv.conversationId}
                      type="button"
                      onClick={() => handleOpenConversationFromQueue(conv)}
                      className={cn(
                        "w-full text-left rounded-2xl border p-3 transition-all flex items-start gap-3 relative shadow-xs",
                        isClosed
                          ? "bg-muted/30 border-border/50 opacity-80 hover:opacity-100 hover:bg-card"
                          : hasUnread || isAberto
                          ? "bg-card border-primary/40 hover:border-primary shadow-sm"
                          : "bg-background/80 border-border/70 hover:bg-card"
                      )}
                    >
                      {/* Avatar com inicial do tutor */}
                      <div
                        className={cn(
                          "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold text-sm",
                          isClosed
                            ? "bg-muted text-muted-foreground"
                            : hasUnread || isAberto
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        {conv.tutorName.charAt(0).toUpperCase()}
                        {hasUnread && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                        )}
                      </div>

                      {/* Informações da conversa */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="font-bold text-xs text-foreground truncate">
                            {conv.tutorName}
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        </div>

                        {/* Badges de Pet e Contexto */}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {conv.petName && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                              🐾 {conv.petName}
                            </span>
                          )}
                          {conv.contextTag && (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              <Tag className="h-2.5 w-2.5" />
                              {conv.contextTag}
                            </span>
                          )}
                          {isClosed ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-muted-foreground border-muted-foreground/30">
                              🏁 Finalizado
                            </Badge>
                          ) : hasUnread ? (
                            <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1.5 font-black animate-pulse shadow-xs">
                              {conv.unreadCountStore} nova{conv.unreadCountStore > 1 ? "s" : ""}
                            </Badge>
                          ) : isAberto ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-amber-600 border-amber-500/40">
                              Aguardando Loja
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-muted-foreground border-border">
                              Respondido
                            </Badge>
                          )}
                        </div>

                        {/* Trecho da última mensagem */}
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {conv.lastMessage.senderRole === "loja" && (
                            <span className="font-semibold text-foreground/80">Você: </span>
                          )}
                          {conv.lastMessageText}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground self-center" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* TELA DE CONVERSA ATIVA (TUTOR OU LOJA EM ATENDIMENTO INDIVIDUAL) */
          <>
            {/* Lista de Mensagens */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {messages.map((msg) => {
                const isMe =
                  (isTutor && msg.senderRole === "tutor") ||
                  (isDriver && msg.senderRole === "motorista") ||
                  (isStore && msg.senderRole === "loja") ||
                  (!isTutor && msg.senderRole !== "tutor");

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm transition-all",
                      isMe
                        ? "ml-auto bg-primary text-primary-foreground rounded-br-none"
                        : "mr-auto bg-card border border-border text-card-foreground rounded-bl-none"
                    )}
                  >
                    {/* Nome do Remetente e Tag de Contexto */}
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            isMe ? "text-primary-foreground/90" : "text-primary"
                          )}
                        >
                          {msg.senderName}
                        </span>
                        {msg.senderRole === "motorista" && (
                          <span className={cn(
                            "text-[9px] px-1 py-0.5 rounded font-bold uppercase",
                            isMe ? "bg-black/20 text-white" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          )}>
                            🚚 Motorista
                          </span>
                        )}
                        {msg.senderRole === "loja" && (
                          <span className={cn(
                            "text-[9px] px-1 py-0.5 rounded font-bold uppercase",
                            isMe ? "bg-black/20 text-white" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          )}>
                            🏬 Loja
                          </span>
                        )}
                        {msg.senderRole === "tutor" && (
                          <span className={cn(
                            "text-[9px] px-1 py-0.5 rounded font-bold uppercase",
                            isMe ? "bg-black/20 text-white" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                          )}>
                            🐾 Tutor
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px]",
                          isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {msg.contextTag && (
                      <div
                        className={cn(
                          "mb-1.5 inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          isMe
                            ? "bg-black/20 text-white"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {msg.contextTag}
                        {msg.petName ? ` · ${msg.petName}` : ""}
                      </div>
                    )}

                    {/* Texto da Mensagem */}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    {/* Ícone de Leitura */}
                    <div className="mt-1 flex justify-end">
                      {isMe && (
                        <CheckCheck
                          className={cn(
                            "h-3 w-3",
                            (activeRole === "tutor" ? msg.readByStore : msg.readByTutor)
                              ? "text-sky-300"
                              : "text-primary-foreground/50"
                          )}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Banner de Conversa Finalizada */}
            {isClosed && (
              <div className="mx-3 my-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100 shadow-2xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    <strong>Atendimento finalizado.</strong> Para reabrir o chamado, basta digitar uma nova mensagem.
                  </span>
                </div>
              </div>
            )}

            {/* Barra de Entrada de Texto com Botão Fechar Chat e Botão Finalizar */}
            <div className="border-t border-border bg-card p-3 space-y-2">
              {/* Linha com Status, Botão Fechar Chat e Botão Finalizar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate min-w-0 flex-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="font-medium truncate">
                    {isDriver
                      ? `Motorista atendendo: ${activeTutorName || "Tutor"}${activePetName ? ` (${activePetName} ${petEmoji})` : ""}`
                      : isStore
                      ? `Atendendo: ${activeTutorName || "Tutor"}${activePetName ? ` (${activePetName} ${petEmoji})` : ""}`
                      : `Bate-papo ao vivo com a Big Dog ${petEmoji}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Fechar janela do chat (sem encerrar conversa) */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="h-7 px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-xl shadow-2xs gap-1 transition-colors cursor-pointer"
                    title="Fechar janela do chat (a conversa continua salva)"
                  >
                    <X className="h-3.5 w-3.5" />
                    Fechar Chat
                  </Button>

                  {/* Finalizar Atendimento (disponível para Loja, Tutor e Motorista) */}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmCloseOpen(true)}
                    className="h-7 px-2.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs gap-1.5 transition-transform active:scale-95 cursor-pointer"
                    title="Concluir e finalizar atendimento"
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                    Finalizar
                  </Button>
                </div>
              </div>

              {/* Campo de Texto e Botão de Envio */}
              <div className="flex items-center gap-2">
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isDriver
                      ? `Enviar mensagem ao tutor ${activeTutorName || ""}...`
                      : isStore
                      ? `Responder para ${activeTutorName || "o tutor"}...`
                      : activeContextTag
                        ? `Escreva sua mensagem sobre ${activeContextTag}...`
                        : `Digite sua mensagem ${petEmoji}...`
                  }
                  className="h-10 rounded-xl text-xs flex-1"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-xl shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                Bate-papo gravado · Troca de mensagens em tempo real
              </p>
            </div>
          </>
        )}
      </SheetContent>

      {/* Diálogo de Confirmação para Finalizar Atendimento (Loja, Tutor e Motorista) */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold">
              <PowerOff className="h-5 w-5" />
              Finalizar Atendimento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {inputText.trim()
                ? `Você digitou uma mensagem. Ao confirmar, ela será enviada primeiro ao ${isTutor ? "atendimento da Big Dog" : (activeTutorName || "tutor")} e, em seguida, o atendimento será finalizado.`
                : isStore
                ? `Tem certeza que deseja encerrar o atendimento com ${activeTutorName || "o tutor"}? O chamado será arquivado na aba de finalizados. Para apenas fechar esta janela mantendo a conversa aberta, use o botão "Fechar Chat".`
                : isDriver
                ? `Deseja encerrar o contato com ${activeTutorName || "o tutor"}? Para apenas fechar esta janela mantendo a conversa aberta, use o botão "Fechar Chat".`
                : "Deseja encerrar o atendimento? A conversa continuará gravada no seu histórico. Para apenas fechar esta janela mantendo a conversa aberta, use o botão 'Fechar Chat'."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl text-xs font-semibold">
              Continuar Conversando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold"
            >
              Sim, Finalizar Atendimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

