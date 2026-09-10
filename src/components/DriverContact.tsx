import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { capitalizeWords } from "@/lib/format";
import { openInAppChat } from "@/lib/inAppChat";
import { Button } from "@/components/ui/button";

export function DriverContact({ appointmentId }: { appointmentId: string }) {
  const { data: driver } = useQuery({
    queryKey: ["assigned-driver", appointmentId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("transport_orders")
        .select("driver_id")
        .eq("appointment_id", appointmentId)
        .maybeSingle();
      if (error) throw error;
      if (!order?.driver_id) return null;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", order.driver_id)
        .maybeSingle();
      if (profileError) throw profileError;
      return profile;
    },
  });

  if (!driver) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-xl border border-border/50">
      <div className="flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Motorista: <strong className="text-foreground">{driver.full_name ? capitalizeWords(driver.full_name) : "designado"}</strong></span>
        {driver.phone && <span className="text-muted-foreground text-[11px]">({driver.phone})</span>}
      </div>
      <Button
        size="sm"
        onClick={() =>
          openInAppChat({
            contextTag: "Transporte",
          })
        }
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs gap-1.5 px-3 h-7 shadow-xs rounded-xl"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Chat
      </Button>
    </div>
  );
}
