/**
 * Motor de Bate-papo Interno Offline no App (Substituição do WhatsApp)
 * Big Dog Pet - Franco da Rocha
 * 
 * Permite conversa direta entre Tutor e Loja/Veterinário/Motorista dentro do app.
 * Funciona offline com persistência em localStorage e sincronização entre janelas.
 * Dispara alarme sonoro de 2 toques e badge "(Msg Nova)" ao receber mensagens.
 */

import { useState, useEffect } from "react";
import { playChatNotificationSound } from "./soundAlerts";
import { supabase } from "@/integrations/supabase/client";

export type SenderRole = "tutor" | "loja" | "motorista" | "vet";
export type RecipientRole = "tutor" | "loja";
export type ChatMessageStatus = "aberto" | "respondido" | "fechado";
export type ChatPeriodFilter = "hoje" | "semana" | "mes" | "todos";

export interface ChatMessage {
  id: string;
  conversationId: string; // ID do tutor ou pet
  senderId: string;
  senderName: string;
  senderRole: SenderRole;
  recipientRole: RecipientRole;
  tutorId?: string | null;
  tutorName?: string | null;
  tutorPhone?: string | null;
  petId?: string | null;
  petName?: string | null;
  contextTag?: string | null; // Ex: "Vacina: V10", "Retorno: Pontos", "Consulta Clínica"
  text: string;
  createdAt: string;
  readByTutor: boolean;
  readByStore: boolean;
  status?: ChatMessageStatus;
}

export interface OpenChatDetail {
  contextTag?: string | undefined;
  defaultText?: string | undefined;
  petId?: string | undefined;
  petName?: string | undefined;
  conversationId?: string | undefined;
  tutorId?: string | undefined;
  tutorName?: string | undefined;
  tutorPhone?: string | undefined;
}

export interface ChatConversationSummary {
  conversationId: string;
  tutorId: string;
  tutorName: string;
  tutorPhone?: string | null;
  petId?: string | null;
  petName?: string | null;
  contextTag?: string | null;
  lastMessage: ChatMessage;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCountStore: number;
  unreadCountTutor: number;
  status: ChatMessageStatus;
  messageCount: number;
}

/**
 * Dispara evento global no navegador para abrir o modal de chat interno em qualquer lugar do app
 */
export function openInAppChat(detail?: OpenChatDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("open_inapp_chat", { detail }));
}

const STORAGE_KEY = "bigdog_inapp_chat_v3";
const BROADCAST_CHANNEL_NAME = "bigdog_inapp_chat_channel";

// Mensagens padrão iniciais demonstrativas
const DEFAULT_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-init-1",
    conversationId: "tutor-maria-silva",
    senderId: "tutor-maria",
    senderName: "Maria Silva",
    senderRole: "tutor",
    recipientRole: "loja",
    tutorId: "tutor-maria",
    tutorName: "Maria Silva",
    tutorPhone: "(11) 99876-5432",
    petName: "Thor",
    contextTag: "Vacina V10",
    text: "Olá! Gostaria de confirmar se posso levar o Thor amanhã às 14h para o reforço da V10.",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // há 18 min
    readByTutor: true,
    readByStore: false,
    status: "aberto",
  },
  {
    id: "msg-init-2",
    conversationId: "tutor-carlos-souza",
    senderId: "tutor-carlos",
    senderName: "Carlos Souza",
    senderRole: "tutor",
    recipientRole: "loja",
    tutorId: "tutor-carlos",
    tutorName: "Carlos Souza",
    tutorPhone: "(11) 98765-4321",
    petName: "Luna",
    contextTag: "Táxi Pet / Banho",
    text: "Boa tarde! O motorista já está a caminho para buscar a Luna em casa?",
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(), // há 42 min
    readByTutor: true,
    readByStore: false,
    status: "aberto",
  },
  {
    id: "msg-welcome-store",
    conversationId: "geral",
    senderId: "loja-bigdog",
    senderName: "Big Dog Pet",
    senderRole: "loja",
    recipientRole: "tutor",
    text: "Olá! Bem-vindo ao Bate-papo da Big Dog Pet. Envie suas dúvidas sobre banho, vacinas, consultas ou entregas por aqui!",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    readByTutor: true,
    readByStore: true,
    status: "respondido",
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

let supabaseChatChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Inicializa e obtém o canal Realtime do Supabase para sincronização instantânea
 * de mensagens entre múltiplos dispositivos, computadores e navegadores.
 */
export function getSupabaseChatChannel() {
  if (typeof window === "undefined") return null;
  if (!supabaseChatChannel) {
    try {
      supabaseChatChannel = supabase.channel("bigdog_inapp_chat_realtime", {
        config: { broadcast: { self: true } },
      });

      supabaseChatChannel
        .on("broadcast", { event: "NEW_MESSAGE" }, ({ payload }) => {
          if (!payload?.message) return;
          const incoming = payload.message as ChatMessage;

          const current = getAllChatMessages();
          if (current.some((m) => m.id === incoming.id)) return;

          const updated = [...current, incoming];
          saveAllChatMessages(updated);

          // Dispara evento local para que a UI de todas as abas/telas atualize na mesma hora
          window.dispatchEvent(
            new CustomEvent("bigdog_chat_event", {
              detail: { type: "NEW_MESSAGE", message: incoming },
            })
          );

          // Alerta sonoro de 2 toques nítidos
          playChatNotificationSound();
        })
        .on("broadcast", { event: "CONVERSATION_CLOSED" }, ({ payload }) => {
          if (!payload?.conversationId) return;
          const current = getAllChatMessages();
          const convId = payload.conversationId;
          let changed = false;
          const updated = current.map((m) => {
            if (m.conversationId === convId || (m.tutorId && m.tutorId === convId)) {
              changed = true;
              return { ...m, status: "fechado" as ChatMessageStatus };
            }
            return m;
          });
          if (changed) {
            saveAllChatMessages(updated);
            window.dispatchEvent(
              new CustomEvent("bigdog_chat_event", {
                detail: {
                  type: "CONVERSATION_CLOSED",
                  conversationId: convId,
                  closedBy: payload.closedBy,
                },
              })
            );
          }
        })
        .on("broadcast", { event: "CONVERSATION_READ" }, ({ payload }) => {
          if (!payload?.conversationId || !payload?.role) return;
          const current = getAllChatMessages();
          let changed = false;
          const updated = current.map((m) => {
            if (m.conversationId === payload.conversationId) {
              if (payload.role === "loja" && !m.readByStore) {
                changed = true;
                const nextStatus: ChatMessageStatus =
                  m.status === "aberto" ? "respondido" : (m.status ?? "respondido");
                return {
                  ...m,
                  readByStore: true,
                  status: nextStatus,
                };
              }
              if (payload.role === "tutor" && !m.readByTutor) {
                changed = true;
                return { ...m, readByTutor: true };
              }
            }
            return m;
          });
          if (changed) {
            saveAllChatMessages(updated);
            window.dispatchEvent(
              new CustomEvent("bigdog_chat_event", {
                detail: { type: "READ", conversationId: payload.conversationId },
              })
            );
          }
        })
        .subscribe();
    } catch (e) {
      console.warn("Supabase Realtime Chat error:", e);
    }
  }
  return supabaseChatChannel;
}

// Conecta o canal Realtime no navegador
if (typeof window !== "undefined") {
  getSupabaseChatChannel();
}

/**
 * Carrega todas as mensagens salvas
 */
export function getAllChatMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migra da versão anterior se houver
      const oldRaw = localStorage.getItem("bigdog_inapp_chat_v2");
      if (oldRaw) {
        try {
          const oldList: ChatMessage[] = JSON.parse(oldRaw);
          if (Array.isArray(oldList) && oldList.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(oldList));
            return oldList;
          }
        } catch {}
      }
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
export function saveAllChatMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error("Erro ao salvar mensagens de chat:", err);
  }
}

/**
 * Obtém ou cria identificador estável de sessão do tutor
 */
export function getOrCreateTutorSessionId(): string {
  if (typeof window === "undefined") return "tutor-anon";
  try {
    let id = localStorage.getItem("bigdog_tutor_session_id");
    if (!id) {
      id = `tutor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem("bigdog_tutor_session_id", id);
    }
    return id;
  } catch {
    return "tutor-anon";
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
  tutorId?: string | null;
  tutorName?: string | null;
  tutorPhone?: string | null;
  petId?: string | null;
  petName?: string | null;
  contextTag?: string | null;
  text: string;
  status?: ChatMessageStatus;
  playSound?: boolean;
}): ChatMessage {
  const currentMessages = getAllChatMessages();
  const recipientRole: RecipientRole =
    params.recipientRole || (params.senderRole === "tutor" ? "loja" : "tutor");

  const conversationId =
    params.conversationId ||
    (params.senderRole === "tutor" ? (params.tutorId || params.senderId) : "geral");

  const defaultStatus: ChatMessageStatus =
    params.status || (params.senderRole === "loja" ? "respondido" : "aberto");

  const newMessage: ChatMessage = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: params.senderRole,
    recipientRole,
    tutorId: params.tutorId ?? (params.senderRole === "tutor" ? params.senderId : null),
    tutorName: params.tutorName ?? (params.senderRole === "tutor" ? params.senderName : null),
    tutorPhone: params.tutorPhone ?? null,
    petId: params.petId ?? null,
    petName: params.petName ?? null,
    contextTag: params.contextTag ?? null,
    text: params.text.trim(),
    createdAt: new Date().toISOString(),
    readByTutor: params.senderRole === "tutor",
    readByStore: params.senderRole !== "tutor",
    status: defaultStatus,
  };

  const updated = [...currentMessages, newMessage];
  saveAllChatMessages(updated);

  // Alerta sonoro de 2 toques (ao chegar msg na loja e no tutor)
  if (params.playSound !== false) {
    playChatNotificationSound();
  }

  // Notifica outras abas/janelas locais
  try {
    broadcastChannel?.postMessage({ type: "NEW_MESSAGE", message: newMessage });
  } catch {}

  // Notifica TODOS os dispositivos e navegadores conectados via Supabase Realtime Broadcast!
  try {
    getSupabaseChatChannel()?.send({
      type: "broadcast",
      event: "NEW_MESSAGE",
      payload: { message: newMessage },
    });
  } catch (err) {
    console.warn("Erro ao transmitir via Supabase Realtime:", err);
  }

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
 * Encerra e finaliza uma conversa (tanto Tutor quanto Loja podem acionar).
 * Marca as mensagens como 'fechado', envia mensagem de encerramento do sistema
 * e sincroniza instantaneamente em ambos os lados via Realtime.
 */
export function closeConversation(params: {
  conversationId: string;
  closedByRole: "tutor" | "loja";
  closedByName: string;
}): ChatMessage {
  const current = getAllChatMessages();
  const convId = params.conversationId;

  // Atualiza status de todas as mensagens dessa conversa para 'fechado'
  const updated = current.map((m) => {
    if (m.conversationId === convId || (m.tutorId && m.tutorId === convId)) {
      return { ...m, status: "fechado" as ChatMessageStatus };
    }
    return m;
  });
  saveAllChatMessages(updated);

  // Envia a mensagem de sistema que documenta a finalização
  const closingMessage = sendChatMessage({
    conversationId: convId,
    senderId: params.closedByRole === "loja" ? "loja" : convId,
    senderName: params.closedByName,
    senderRole: params.closedByRole,
    recipientRole: params.closedByRole === "loja" ? "tutor" : "loja",
    text: `🏁 Atendimento finalizado por ${params.closedByName}. Se precisar de mais suporte ou novo atendimento, basta enviar uma nova mensagem! 🐾`,
    status: "fechado",
    playSound: false,
  });

  // Notifica via Supabase Realtime Broadcast
  try {
    getSupabaseChatChannel()?.send({
      type: "broadcast",
      event: "CONVERSATION_CLOSED",
      payload: {
        conversationId: convId,
        closedBy: params.closedByName,
        role: params.closedByRole,
      },
    });
  } catch {}

  // Notifica via BroadcastChannel local
  try {
    broadcastChannel?.postMessage({
      type: "CONVERSATION_CLOSED",
      conversationId: convId,
      closedBy: params.closedByName,
    });
  } catch {}

  // Dispara evento local para a aba ativa
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("bigdog_chat_event", {
        detail: {
          type: "CONVERSATION_CLOSED",
          conversationId: convId,
          closedBy: params.closedByName,
        },
      })
    );
  }

  return closingMessage;
}

/**
 * Marca mensagens de uma conversa específica ou geral como lidas
 */
export function markConversationAsRead(
  conversationId: string,
  role: "tutor" | "loja"
): void {
  const current = getAllChatMessages();
  let changed = false;

  const updated = current.map((msg) => {
    if (msg.conversationId !== conversationId && !(conversationId === "geral" && msg.conversationId === "geral")) {
      return msg;
    }

    if (role === "tutor" && !msg.readByTutor) {
      changed = true;
      return { ...msg, readByTutor: true };
    }
    if (role === "loja" && !msg.readByStore) {
      changed = true;
      return { ...msg, readByStore: true };
    }
    return msg;
  });

  if (changed) {
    saveAllChatMessages(updated);
    // Notifica outros dispositivos sobre a leitura
    try {
      getSupabaseChatChannel()?.send({
        type: "broadcast",
        event: "CONVERSATION_READ",
        payload: { conversationId, role },
      });
    } catch {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bigdog_chat_event", { detail: { type: "READ_STATUS_UPDATED" } })
      );
    }
  }
}

/**
 * Compatibilidade legada para markChatAsRead
 */
export function markChatAsRead(options: {
  role: "tutor" | "loja";
  conversationId?: string | undefined;
}): void {
  if (options.conversationId) {
    markConversationAsRead(options.conversationId, options.role);
  } else {
    markConversationAsRead("geral", options.role);
  }
}

/**
 * Conta mensagens não lidas para o papel (tutor ou loja)
 */
export function getUnreadCount(role: "tutor" | "loja", conversationId?: string): number {
  const list = getAllChatMessages();
  return list.filter((m) => {
    if (conversationId && m.conversationId !== conversationId) {
      return false;
    }
    return role === "tutor" ? !m.readByTutor : !m.readByStore;
  }).length;
}

/**
 * Retorna as conversas agrupadas em FILA POR ORDEM DE CHEGADA para a loja.
 * Conversas com mensagens não lidas ficam no topo; em seguida, por data mais recente.
 */
export function getAllChatConversations(): ChatConversationSummary[] {
  const messages = getAllChatMessages();
  const map = new Map<string, ChatMessage[]>();

  for (const msg of messages) {
    const cid = msg.conversationId || "geral";
    if (!map.has(cid)) {
      map.set(cid, []);
    }
    map.get(cid)!.push(msg);
  }

  const summaries: ChatConversationSummary[] = [];

  for (const [cid, msgList] of map.entries()) {
    if (msgList.length === 0) continue;

    // Ordena do mais antigo para o mais recente para achar o último
    msgList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const lastMsg = msgList[msgList.length - 1];
    if (!lastMsg) continue;

    // Encontra informações mais ricas do tutor entre todas as mensagens da conversa
    let tutorName = "Tutor";
    let tutorId = cid;
    let tutorPhone: string | null = null;
    let petId: string | null = null;
    let petName: string | null = null;
    let contextTag: string | null = null;

    for (let i = msgList.length - 1; i >= 0; i--) {
      const m = msgList[i];
      if (!m) continue;
      if (m.tutorName && tutorName === "Tutor") tutorName = m.tutorName;
      if (m.senderRole === "tutor" && m.senderName && tutorName === "Tutor") tutorName = m.senderName;
      if (m.tutorId && !tutorId) tutorId = m.tutorId;
      if (m.tutorPhone && !tutorPhone) tutorPhone = m.tutorPhone;
      if (m.petId && !petId) petId = m.petId;
      if (m.petName && !petName) petName = m.petName;
      if (m.contextTag && !contextTag) contextTag = m.contextTag;
    }

    if (cid === "geral" && tutorName === "Tutor") {
      tutorName = "Atendimento Geral";
    }

    const unreadStore = msgList.filter((m) => !m.readByStore).length;
    const unreadTutor = msgList.filter((m) => !m.readByTutor).length;

    // Status: se a última mensagem foi da loja, status é "respondido"; se foi do tutor e loja ainda não leu/respondeu, "aberto"
    const status: ChatMessageStatus =
      lastMsg.status ?? (lastMsg.senderRole === "loja" ? "respondido" : "aberto");

    summaries.push({
      conversationId: cid,
      tutorId: tutorId || cid,
      tutorName,
      tutorPhone,
      petId,
      petName,
      contextTag,
      lastMessage: lastMsg,
      lastMessageText: lastMsg.text,
      lastMessageAt: lastMsg.createdAt,
      unreadCountStore: unreadStore,
      unreadCountTutor: unreadTutor,
      status,
      messageCount: msgList.length,
    });
  }

  // Ordenação da Fila:
  // 1º: Não lidas da loja (ou abertas) no topo absoluto
  // 2º: Data da última mensagem decrescente (mais recentes primeiro)
  return summaries.sort((a, b) => {
    if (a.unreadCountStore > 0 && b.unreadCountStore === 0) return -1;
    if (a.unreadCountStore === 0 && b.unreadCountStore > 0) return 1;
    if (a.status === "aberto" && b.status !== "aberto") return -1;
    if (a.status !== "aberto" && b.status === "aberto") return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

/**
 * Retorna as mensagens de uma conversa específica ordenadas cronologicamente
 */
export function getMessagesForConversation(conversationId: string): ChatMessage[] {
  const all = getAllChatMessages();
  return all
    .filter((m) => m.conversationId === conversationId || (conversationId === "geral" && !m.conversationId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Filtra as conversas e mensagens para a tela de Log & Histórico com filtros
 */
export function getChatLogs(filters?: {
  search?: string;
  period?: ChatPeriodFilter;
}): ChatConversationSummary[] {
  const all = getAllChatConversations();
  const search = filters?.search?.trim().toLowerCase();
  const period = filters?.period ?? "todos";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  return all.filter((conv) => {
    // Filtro por Data
    const convTime = new Date(conv.lastMessageAt).getTime();
    if (period === "hoje" && convTime < startOfToday) return false;
    if (period === "semana" && convTime < sevenDaysAgo) return false;
    if (period === "mes" && convTime < startOfMonth) return false;

    // Filtro por Busca (Nome do tutor, pet, telefone, tag de contexto ou texto da mensagem)
    if (search) {
      const matchName = conv.tutorName.toLowerCase().includes(search);
      const matchPet = conv.petName?.toLowerCase().includes(search) ?? false;
      const matchTag = conv.contextTag?.toLowerCase().includes(search) ?? false;
      const matchText = conv.lastMessageText.toLowerCase().includes(search);
      const matchPhone = conv.tutorPhone?.includes(search) ?? false;
      if (!matchName && !matchPet && !matchTag && !matchText && !matchPhone) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Hook reativo para a Loja acompanhar a Fila de Atendimentos em tempo real
 */
export function useChatQueue() {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(() =>
    getAllChatConversations()
  );
  const [totalUnread, setTotalUnread] = useState<number>(() => getUnreadCount("loja"));

  const refresh = () => {
    setConversations(getAllChatConversations());
    setTotalUnread(getUnreadCount("loja"));
  };

  useEffect(() => {
    getSupabaseChatChannel();
    refresh();

    const handleEvent = () => refresh();
    window.addEventListener("bigdog_chat_event", handleEvent);
    window.addEventListener("storage", refresh);
    broadcastChannel?.addEventListener("message", handleEvent);

    return () => {
      window.removeEventListener("bigdog_chat_event", handleEvent);
      window.removeEventListener("storage", refresh);
      broadcastChannel?.removeEventListener("message", handleEvent);
    };
  }, []);

  return {
    conversations,
    totalUnread,
    refresh,
  };
}

/**
 * Hook React completo para consumir o bate-papo em qualquer tela (tutor ou conversa ativa)
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
    getSupabaseChatChannel();
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
    conversationId?: string;
    tutorId?: string | null;
    tutorName?: string | null;
    tutorPhone?: string | null;
    petId?: string | null;
    petName?: string | null;
    contextTag?: string | null;
    recipientRole?: RecipientRole;
    status?: ChatMessageStatus;
  }) => {
    const targetConvId =
      params.conversationId ||
      options?.conversationId ||
      (params.senderRole === "tutor" ? (params.tutorId || params.senderId) : "geral");

    const msg = sendChatMessage({
      ...params,
      conversationId: targetConvId,
      recipientRole: params.recipientRole || (params.senderRole === "tutor" ? "loja" : "tutor"),
    });
    refresh();
    return msg;
  };

  const closeCurrentConversation = (closedByName?: string) => {
    const targetConvId =
      options?.conversationId ||
      (currentRole === "tutor" ? getOrCreateTutorSessionId() : "geral");
    const name =
      closedByName || (currentRole === "loja" ? "Equipe Big Dog" : "Tutor");

    const msg = closeConversation({
      conversationId: targetConvId,
      closedByRole: currentRole,
      closedByName: name,
    });
    refresh();
    return msg;
  };

  const markAsRead = () => {
    if (options?.conversationId) {
      markConversationAsRead(options.conversationId, currentRole);
    } else {
      markConversationAsRead("geral", currentRole);
    }
    refresh();
  };

  const conversationMessages = messages.filter((m) => {
    const targetId = options?.conversationId;

    if (!targetId || targetId === "geral") {
      if (currentRole === "tutor") {
        return (
          m.recipientRole === "tutor" ||
          m.senderRole === "tutor" ||
          m.conversationId === "geral"
        );
      }
      return true;
    }

    // 1. Mensagens com id da conversa exato
    if (m.conversationId === targetId) return true;
    // 2. Mensagens onde tutorId é o id da conversa
    if (m.tutorId && m.tutorId === targetId) return true;
    // 3. Se for tela do tutor, aceita mensagens destinadas a ele
    if (currentRole === "tutor") {
      if (m.senderId === targetId) return true;
      if (
        m.recipientRole === "tutor" &&
        (m.conversationId === targetId || m.tutorId === targetId || m.conversationId === "geral")
      ) {
        return true;
      }
    }
    return false;
  });

  const isClosed =
    conversationMessages.length > 0 &&
    conversationMessages[conversationMessages.length - 1]?.status === "fechado";

  return {
    messages: conversationMessages,
    unreadCount,
    hasNewMessage: unreadCount > 0,
    isClosed,
    send,
    closeCurrentConversation,
    markAsRead,
    refresh,
  };
}
