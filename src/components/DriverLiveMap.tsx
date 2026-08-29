import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { useDriverLocationSubscription } from "@/lib/driverLocation";

/** Centro aproximado de Franco da Rocha - SP, usado só até a 1ª posição do
 * motorista chegar (o mapa recentraliza assim que houver uma posição real). */
const FALLBACK_CENTER: [number, number] = [-23.3226, -46.7275];

/**
 * Mapa ao vivo da posição do motorista durante a retirada/devolução do pet —
 * assina o canal Realtime de src/lib/driverLocation.ts e move um marcador
 * conforme as posições chegam. Só renderiza algo quando `active` (ops_status
 * em rota) for true; o import do Leaflet em si roda só no efeito (client-side),
 * pra não quebrar o SSR do TanStack Start (Leaflet usa window/document).
 */
export function DriverLiveMap({
  appointmentId,
  active,
}: {
  appointmentId: string;
  active: boolean;
}) {
  const position = useDriverLocationSubscription(appointmentId, active);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [ready, setReady] = useState(false);

  // Cria o mapa uma única vez, enquanto `active` estiver true.
  useEffect(() => {
    if (!active || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Ícone padrão do Leaflet quebra com bundlers (paths relativos ao CSS,
      // não ao build) — aponta pros assets já resolvidos pelo Vite acima.
      L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

      const map = L.map(containerRef.current).setView(FALLBACK_CENTER, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
    };
  }, [active]);

  // Move (ou cria) o marcador a cada nova posição recebida.
  useEffect(() => {
    if (!ready || !mapRef.current || !position) return;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      const latLng: [number, number] = [position.lat, position.lng];
      if (!markerRef.current) {
        markerRef.current = L.marker(latLng).addTo(mapRef.current);
        mapRef.current.setView(latLng, 16);
      } else {
        markerRef.current.setLatLng(latLng);
        mapRef.current.panTo(latLng);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [position, ready]);

  if (!active) return null;

  return (
    <div className="mt-2">
      <div
        ref={containerRef}
        className="h-48 w-full overflow-hidden rounded-xl border border-border"
      />
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        {position
          ? "Localização do motorista ao vivo"
          : "Aguardando o motorista compartilhar a localização..."}
      </p>
    </div>
  );
}
