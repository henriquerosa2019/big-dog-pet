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
  repeats?: number
): void {
  const finalRepeats = repeats ?? (tone === "cancelado" ? 2 : 3);
  playStatusSound(tone, finalRepeats);
  const options = description ? { description } : undefined;

  switch (tone) {
    case "confirmado":
    case "concluido":
      toast.success(title, options);
      break;
    case "atendimento":
      toast.info(title, options);
      break;
    case "portao":
      toast.warning(title, options);
      break;
    case "cancelado":
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
): { tone: SoundAlertTone; title: string; description: string; repeats?: number } | null {
  const nameStr = petName ? ` (${petName})` : "";

  // 1. Cancelamento pela loja (status geral ou ops_status) - 2 toques de alarme sonoro!
  if (
    (newStatus === "cancelado" && prevStatus !== "cancelado") ||
    (newOps === "cancelado" && prevOps !== "cancelado")
  ) {
    return {
      tone: "cancelado",
      title: `⚠️ Agendamento Cancelado pela Loja${nameStr}`,
      description: "A loja cancelou este agendamento. Toque para falar conosco ou reagendar.",
      repeats: 2,
    };
  }

  // 2. Confirmação pela loja (status geral ou ops_status) - 3 toques de alarme sonoro
  if (
    (newStatus === "confirmado" && prevStatus !== "confirmado") ||
    (newOps === "confirmado" && prevOps !== "confirmado")
  ) {
    return {
      tone: "confirmado",
      title: `🔔 Agendamento Confirmado pela Loja!${nameStr}`,
      description: "O petshop confirmou seu horário com sucesso. Estamos prontos para receber seu pet!",
      repeats: 3,
    };
  }

  // 3. Pet entrou em atendimento (banho / tosa / consulta)
  if (
    (newOps === "em_atendimento" && prevOps !== "em_atendimento") ||
    (newStatus === "em_atendimento" && prevStatus !== "em_atendimento")
  ) {
    const title = petName
      ? `🛁 Atendimento do ${petName} iniciado! 🥳`
      : "🛁 Atendimento iniciado! 🥳";
    return {
      tone: "atendimento",
      title,
      description: `O banho/tosa ${petName ? `do ${petName}` : "do seu pet"} começou com todo o carinho e cuidado!`,
      repeats: 3,
    };
  }

  // 4. Transições operacionais / transporte
  if (newOps && newOps !== prevOps) {
    switch (newOps) {
      case "motorista_designado":
        return {
          tone: "alerta",
          title: `🚗 Motorista Designado${nameStr}`,
          description: "Um motorista foi escalado para o transporte do seu pet.",
          repeats: 2,
        };

      case "em_deslocamento_retirada":
        return {
          tone: "transporte",
          title: `🚐 Motorista a caminho para buscar seu pet!${nameStr}`,
          description: "O motorista iniciou a viagem e está indo até seu endereço.",
          repeats: 3,
        };

      case "chegou_local_retirada":
        return {
          tone: "portao",
          title: `🔔 Motorista no portão para retirada!${nameStr}`,
          description: "O motorista acabou de chegar no seu endereço para retirar seu pet.",
          repeats: 3,
        };

      case "pet_retirado":
        return {
          tone: "transporte",
          title: `🐾 Pet a caminho do petshop!${nameStr}`,
          description: "Seu pet foi retirado com segurança e está viajando para o petshop.",
          repeats: 3,
        };

      case "pet_chegou_petshop":
        return {
          tone: "confirmado",
          title: `🏪 Pet chegou no petshop!${nameStr}`,
          description: "Seu pet chegou são e salvo ao petshop e já está sendo acomodado.",
          repeats: 3,
        };

      case "servico_concluido":
        return {
          tone: "confirmado",
          title: `✨ Serviço concluído!${nameStr}`,
          description: "O atendimento foi finalizado! Seu pet está cheiroso e pronto.",
          repeats: 3,
        };

      case "em_rota_devolucao":
        return {
          tone: "transporte",
          title: `🚐 Motorista a caminho para devolver seu pet!${nameStr}`,
          description: "A viagem de volta para sua casa começou.",
          repeats: 3,
        };

      case "chegou_local_entrega":
        return {
          tone: "portao",
          title: `🔔 Motorista no portão para entrega!${nameStr}`,
          description: "O motorista está no seu portão pronto para devolver seu pet.",
          repeats: 3,
        };

      case "pet_entregue":
        return {
          tone: "concluido",
          title: `🎉 Pet entregue com sucesso!${nameStr}`,
          description: "Atendimento concluído! Obrigado pela confiança no Big Dog Pet.",
          repeats: 3,
        };

      default:
        break;
    }
  }

  // 5. Finalização direta por status geral
  if (newStatus === "concluido" && prevStatus !== "concluido") {
    return {
      tone: "concluido",
      title: `🎉 Atendimento finalizado!${nameStr}`,
      description: "Atendimento concluído com sucesso. Obrigado por escolher o Big Dog Pet!",
      repeats: 3,
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
  const petNameMap = useRef<Map<string, string>>(new Map());

  // 1. Carga inicial de todos os agendamentos do usuário para não apitar no primeiro carregamento
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    async function loadCurrentStatuses() {
      let query = supabase
        .from("appointments")
        .select("id, status, ops_status, pets(name)");

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
          const pName = (item.pets as { name?: string | null } | null)?.name;
          if (pName) {
            petNameMap.current.set(item.id, pName);
          }
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
              status: newRecord.status || "pendente",
              ops_status: newRecord.ops_status || "agendado",
            });
            playStatusSound("confirmado", 3);
            toast.success("🔔 Agendamento Registrado!", {
              description: "Seu pet está com agendamento ativo e visível no topo da tela inicial!",
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent<StatusAlertEventDetail>("bigdog_status_alert", {
                  detail: {
                    tone: "confirmado",
                    title: "Agendamento Registrado",
                    description: "Seu pet está com agendamento ativo!",
                  },
                })
              );
            }
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

          const petName = petNameMap.current.get(newRecord.id);
          const alert = resolveStatusAlert(prevStatus, newStatus, prevOps, newOps, petName);
          if (alert) {
            const repeats = alert.repeats ?? 3;
            playStatusSound(alert.tone, repeats); // Soa 2 vezes para cancelamento, 3 para outros!
            const options = { description: alert.description };
            if (alert.tone === "confirmado" || alert.tone === "concluido") {
              toast.success(alert.title, options);
            } else if (alert.tone === "atendimento") {
              toast.info(alert.title, options);
            } else if (alert.tone === "portao") {
              toast.warning(alert.title, options);
            } else if (alert.tone === "cancelado" || alert.tone === "alerta") {
              toast.error(alert.title, options);
            } else {
              toast.info(alert.title, options);
            }
          }

          // SEMPRE dispara o evento local para forçar revalidação imediata do React Query em todas as telas
          if (typeof window !== "undefined") {
            const detail: StatusAlertEventDetail = {
              tone: alert?.tone ?? "alerta",
              title: alert?.title ?? "Atualização de status",
              ...(alert?.description ? { description: alert.description } : {}),
            };
            window.dispatchEvent(
              new CustomEvent<StatusAlertEventDetail>("bigdog_status_alert", { detail })
            );
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
