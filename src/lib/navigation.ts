/**
 * Utilitários de navegação externa (Waze, Google Maps) e manipulação de endereços/CEP.
 */

export interface AddressInfo {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  reference?: string | null;
}

export interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

/**
 * Formata um objeto de endereço para uma string completa compreendida
 * perfeitamente por apps de GPS (Waze, Google Maps).
 * Ex: "Rua Nelson Rodrigues, 120 - Centro, Franco da Rocha - SP"
 */
export function formatFullAddress(addr: AddressInfo): string {
  const parts: string[] = [];

  if (addr.street) {
    let streetPart = addr.street.trim();
    if (addr.number && addr.number.trim()) {
      streetPart += `, ${addr.number.trim()}`;
    }
    if (addr.complement && addr.complement.trim()) {
      streetPart += ` - ${addr.complement.trim()}`;
    }
    parts.push(streetPart);
  }

  if (addr.district && addr.district.trim()) {
    parts.push(addr.district.trim());
  }

  const city = addr.city?.trim() || "Franco da Rocha";
  const state = addr.state?.trim() || "SP";
  parts.push(`${city} - ${state}`);

  return parts.join(", ");
}

/**
 * Gera URL universal para navegação no Waze com 1 toque.
 * No celular, abre o app do Waze com rota já traçada. No desktop, abre a interface web.
 */
export function getWazeUrl(addressOrQuery: string): string {
  const encoded = encodeURIComponent(addressOrQuery.trim());
  return `https://waze.com/ul?q=${encoded}&navigate=yes`;
}

/**
 * Gera URL para navegação no Google Maps com 1 toque.
 * Abre o app Google Maps ou página de rota com destino configurado.
 */
export function getGoogleMapsUrl(addressOrQuery: string): string {
  const encoded = encodeURIComponent(addressOrQuery.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

/**
 * Formata máscara de CEP brasileiro (00000-000).
 */
export function maskCep(val: string): string {
  const clean = val.replace(/\D/g, "").slice(0, 8);
  if (clean.length > 5) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

/**
 * Consulta CEP na API pública do ViaCEP para preenchimento automático.
 */
export async function fetchAddressByCep(cep: string): Promise<ViaCepResponse | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}
