import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Nome do canal Realtime (broadcast privado) usado para transmitir a posição
 * do motorista em tempo real durante a retirada/devolução de um agendamento.
 * Usa appointment_id (não transport_order_id) pra ficar consistente com o
 * resto do app — DriverContact e TransportHistoryList já são keyed por
 * appointmentId. Autorização em supabase/migrations/20260829000000_realtime_driver_location_auth.sql
 * (RLS em realtime.messages via realtime.topic()): só o tutor dono do
 * agendamento, o motorista designado e admins conseguem ler; só o motorista
 * designado pode enviar.
 */
export function driverLocationTopic(appointmentId: string): string {
  return `driver-location:${appointmentId}`;
}

export type DriverLocationPayload = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
};

/**
 * Lado do motorista: enquanto `active` for true, ativa o GPS do navegador
 * (`watchPosition`) e transmite a posição por um canal privado do Supabase
 * Realtime (broadcast — não grava nada no banco, zero custo de disco).
 * Retorna `sharing` (true assim que a 1ª posição foi enviada com sucesso) e
 * `error` (ex.: permissão de localização negada) pro chamador exibir.
 */
export function useDriverLocationBroadcast(appointmentId: string | null, active: boolean) {
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!active || !appointmentId) {
      setSharing(false);
      setError(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Este navegador não suporta compartilhar localização.");
      return;
    }

    setError(null);
    const channel = supabase.channel(driverLocationTopic(appointmentId), {
      config: { private: true },
    });
    channel.subscribe();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSharing(true);
        setError(null);
        const payload: DriverLocationPayload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
          updatedAt: new Date().toISOString(),
        };
        void channel.send({ type: "broadcast", event: "location_update", payload });
      },
      (err) => {
        setSharing(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada — ative o GPS pra compartilhar sua posição."
            : "Não foi possível obter sua localização agora.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      void supabase.removeChannel(channel);
      setSharing(false);
    };
  }, [appointmentId, active]);

  return { sharing, error };
}

/**
 * Lado de quem acompanha (tutor no /conta, admin no painel): assina o mesmo
 * canal e guarda a última posição recebida. `active` controla quando
 * assinar — só faz sentido enquanto o pedido estiver em rota
 * (em_deslocamento_retirada / em_rota_devolucao).
 */
export function useDriverLocationSubscription(
  appointmentId: string | null,
  active: boolean,
): DriverLocationPayload | null {
  const [position, setPosition] = useState<DriverLocationPayload | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    setPosition(null);
    if (!active || !appointmentId) return;

    const channel = supabase
      .channel(driverLocationTopic(appointmentId), { config: { private: true } })
      .on("broadcast", { event: "location_update" }, ({ payload }) => {
        if (activeRef.current) setPosition(payload as DriverLocationPayload);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appointmentId, active]);

  return position;
}
