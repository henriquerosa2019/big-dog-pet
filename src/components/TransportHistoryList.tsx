import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { opsStatusLabels, opsStatusOrder, type OpsStatus } from "@/lib/transport";
import { cn } from "@/lib/utils";

/**
 * Resumo compacto (barra de progresso) + histórico detalhado retrátil de um
 * agendamento com transporte. Antes só existia a lista de histórico (até 10
 * etapas de pet_status_history) sempre igual, ocupando espaço vertical assim
 * que expandida — pedido do Henrique 2026-08-28 pra dar uma visão rápida do
 * andamento sem precisar abrir o histórico completo.
 */
export function TransportHistoryList({
  appointmentId,
  currentStatus,
}: {
  appointmentId: string;
  currentStatus?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ["transport-history", appointmentId],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_status_history")
        .select("id, status, note, created_at")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mt-2">
      {currentStatus && currentStatus !== "cancelado" && (
        <OpsStatusProgress status={currentStatus as OpsStatus} />
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary underline"
        aria-expanded={expanded}
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        {expanded ? "Ocultar histórico completo" : "Ver histórico completo"}
      </button>
      {expanded && (
        <ol className="mt-2 space-y-2 border-l-2 border-primary/30 pl-3">
          {isLoading && <li className="text-xs text-muted-foreground">Carregando...</li>}
          {(history ?? []).map((h) => (
            <li key={h.id} className="text-xs">
              <p className="font-semibold">{opsStatusLabels[h.status as OpsStatus] ?? h.status}</p>
              <p className="text-muted-foreground">{formatDateTime(h.created_at)}</p>
              {h.note && <p className="text-muted-foreground">{h.note}</p>}
            </li>
          ))}
          {!isLoading && (history ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground">Sem histórico ainda.</li>
          )}
        </ol>
      )}
    </div>
  );
}

/** Barra segmentada com a etapa atual dentre as 10 etapas não-terminais de ops_status. */
function OpsStatusProgress({ status }: { status: OpsStatus }) {
  const steps = opsStatusOrder.filter((s) => s !== "cancelado");
  const idx = Math.max(0, steps.indexOf(status));

  return (
    <div>
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`Etapa ${idx + 1} de ${steps.length}: ${opsStatusLabels[status]}`}
      >
        {steps.map((step, i) => (
          <span
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= idx ? "bg-primary" : "bg-secondary",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Etapa {idx + 1} de {steps.length} · {opsStatusLabels[status]}
      </p>
    </div>
  );
}
