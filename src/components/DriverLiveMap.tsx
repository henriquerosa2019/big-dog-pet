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

      const map = L.map(containerRef.current).setView(FALLBACK_CENTER, 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Ícone do Petshop (Loja)
      const shopIcon = L.divIcon({
        html: `<div style="background-color:#16a34a;color:white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:2px solid white;font-size:14px;">🏪</div>`,
        className: "custom-shop-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([-23.32185, -46.7262], { icon: shopIcon })
        .addTo(map)
        .bindPopup("<b>Big Dog Pet</b><br/>Loja 3 - Vila Bazú");

      // Ícone da Residência do Tutor
      const homeIcon = L.divIcon({
        html: `<div style="background-color:#ea580c;color:white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:2px solid white;font-size:14px;">🏠</div>`,
        className: "custom-home-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([-23.3315, -46.721], { icon: homeIcon })
        .addTo(map)
        .bindPopup("<b>Residência do Tutor</b><br/>Franco da Rocha");

      // Traçado da rota principal de entrega
      const waypoints: [number, number][] = [
        [-23.32185, -46.7262],
        [-23.3229, -46.7258],
        [-23.3242, -46.7252],
        [-23.3255, -46.7243],
        [-23.3268, -46.7234],
        [-23.3282, -46.7226],
        [-23.3298, -46.7218],
        [-23.3315, -46.721],
      ];
      L.polyline(waypoints, {
        color: "#2563eb",
        weight: 4,
        opacity: 0.65,
        dashArray: "6, 8",
      }).addTo(map);

      // Ajusta o enquadramento para caber tanto o petshop quanto a casa do tutor
      map.fitBounds([
        [-23.32185, -46.7262],
        [-23.3315, -46.721],
      ], { padding: [25, 25] });

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

      const carIcon = L.divIcon({
        html: `<div style="background-color:#2563eb;color:white;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:2.5px solid white;font-size:16px;animation:pulse 2s infinite;">🚗</div>`,
        className: "custom-car-pin",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (!markerRef.current) {
        markerRef.current = L.marker(latLng, { icon: carIcon }).addTo(mapRef.current);
        markerRef.current.bindPopup("<b>Motorista Big Dog Pet</b><br/>Em deslocamento ao vivo");
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
