/**
 * Drawer / Modal de Bate-papo Interno Offline (Substituição do WhatsApp)
 * Big Dog Pet - Franco da Rocha
 * 
 * Abre a qualquer momento através do botão no cabeçalho ou pelo botão
 * de 1 toque presente em cada vacina, retorno e prontuário médico.
 */

import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  X,
  Volume2,
  Sparkles,
  Paperclip,
  CheckCheck,
  Check,
  Tag,
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
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import {
  useInAppChat,
  type ChatMessage,
  openInAppChat,
  type OpenChatDetail,
} from "@/lib/inAppChat";
import { playChatNotificationSound } from "@/lib/soundAlerts";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

export { openInAppChat, type OpenChatDetail };

export function InAppChatDrawer() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const userRole: "loja" | "tutor" = isAdmin ? "loja" : "tutor";

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [activeContextTag, setActiveContextTag] = useState<string | null>(null);
  const [activePetName, setActivePetName] = useState<string | null>(null);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string>("geral");

  const { messages, unreadCount, hasNewMessage, send, markAsRead } = useInAppChat({
    role: userRole,
    conversationId: activeConversationId,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Escuta evento global disparado pelos botões de 1 toque das linhas do tempo e fichas
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const custom = e as CustomEvent<OpenChatDetail>;
      if (custom.detail) {
        if (custom.detail.contextTag) setActiveContextTag(custom.detail.contextTag);
        if (custom.detail.defaultText) setInputText(custom.detail.defaultText);
        if (custom.detail.petName) setActivePetName(custom.detail.petName);
        if (custom.detail.petId) setActivePetId(custom.detail.petId);
        if (custom.detail.conversationId) setActiveConversationId(custom.detail.conversationId);
      }
      setIsOpen(true);
    };

    window.addEventListener("open_inapp_chat", handleOpenChat);
    return () => window.removeEventListener("open_inapp_chat", handleOpenChat);
  }, []);

  // Ao abrir o chat, rola pro final e marca mensagens como lidas
  useEffect(() => {
    if (isOpen) {
      markAsRead();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [isOpen, messages.length]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    const senderName = isAdmin
      ? "Equipe Big Dog"
      : (typeof user?.user_metadata?.["full_name"] === "string" ? user.user_metadata["full_name"] : "Tutor");
    const senderRole: SenderRole = isAdmin ? "loja" : "tutor";

    send({
      text,
      senderId: user?.id || "anon",
      senderName,
      senderRole,
      contextTag: activeContextTag,
      petName: activePetName,
      petId: activePetId,
    });

    setInputText("");
    // Limpa o contexto pontual após o envio
    setActiveContextTag(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = userRole === "tutor"
    ? [
        "Olá, como está meu pet?",
        "Qual o horário do banho?",
        "Tenho uma dúvida sobre a medicação",
        "Gostaria de reagendar o horário",
      ]
    : [
        "Seu pet está pronto e cheiroso! ✨",
        "Atendimento iniciado no petshop.",
        "Van a caminho para retirada do pet.",
        "Receitado conforme orientação veterinária.",
      ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md bg-background"
      >
        {/* Cabeçalho do Chat */}
        <SheetHeader className="border-b border-border/80 bg-card p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
                {hasNewMessage && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 text-[9px] font-bold text-white items-center justify-center">
                      !
                    </span>
                  </span>
                )}
              </div>
              <div>
                <SheetTitle className="text-sm font-bold flex items-center gap-1.5">
                  Bate-papo Big Dog
                  {hasNewMessage && (
                    <Badge variant="destructive" className="animate-pulse text-[10px] py-0 px-1.5">
                      (Msg Nova)
                    </Badge>
                  )}
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                  Online no App · Sem WhatsApp
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => playChatNotificationSound()}
                title="Testar som de 2 toques do bate-papo"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Contexto Ativo de 1 Toque (Vacina, Retorno, Consulta) */}
          {activeContextTag && (
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

        {/* Lista de Mensagens */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {messages.map((msg) => {
            const isMe =
              (userRole === "tutor" && msg.senderRole === "tutor") ||
              (userRole === "loja" && msg.senderRole !== "tutor");

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
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isMe ? "text-primary-foreground/80" : "text-primary"
                    )}
                  >
                    {msg.senderName}
                  </span>
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
                        (userRole === "tutor" ? msg.readByStore : msg.readByTutor)
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

        {/* Chips de Resposta Rápida */}
        <div className="border-t border-border/60 bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputText(q)}
                className="shrink-0 rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de Entrada de Texto */}
        <div className="border-t border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeContextTag
                  ? `Escreva sua mensagem sobre ${activeContextTag}...`
                  : "Digite sua mensagem..."
              }
              className="h-10 rounded-xl text-xs flex-1"
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
              onClick={handleSend}
              disabled={!inputText.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Bate-papo offline gravado no aparelho · Alerta sonoro de 2 toques ao chegar resposta
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

