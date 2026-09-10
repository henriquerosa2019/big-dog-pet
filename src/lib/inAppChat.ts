/**
 * Motor de Bate-papo Interno Offline no App (Substituição do WhatsApp)
 * Big Dog Pet - Franco da Rocha
 * 
 * Permite conversa direta entre Tutor e Loja/Veterinário/Motorista dentro do app.
 * Funciona offline com persistência em localStorage e sincronização entre janelas.
 * Dispara alarme sonoro de 2 toques e badge "(Msg Nova)" ao receber mensagens.
 */

import { useState, useEffect, useMemo } from "react";
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
  petSpecies?: string | null;
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
  petSpecies?: string | undefined;
  conversationId?: string | undefined;
  tutorId?: string | undefined;
  tutorName?: string | undefined;
  tutorPhone?: string | undefined;
  senderRole?: SenderRole | undefined;
  senderName?: string | undefined;
}

export interface ChatConversationSummary {
  conversationId: string;
  tutorId: string;
  tutorName: string;
  tutorPhone?: string | null;
  petId?: string | null;
  petName?: string | null;
  petSpecies?: string | null;
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
 * Retorna o emoji elegante correto com base na espécie ou nome do pet:
 * - Gatos: 🐱 (carinha de gato)
 * - Cães: 🐶 (carinha de cão)
 * - Padrão: 🐾 (patinhas elegantes)
 */
export function getPetEmoji(species?: string | null, name?: string | null): string {
  const text = `${species || ""} ${name || ""}`.toLowerCase();
  if (
    text.includes("gato") ||
    text.includes("gata") ||
    text.includes("felin") ||
    text.includes("cat") ||
    text.includes("miau")
  ) {
    return "🐱";
  }
  if (
    text.includes("cao") ||
    text.includes("cão") ||
    text.includes("cachorr") ||
    text.includes("dog") ||
    text.includes("canin") ||
    text.includes("auau")
  ) {
    return "🐶";
  }
  return "🐾";
}

/**
 * Dispara evento global no navegador para abrir o modal de chat interno em qualquer lugar do app
 */
export function openInAppChat(detail?: OpenChatDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("open_inapp_chat", { detail }));
}

const STORAGE_KEY = "bigdog_inapp_chat_v4";
const BROADCAST_CHANNEL_NAME = "bigdog_inapp_chat_channel";

// Mensagens padrão iniciais demonstrativas (vazio para a nova fase de homologação)
const DEFAULT_INITIAL_MESSAGES: ChatMessage[] = [];

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const list: ChatMessage[] = JSON.parse(raw);
    let healed = false;

    // Remove mensagens automáticas de fechamento e mensagens pré-definidas anteriores que poluem o histórico
    const filtered = list.filter(
      (m) =>
        !m.text.startsWith("🏁 Atendimento finalizado") &&
        !m.text.includes("Sou tutor(a) de um pet com transporte agendado")
    );
    if (filtered.length !== list.length) {
      healed = true;
    }

    const sanitized = filtered.map((m) => {
      // Se a mensagem foi enviada pelo tutor e a loja ainda não leu, assegura que continue não lida pela loja
      if (m.senderRole === "tutor" && !m.readByStore && m.recipientRole !== "loja") {
        healed = true;
        return {
          ...m,
          recipientRole: "loja" as RecipientRole,
        };
      }
      return m;
    });

    if (healed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      return sanitized;
    }
    return list;
  } catch {
    return [];
  }
}

/**
 * Zera todo o histórico de mensagens de bate-papo para nova fase de homologação
 */
export function clearAllChatMessages(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem("bigdog_inapp_chat_v3");
    localStorage.removeItem("bigdog_inapp_chat_v2");
    window.dispatchEvent(
      new CustomEvent("bigdog_chat_event", {
        detail: { type: "CHAT_CLEARED" },
      })
    );
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: "CHAT_CLEARED" });
    }
  } catch (err) {
    console.error("Erro ao zerar mensagens de chat:", err);
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
  petSpecies?: string | null;
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
    petSpecies: params.petSpecies ?? null,
    contextTag: params.contextTag ?? null,
    text: params.text.trim(),
    createdAt: new Date().toISOString(),
    readByTutor: params.senderRole === "tutor",
    readByStore: params.senderRole === "loja" || params.senderRole === "motorista",
    status: defaultStatus,
  };

  // Ao enviar nova mensagem do tutor, loja ou motorista, reabre a conversa se ela estava fechada
  const updated = currentMessages.map((m) => {
    if (
      (m.conversationId === conversationId || (m.tutorId && m.tutorId === conversationId)) &&
      m.status === "fechado"
    ) {
      return {
        ...m,
        status: (params.senderRole === "tutor" ? "aberto" : "respondido") as ChatMessageStatus,
      };
    }
    return m;
  });
  updated.push(newMessage);
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
 * Marca as mensagens como 'fechado' e sincroniza instantaneamente sem poluir o histórico com mensagens automáticas.
 */
export function closeConversation(params: {
  conversationId: string;
  closedByRole: "tutor" | "loja" | "motorista";
  closedByName: string;
}): void {
  const current = getAllChatMessages();
  const convId = params.conversationId;

  // Atualiza status de todas as mensagens dessa conversa para 'fechado'
  // PRESERVANDO o estado de leitura do destinatário para que a mensagem nunca se perca!
  const updated = current.map((m) => {
    if (m.conversationId === convId || (m.tutorId && m.tutorId === convId)) {
      if (params.closedByRole === "loja" || params.closedByRole === "motorista") {
        return {
          ...m,
          status: "fechado" as ChatMessageStatus,
          readByStore: true,
          readByTutor: m.readByTutor, // CRUCIAL: se o tutor ainda não leu, continua não lido!
        };
      } else {
        // Se o tutor encerrou: marca lido para o tutor, mas PRESERVA readByStore para a loja ver a resposta
        return {
          ...m,
          status: "fechado" as ChatMessageStatus,
          readByTutor: true,
          readByStore: m.readByStore, // CRUCIAL: se a loja ainda não leu, continua não lido!
        };
      }
    }
    return m;
  });
  saveAllChatMessages(updated);

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
    const isTarget =
      msg.conversationId === conversationId ||
      (msg.tutorId && msg.tutorId === conversationId) ||
      (msg.senderId && msg.senderId === conversationId) ||
      (conversationId === "geral" && !msg.conversationId);

    if (!isTarget) {
      return msg;
    }

    if (role === "tutor" && !msg.readByTutor) {
      changed = true;
      return { ...msg, readByTutor: true };
    }
    if (role === "loja" && !msg.readByStore) {
      changed = true;
      const nextStatus: ChatMessageStatus =
        msg.status === "aberto" ? "respondido" : (msg.status ?? "respondido");
      return { ...msg, readByStore: true, status: nextStatus };
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

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: "READ_STATUS_UPDATED", conversationId, role });
      } catch {}
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bigdog_chat_event", { detail: { type: "READ_STATUS_UPDATED", conversationId, role } })
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
    if (conversationId && m.conversationId !== conversationId && m.tutorId !== conversationId) {
      return false;
    }
    if (role === "loja") {
      // Para a loja: conta mensagens enviadas pelo tutor que a loja ainda não leu
      return !m.readByStore && m.senderRole === "tutor";
    } else {
      // Para o tutor: conta mensagens enviadas pela loja que o tutor ainda não leu
      return !m.readByTutor && m.senderRole !== "tutor";
    }
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
    let petSpecies: string | null = null;
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
      if (m.petSpecies && !petSpecies) petSpecies = m.petSpecies;
      if (m.contextTag && !contextTag) contextTag = m.contextTag;
    }

    if (cid === "geral" && tutorName === "Tutor") {
      tutorName = "Atendimento Geral";
    }

    // Mensagens não lidas pela loja enviadas pelo tutor
    const unreadStore = msgList.filter((m) => !m.readByStore && m.senderRole === "tutor").length;
    // Mensagens não lidas pelo tutor enviadas pela loja
    const unreadTutor = msgList.filter((m) => !m.readByTutor && m.senderRole !== "tutor").length;

    // Se houver mensagens do tutor não lidas pela loja, a conversa NÃO pode estar finalizada/oculta na loja!
    const isClosed = lastMsg.status === "fechado" && unreadStore === 0;

    // Status operacional da conversa:
    // Se isClosed: "fechado"
    // Se a loja foi a última a responder e não há novas do tutor: "respondido"
    // Caso contrário (tutor respondeu ou aguarda loja): "aberto"
    const status: ChatMessageStatus = isClosed
      ? "fechado"
      : lastMsg.senderRole === "loja" && unreadStore === 0
      ? "respondido"
      : "aberto";

    summaries.push({
      conversationId: cid,
      tutorId: tutorId || cid,
      tutorName,
      tutorPhone,
      petId,
      petName,
      petSpecies,
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
  // 1º: Não lidas da loja no topo absoluto (urgência máxima!)
  // 2º: Não fechados antes de fechados
  // 3º: Abertos antes de respondidos
  // 4º: Data da última mensagem decrescente (mais recentes primeiro)
  return summaries.sort((a, b) => {
    if (a.unreadCountStore > 0 && b.unreadCountStore === 0) return -1;
    if (a.unreadCountStore === 0 && b.unreadCountStore > 0) return 1;
    if (a.status !== "fechado" && b.status === "fechado") return -1;
    if (a.status === "fechado" && b.status !== "fechado") return 1;
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
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [totalUnread, setTotalUnread] = useState<number>(0);

  const refresh = () => {
    setConversations(getAllChatConversations());
    setTotalUnread(getUnreadCount("loja"));
  };

  useEffect(() => {
    let mounted = true;
    getSupabaseChatChannel();
    refresh();

    const handleEvent = () => {
      if (!mounted) return;
      refresh();
    };

    window.addEventListener("bigdog_chat_event", handleEvent);
    window.addEventListener("storage", handleEvent);
    broadcastChannel?.addEventListener("message", handleEvent);

    return () => {
      mounted = false;
      window.removeEventListener("bigdog_chat_event", handleEvent);
      window.removeEventListener("storage", handleEvent);
      broadcastChannel?.removeEventListener("message", handleEvent);
    };
  }, []);

  const openConversations = useMemo(
    () => conversations.filter((c) => c.status !== "fechado"),
    [conversations]
  );
  const closedConversations = useMemo(
    () => conversations.filter((c) => c.status === "fechado"),
    [conversations]
  );
  const unreadConversationsCount = useMemo(
    () => conversations.filter((c) => c.unreadCountStore > 0 && c.status !== "fechado").length,
    [conversations]
  );

  return {
    conversations,
    openConversations,
    closedConversations,
    unreadConversationsCount,
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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
    petSpecies?: string | null;
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

  const closeCurrentConversation = (
    closedByName?: string,
    closedByRole?: "tutor" | "loja" | "motorista"
  ) => {
    const targetConvId =
      options?.conversationId ||
      (currentRole === "tutor" ? getOrCreateTutorSessionId() : "geral");
    const role = closedByRole || currentRole;
    const name =
      closedByName ||
      (role === "motorista" ? "Motorista Big Dog" : role === "loja" ? "Equipe Big Dog" : "Tutor");

    closeConversation({
      conversationId: targetConvId,
      closedByRole: role,
      closedByName: name,
    });
    refresh();
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
    // 2. Mensagens onde tutorId ou senderId é o id da conversa
    if (m.tutorId && m.tutorId === targetId) return true;
    if (m.senderId && m.senderId === targetId) return true;
    // 3. Se for tela do tutor, aceita mensagens destinadas a ele
    if (currentRole === "tutor") {
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
    conversationMessages[conversationMessages.length - 1]?.status === "fechado" &&
    unreadCount === 0;

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

/**
 * Localiza o ID da conversa que contém mensagens não lidas destinadas ao tutor,
 * ou a conversa mais recente do tutor.
 */
export function getActiveTutorConversationId(currentUserId?: string | null): string {
  const messages = getAllChatMessages();
  // 1. Prioridade máxima: conversa com mensagem não lida para o tutor
  const unreadMsg = messages
    .filter((m) => !m.readByTutor && m.senderRole !== "tutor")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (unreadMsg) {
    return unreadMsg.conversationId || unreadMsg.tutorId || currentUserId || getOrCreateTutorSessionId();
  }

  // 2. Segunda prioridade: conversa mais recente associada ao tutor atual
  if (currentUserId) {
    const userMsg = messages
      .filter(
        (m) =>
          m.tutorId === currentUserId ||
          m.conversationId === currentUserId ||
          m.senderId === currentUserId
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (userMsg) {
      return userMsg.conversationId || currentUserId;
    }
  }

  // 3. Terceira prioridade: última conversa qualquer registrada
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.conversationId) {
      return lastMsg.conversationId;
    }
  }

  return currentUserId || getOrCreateTutorSessionId();
}

export interface TutorUnreadAlert {
  hasUnread: boolean;
  unreadCount: number;
  lastMessage?: ChatMessage | undefined;
  conversationId: string;
}

/**
 * Localiza mensagens não lidas de um tutor ou pet específico para alerta destacado no Kanban da Loja.
 */
export function getUnreadStoreMessagesForTutorOrPet(params: {
  userId?: string | null | undefined;
  petId?: string | null | undefined;
  tutorName?: string | null | undefined;
  petName?: string | null | undefined;
}): TutorUnreadAlert {
  const messages = getAllChatMessages();
  const unreadList: ChatMessage[] = [];

  const targetUserId = params.userId?.trim();
  const targetPetId = params.petId?.trim();
  const targetTutorName = params.tutorName?.trim().toLowerCase();
  const targetPetName = params.petName?.trim().toLowerCase();

  for (const m of messages) {
    if (m.readByStore) continue;
    // Considera apenas mensagens destinadas à loja ou originadas por tutor
    if (m.recipientRole !== "loja" && m.senderRole !== "tutor") continue;

    let matched = false;

    // Match 1: por userId (tutorId, conversationId ou senderId)
    if (targetUserId) {
      if (
        m.tutorId === targetUserId ||
        m.conversationId === targetUserId ||
        m.senderId === targetUserId
      ) {
        matched = true;
      }
    }

    // Match 2: por petId
    if (!matched && targetPetId && m.petId === targetPetId) {
      matched = true;
    }

    // Match 3: por nome de tutor e/ou pet
    if (!matched && targetTutorName && m.tutorName) {
      const msgTutor = m.tutorName.trim().toLowerCase();
      if (
        msgTutor === targetTutorName ||
        targetTutorName.includes(msgTutor) ||
        msgTutor.includes(targetTutorName)
      ) {
        if (targetPetName && m.petName) {
          const msgPet = m.petName.trim().toLowerCase();
          if (
            msgPet === targetPetName ||
            targetPetName.includes(msgPet) ||
            msgPet.includes(targetPetName)
          ) {
            matched = true;
          }
        } else {
          matched = true;
        }
      }
    }

    // Match 4: por nome do pet diretamente (ex: "Thor")
    if (!matched && targetPetName && m.petName) {
      const msgPet = m.petName.trim().toLowerCase();
      if (
        msgPet === targetPetName ||
        targetPetName.includes(msgPet) ||
        msgPet.includes(targetPetName)
      ) {
        matched = true;
      }
    }

    if (matched) {
      unreadList.push(m);
    }
  }

  unreadList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const last = unreadList[unreadList.length - 1];

  const convId =
    last?.conversationId ||
    last?.tutorId ||
    targetUserId ||
    "geral";

  return {
    hasUnread: unreadList.length > 0,
    unreadCount: unreadList.length,
    lastMessage: last,
    conversationId: convId,
  };
}

/**
 * Responde diretamente a um tutor a partir da loja (ex: pelo Kanban ou atalho rápido),
 * marcando as mensagens anteriores como lidas e enviando a resposta com sincronização total.
 */
export function replyToTutorFromStore(params: {
  conversationId: string;
  text: string;
  tutorId?: string | null | undefined;
  tutorName?: string | null | undefined;
  petId?: string | null | undefined;
  petName?: string | null | undefined;
  petSpecies?: string | null | undefined;
  contextTag?: string | null | undefined;
}): ChatMessage {
  // 1. Marca mensagens anteriores da conversa como lidas pela loja
  markConversationAsRead(params.conversationId, "loja");
  if (params.tutorId && params.tutorId !== params.conversationId) {
    markConversationAsRead(params.tutorId, "loja");
  }

  // 2. Envia a mensagem de resposta da loja
  const msg = sendChatMessage({
    conversationId: params.conversationId,
    senderId: "loja",
    senderName: "Equipe Big Dog",
    senderRole: "loja",
    recipientRole: "tutor",
    tutorId: params.tutorId ?? params.conversationId,
    tutorName: params.tutorName ?? "Tutor",
    petId: params.petId ?? null,
    petName: params.petName ?? null,
    petSpecies: params.petSpecies ?? null,
    contextTag: params.contextTag ?? null,
    text: params.text.trim(),
    status: "respondido",
    playSound: true,
  });

  return msg;
}

/**
 * Hook reativo que escuta alterações no chat para alimentar o status "MSG Tutor" no Kanban operacional
 */
export function useTutorChatAlerts() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let mounted = true;
    const handleEvent = () => {
      if (!mounted) return;
      setVersion((v) => v + 1);
    };

    window.addEventListener("bigdog_chat_event", handleEvent);
    window.addEventListener("storage", handleEvent);
    broadcastChannel?.addEventListener("message", handleEvent);

    return () => {
      mounted = false;
      window.removeEventListener("bigdog_chat_event", handleEvent);
      window.removeEventListener("storage", handleEvent);
      broadcastChannel?.removeEventListener("message", handleEvent);
    };
  }, []);

  const checkUnread = (params: {
    userId?: string | null | undefined;
    petId?: string | null | undefined;
    tutorName?: string | null | undefined;
    petName?: string | null | undefined;
  }): TutorUnreadAlert => {
    void version;
    return getUnreadStoreMessagesForTutorOrPet(params);
  };

  return { checkUnread, version };
}

