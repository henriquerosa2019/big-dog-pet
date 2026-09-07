/**
 * Motor de Bate-papo Interno Offline no App (Substituição do WhatsApp)
 * Big Dog Pet - Franco da Rocha
 * 
 * Permite conversa direta entre Tutor e Loja/Veterinário/Motorista dentro do app.
 * Funciona offline com persistência em localStorage e sincronização entre janelas.
 * Dispara alarme sonoro de 2 toques e badge "(Msg Nova)" ao receber mensagens.
 */

import { useEffect, useState } from "react";
import { playChatNotificationSound } from "./soundAlerts";

export type SenderRole = "tutor" | "loja" | "motorista" | "vet";
export type RecipientRole = "tutor" | "loja";

export interface ChatMessage {
  id: string;
  conversationId: string; // Ex: ID do tutor ou pet
  senderId: string;
  senderName: string;
  senderRole: SenderRole;
  recipientRole: RecipientRole;
  petId?: string | null;
  petName?: string | null;
  contextTag?: string | null; // Ex: "Vacina: V10", "Retorno: Pontos", "Consulta Clínica"
  text: string;
  createdAt: string;
  readByTutor: boolean;
  readByStore: boolean;
}

const STORAGE_KEY = "bigdog_inapp_chat_v2";
const BROADCAST_CHANNEL_NAME = "bigdog_inapp_chat_channel";

// Mensagens padrão iniciais de boas-vindas caso o histórico esteja vazio
const DEFAULT_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-welcome-1",
    conversationId: "geral",
    senderId: "loja-bigdog",
    senderName: "Big Dog Pet",
    senderRole: "loja",
    recipientRole: "tutor",
    text: "Olá! Bem-vindo ao Bate-papo da Big Dog Pet. Envie suas dúvidas sobre banho, vacinas, consultas ou entregas por aqui!",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    readByTutor: true,
    readByStore: true,
  },
];

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (e) {
    console.warn("BroadcastChannel não disponível:", e);
  }
}

/**
 * Carrega todas as mensagens salvas
 */
export function getAllChatMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_MESSAGES));
      return DEFAULT_INITIAL_MESSAGES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_INITIAL_MESSAGES;
  }
}

/**
 * Salva as mensagens no localStorage
 */
function saveAllChatMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error("Erro ao salvar mensagens de chat:", err);
  }
}

/**
 * Envia uma nova mensagem no chat
 */
export function sendChatMessage(params: {
  conversationId?: string;
  senderId: string;
  senderName: string;
  senderRole: SenderRole;
  recipientRole?: RecipientRole;
  petId?: string | null;
  petName?: string | null;
  contextTag?: string | null;
  text: string;
  playSound?: boolean;
}): ChatMessage {
  const currentMessages = getAllChatMessages();
  const recipientRole: RecipientRole =
    params.recipientRole || (params.senderRole === "tutor" ? "loja" : "tutor");

  const newMessage: ChatMessage = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: params.conversationId || "geral",
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: params.senderRole,
    recipientRole,
    petId: params.petId ?? null,
    petName: params.petName ?? null,
    contextTag: params.contextTag ?? null,
    text: params.text.trim(),
    createdAt: new Date().toISOString(),
    readByTutor: params.senderRole === "tutor",
    readByStore: params.senderRole !== "tutor",
  };

  const updated = [...currentMessages, newMessage];
  saveAllChatMessages(updated);

  // Alerta sonoro de 2 toques (requisito: ao chegar msg na loja e no tutor)
  if (params.playSound !== false) {
    playChatNotificationSound();
  }

  // Notifica outras janelas/abas
  try {
    broadcastChannel?.postMessage({ type: "NEW_MESSAGE", message: newMessage });
  } catch {}

  // Dispara evento local
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("bigdog_chat_event", {
        detail: { type: "NEW_MESSAGE", message: newMessage },
      })
    );
  }

  return newMessage;
}

/**
 * Marca mensagens de uma conversa ou papel como lidas
 */
export function markChatAsRead(options: {
  role: "tutor" | "loja";
  conversationId?: string | undefined;
}): void {
  const current = getAllChatMessages();
  let changed = false;

  const updated = current.map((msg) => {
    if (options.conversationId && msg.conversationId !== options.conversationId && msg.conversationId !== "geral") {
      return msg;
    }

    if (options.role === "tutor" && !msg.readByTutor) {
      changed = true;
      return { ...msg, readByTutor: true };
    }
    if (options.role === "loja" && !msg.readByStore) {
      changed = true;
      return { ...msg, readByStore: true };
    }
    return msg;
  });

  if (changed) {
    saveAllChatMessages(updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bigdog_chat_event", { detail: { type: "READ_STATUS_UPDATED" } })
      );
    }
  }
}

/**
 * Conta mensagens não lidas para o papel (tutor ou loja)
 */
export function getUnreadCount(role: "tutor" | "loja", conversationId?: string): number {
  const list = getAllChatMessages();
  return list.filter((m) => {
    if (conversationId && m.conversationId !== conversationId && m.conversationId !== "geral") {
      return false;
    }
    return role === "tutor" ? !m.readByTutor : !m.readByStore;
  }).length;
}

/**
 * Hook React completo para consumir o bate-papo em qualquer tela
 */
export function useInAppChat(options?: {
  role?: "tutor" | "loja";
  conversationId?: string;
}) {
  const currentRole = options?.role || "tutor";
  const [messages, setMessages] = useState<ChatMessage[]>(() => getAllChatMessages());
  const [unreadCount, setUnreadCount] = useState<number>(() =>
    getUnreadCount(currentRole, options?.conversationId)
  );

  const refresh = () => {
    const all = getAllChatMessages();
    setMessages(all);
    setUnreadCount(getUnreadCount(currentRole, options?.conversationId));
  };

  useEffect(() => {
    refresh();

    const handleLocalEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.type === "NEW_MESSAGE") {
        const msg = custom.detail.message as ChatMessage;
        // Se a mensagem for destinada ao papel atual, dispara o som de 2 toques
        if (
          (currentRole === "tutor" && msg.recipientRole === "tutor") ||
          (currentRole === "loja" && msg.recipientRole === "loja")
        ) {
          playChatNotificationSound();
        }
      }
      refresh();
    };

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === "NEW_MESSAGE") {
        const msg = e.data.message as ChatMessage;
        if (
          (currentRole === "tutor" && msg.recipientRole === "tutor") ||
          (currentRole === "loja" && msg.recipientRole === "loja")
        ) {
          playChatNotificationSound();
        }
      }
      refresh();
    };

    window.addEventListener("bigdog_chat_event", handleLocalEvent);
    window.addEventListener("storage", refresh);
    broadcastChannel?.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener("bigdog_chat_event", handleLocalEvent);
      window.removeEventListener("storage", refresh);
      broadcastChannel?.removeEventListener("message", handleBroadcast);
    };
  }, [currentRole, options?.conversationId]);

  const send = (params: {
    text: string;
    senderId: string;
    senderName: string;
    senderRole: SenderRole;
    petId?: string | null;
    petName?: string | null;
    contextTag?: string | null;
    recipientRole?: RecipientRole;
  }) => {
    const msg = sendChatMessage({
      ...params,
      conversationId: options?.conversationId || "geral",
      recipientRole: params.recipientRole || (params.senderRole === "tutor" ? "loja" : "tutor"),
    });
    refresh();
    return msg;
  };

  const markAsRead = () => {
    markChatAsRead({ role: currentRole, conversationId: options?.conversationId });
    refresh();
  };

  return {
    messages: messages.filter((m) => {
      if (!options?.conversationId || options.conversationId === "geral") return true;
      return m.conversationId === options.conversationId || m.conversationId === "geral";
    }),
    unreadCount,
    hasNewMessage: unreadCount > 0,
    send,
    markAsRead,
    refresh,
  };
}
