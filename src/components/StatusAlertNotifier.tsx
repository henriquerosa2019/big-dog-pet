import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { playStatusSound, type SoundAlertTone } from "@/lib/soundAlerts";

export interface StatusAlertEventDetail {
  tone: SoundAlertTone;
  title: string;
  description?: string | undefined;
}

/**
 * Dispara um alerta sonoro e notificação toast em toda a aplicação.
 */
export function dispatchStatusAlert(
  tone: SoundAlertTone,
  title: string,
  description?: string,
  repeats = 3
): void {
  playStatusSound(tone, repeats);
  const options = description ? { description } : undefined;

  switch (tone) {
    case "confirmado":
    case "concluido":
      toast.success(title, options);
      break;
    case "portao":
      toast.warning(title, options);
      break;
    case "alerta":
      toast.error(title, options);
      break;
    default:
      toast.info(title, options);
      break;
  }

  if (typeof window !== "undefined") {
    const detail: StatusAlertEventDetail = {
      tone,
      title,
      ...(description !== undefined ? { description } : {}),
    };
    window.dispatchEvent(
      new CustomEvent<StatusAlertEventDetail>("bigdog_status_alert", { detail })
    );
  }
}

/**
 * Mapeia a transição de status para tom sonoro, título e descrição amigável.
 */
function resolveStatusAlert(
  prevStatus: string | undefined,
  newStatus: string,
  prevOps: string | undefined,
  newOps: string,
  petName?: string
): { tone: SoundAlertTone; title: string; description: string } | null {
  const nameStr = petName ? ` (${petName})` : "";

  // 1. Confirmação pela loja
  if (newStatus === "confirmado" && prevStatus !== "confirmado") {
    return {
      tone: "confirmado",
      title: `🔔 Agendamento Confirmado pela Loja!${nameStr}`,
      description: "O petshop confirmou seu horário com sucesso. Estamos prontos para receber seu pet!",
    };
  }

  // 2. Transições operacionais / transporte / atendimento
  if (newOps && newOps !== prevOps) {
    switch (newOps) {
      case "motorista_designado":
        return {
          tone: "alerta",
          title: `🚗 Motorista Designado${nameStr}`,
          description: "Um motorista foi escalado para o transporte do seu pet.",
        };

      case "em_deslocamento_retirada":
        return {
          tone: "transporte",
          title: `🚐 Motorista a caminho para buscar seu pet!${nameStr}`,
          description: "O motorista iniciou a viagem e está indo até seu endereço.",
        };

      case "chegou_local_retirada":
        return {
          tone: "portao",
          title: `🔔 Motorista no portão para retirada!${nameStr}`,
          description: "O motorista acabou de chegar no seu endereço para retirar seu pet.",
        };

      case "pet_retirado":
        return {
          tone: "transporte",
          title: `🐾 Pet a caminho do petshop!${nameStr}`,
          description: "Seu pet foi retirado com segurança e está viajando para o petshop.",
        };

      case "pet_chegou_petshop":
        return {
          tone: "confirmado",
          title: `🏪 Pet chegou no petshop!${nameStr}`,
          description: "Seu pet chegou são e salvo ao petshop e já está sendo acomodado.",
        };

      case "em_atendimento":
        return {
          tone: "atendimento",
          title: `🛁 Pet em atendimento agora!${nameStr}`,
          description: "O banho/tosa do seu pet começou com todo o carinho e cuidado.",
        };

      case "servico_concluido":
        return {
          tone: "confirmado",
          title: `✨ Serviço concluído!${nameStr}`,
          description: "O atendimento foi finalizado! Seu pet está cheiroso e pronto.",
        };

      case "em_rota_devolucao":
        return {
          tone: "transporte",
          title: `🚐 Motorista a caminho para devolver seu pet!${nameStr}`,
          description: "A viagem de volta para sua casa começou.",
        };

      case "chegou_local_entrega":
        return {
          tone: "portao",
          title: `🔔 Motorista no portão para entrega!${nameStr}`,
          description: "O motorista está no seu portão pronto para devolver seu pet.",
        };

      case "pet_entregue":
        return {
          tone: "concluido",
          title: `🎉 Pet entregue com sucesso!${nameStr}`,
          description: "Atendimento concluído! Obrigado pela confiança no Big Dog Pet.",
        };

      case "cancelado":
        return {
          tone: "alerta",
          title: `⚠️ Agendamento Cancelado${nameStr}`,
          description: "Este agendamento foi cancelado.",
        };

      default:
        break;
    }
  }

  // 3. Finalização direta por status geral
  if (newStatus === "concluido" && prevStatus !== "concluido") {
    return {
      tone: "concluido",
      title: `🎉 Atendimento finalizado!${nameStr}`,
      description: "Atendimento concluído com sucesso. Obrigado por escolher o Big Dog Pet!",
    };
  }

  return null;
}

/**
 * Componente global que escuta o Supabase Realtime e eventos locais para
 * disparar os alertas sonoros sintetizados e toasts correspondentes.
 */
export function StatusAlertNotifier() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);

  // Armazena o estado conhecido em memória para detectar mudanças
  const knownStatusMap = useRef<Map<string, { status: string; ops_status: string }>>(new Map());

  // 1. Carga inicial dos agendamentos abertos para não apitar no primeiro carregamento
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    async function loadCurrentStatuses() {
      let query = supabase
        .from("appointments")
        .select("id, status, ops_status")
        .neq("status", "cancelado")
        .neq("status", "concluido");

      // Se não for admin, carrega apenas os agendamentos do tutor
      if (!isAdmin && user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data } = await query;
      if (isMounted && data) {
        for (const item of data) {
          knownStatusMap.current.set(item.id, {
            status: item.status || "",
            ops_status: item.ops_status || "",
          });
        }
      }
    }

    loadCurrentStatuses();

    return () => {
      isMounted = false;
    };
  }, [user?.id, isAdmin]);

  // 2. Inscrição no Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `realtime-status-alerts-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          const newRecord = payload.new as {
            id: string;
            status?: string;
            ops_status?: string;
            user_id?: string;
          };
          if (!newRecord || !newRecord.id) return;

          // Se não for admin, garante que o agendamento pertence a este usuário
          if (!isAdmin && newRecord.user_id && newRecord.user_id !== user.id) {
            return;
          }

          // Se for INSERT de novo agendamento feito para o tutor
          if (payload.eventType === "INSERT") {
            knownStatusMap.current.set(newRecord.id, {
              status: newRecord.status || "agendado",
              ops_status: newRecord.ops_status || "",
            });
            playStatusSound("confirmado", 3);
            toast.success("🔔 Agendamento Confirmado pela Loja!", {
              description: "Seu pet está com agendamento ativo e garantido no topo da tela inicial!",
            });
            return;
          }

          // Se for UPDATE de status ou ops_status
          const prev = knownStatusMap.current.get(newRecord.id);
          const prevStatus = prev?.status;
          const newStatus = newRecord.status || "";
          const prevOps = prev?.ops_status;
          const newOps = newRecord.ops_status || "";

          // Atualiza cache em memória
          knownStatusMap.current.set(newRecord.id, {
            status: newStatus,
            ops_status: newOps,
          });

          // Se for o mesmo estado exato, ignora
          if (prev && prev.status === newStatus && prev.ops_status === newOps) {
            return;
          }

          const alert = resolveStatusAlert(prevStatus, newStatus, prevOps, newOps);
          if (alert) {
            playStatusSound(alert.tone, 3); // Soa 3 vezes o alarme
            const options = { description: alert.description };
            if (alert.tone === "confirmado" || alert.tone === "concluido") {
              toast.success(alert.title, options);
            } else if (alert.tone === "portao") {
              toast.warning(alert.title, options);
            } else if (alert.tone === "alerta") {
              toast.error(alert.title, options);
            } else {
              toast.info(alert.title, options);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin]);

  return null;
}
