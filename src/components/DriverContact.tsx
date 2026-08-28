import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { capitalizeWords, whatsappLinkTo } from "@/lib/format";

/**
 * Mostra o motorista designado pra retirada/devolução do agendamento, com
 * link direto pro WhatsApp dele — pedido do Henrique 2026-08-28 pra o tutor
 * conseguir falar com o motorista em caso de imprevisto na busca/entrega, sem
 * precisar passar pelo petshop. Só aparece depois que um motorista foi
 * designado (transport_orders.driver_id); antes disso não renderiza nada.
 *
 * Depende da policy de RLS "Tutors read assigned driver profile" em
 * public.profiles (migration 20260828140000) — sem ela o tutor não consegue
 * ler o perfil de outro usuário (o motorista) e isso sempre retorna null.
 */
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

  const link = whatsappLinkTo(
    driver.phone,
    "Olá! Sou tutor(a) de um pet que você está buscando/entregando pela Big Dog Pet.",
  );

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      <Phone className="h-3.5 w-3.5 shrink-0" />
      Motorista: {driver.full_name ? capitalizeWords(driver.full_name) : "designado"}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline"
        >
          Falar no WhatsApp
        </a>
      )}
    </p>
  );
}
