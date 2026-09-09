/**
 * Gerenciador de Motoristas - Big Dog Pet
 * Unifica motoristas do banco de dados (user_roles e profiles) com
 * cadastro dinâmico pelo Admin e persistência local sincronizada.
 */

import type { VehicleType } from "./transport";

export interface ManagedDriver {
  id: string;
  full_name: string;
  phone: string | null;
  email?: string | null;
  vehicle_type: VehicleType;
  is_custom?: boolean;
}

const STORAGE_KEY = "bigdog_registered_drivers_v1";

export const DEFAULT_BUILTIN_DRIVERS: ManagedDriver[] = [
  {
    id: "33333333-3333-3333-3333-333333333333",
    full_name: "João (Motorista)",
    phone: "(11) 99999-9999",
    email: "motorista@teste.com",
    vehicle_type: "carro",
  },
  {
    id: "0ef2ce12-a04a-4736-9217-6c0deddb459b",
    full_name: "Delivery Express",
    phone: "(21) 99379-3779",
    email: "delivery@bigdog.com",
    vehicle_type: "moto",
  },
  {
    id: "329e8c3c-f55a-4113-9641-fce1f6e0d25c",
    full_name: "Equipe Big Dog (Loja)",
    phone: "(21) 99379-3746",
    email: "bigdog@gmail.com",
    vehicle_type: "carro",
  },
];

/**
 * Obtém a lista de motoristas cadastrados localmente/dinamicamente.
 */
export function getCustomDrivers(): ManagedDriver[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salva a lista de motoristas customizados no localStorage e notifica ouvintes.
 */
function saveCustomDrivers(drivers: ManagedDriver[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
    window.dispatchEvent(new CustomEvent("bigdog_drivers_updated", { detail: drivers }));
  }
}

/**
 * Combina motoristas do banco de dados, padrões do sistema e cadastrados pelo admin.
 */
export function getAllManagedDrivers(dbDrivers?: {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  vehicle_type?: string | null;
}[]): ManagedDriver[] {
  const map = new Map<string, ManagedDriver>();

  // 1. Carrega os padrões
  for (const def of DEFAULT_BUILTIN_DRIVERS) {
    map.set(def.id, { ...def });
  }

  // 2. Carrega do banco de dados (se houver)
  if (dbDrivers) {
    for (const d of dbDrivers) {
      const existing = map.get(d.id);
      map.set(d.id, {
        id: d.id,
        full_name: d.full_name || existing?.full_name || "Motorista",
        phone: d.phone || existing?.phone || null,
        vehicle_type: (d.vehicle_type === "moto" ? "moto" : "carro") as VehicleType,
        email: existing?.email,
      });
    }
  }

  // 3. Mescla motoristas customizados adicionados pelo admin
  const customs = getCustomDrivers();
  for (const c of customs) {
    map.set(c.id, { ...c, is_custom: true });
  }

  return Array.from(map.values());
}

/**
 * Adiciona um novo motorista pelo Painel Admin.
 */
export function registerNewDriver(driver: {
  name: string;
  phone?: string | null;
  email?: string | null;
  vehicleType: VehicleType;
  existingUserId?: string | null;
}): ManagedDriver {
  const customs = getCustomDrivers();
  const id = driver.existingUserId || `custom-driver-${Date.now()}`;
  
  const newDriver: ManagedDriver = {
    id,
    full_name: driver.name.trim(),
    phone: driver.phone?.trim() || null,
    email: driver.email?.trim().toLowerCase() || null,
    vehicle_type: driver.vehicleType,
    is_custom: true,
  };

  const filtered = customs.filter((d) => d.id !== id);
  filtered.push(newDriver);
  saveCustomDrivers(filtered);

  return newDriver;
}

/**
 * Atualiza o tipo de veículo ou dados de um motorista.
 */
export function updateManagedDriver(
  driverId: string,
  updates: Partial<Pick<ManagedDriver, "vehicle_type" | "full_name" | "phone" | "email">>,
): void {
  const customs = getCustomDrivers();
  const existingIdx = customs.findIndex((d) => d.id === driverId);

  if (existingIdx >= 0) {
    customs[existingIdx] = { ...customs[existingIdx], ...updates };
    saveCustomDrivers(customs);
  } else {
    // Se for padrão ou do banco mas atualizado no frontend
    const all = getAllManagedDrivers();
    const found = all.find((d) => d.id === driverId);
    if (found) {
      customs.push({
        ...found,
        ...updates,
        is_custom: true,
      });
      saveCustomDrivers(customs);
    }
  }
}

/**
 * Remove ou desativa um motorista customizado.
 */
export function removeManagedDriver(driverId: string): void {
  const customs = getCustomDrivers();
  const filtered = customs.filter((d) => d.id !== driverId);
  saveCustomDrivers(filtered);
}

/**
 * Verifica se um determinado ID ou email pertence a um motorista cadastrado.
 */
export function isRegisteredDriverUser(userId?: string | null, userEmail?: string | null): boolean {
  if (!userId && !userEmail) return false;
  const emailNorm = userEmail?.toLowerCase();
  
  // Padrões do sistema e admin sempre autorizados
  if (emailNorm === "bigdog@gmail.com" || emailNorm === "motorista@teste.com" || emailNorm === "delivery@bigdog.com") {
    return true;
  }
  if (userId === "33333333-3333-3333-3333-333333333333" || userId === "0ef2ce12-a04a-4736-9217-6c0deddb459b" || userId === "329e8c3c-f55a-4113-9641-fce1f6e0d25c") {
    return true;
  }

  const all = getAllManagedDrivers();
  return all.some((d) => d.id === userId || (emailNorm && d.email && d.email.toLowerCase() === emailNorm));
}
