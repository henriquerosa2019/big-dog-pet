import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { opsStatusLabels, type OpsStatus } from "@/lib/transport";

/**
 * Expandable timeline of an appointment's pet_status_history rows — the audit
 * trail behind "segurança na retirada" (who changed what, when). Fetched only
 * when expanded, shared between the tutor's own account page and the admin
 * "Retirada/Entrega" tab.
 */
export function TransportHistoryList({ appointmentId }: { appointmentId: string }) {
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
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-semibold text-primary underline"
      >
        {expanded ? "Ocultar histórico" : "Ver histórico"}
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
