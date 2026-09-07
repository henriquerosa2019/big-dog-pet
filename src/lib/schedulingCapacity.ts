/**
 * Módulo de Crítica e Controle de Capacidade de Agendamentos por Hora
 * Big Dog Pet - Franco da Rocha
 * 
 * Regra: Não permitir mais de N agendamentos simultâneos na mesma hora (configurável no Admin).
 * Quando a capacidade for atingida, o horário fica em vermelho (esgotado),
 * sugere o próximo horário disponível e permite abertura de exceção/encaixe.
 */

export interface CapacitySettings {
  maxBanhosPerHour: number; // Padrão: 3 banhos simultâneos/hora
  maxTosasPerHour: number;  // Padrão: 2 tosas simultâneas/hora
  maxGeralPerHour: number;  // Padrão: 3 consultas/outros por hora
}

export const DEFAULT_CAPACITY_SETTINGS: CapacitySettings = {
  maxBanhosPerHour: 3,
  maxTosasPerHour: 2,
  maxGeralPerHour: 3,
};

const STORAGE_KEY = "bigdog_scheduling_capacity_v1";

/**
 * Obtém a configuração de capacidade ativa (com fallback para padrões).
 */
export function getCapacitySettings(): CapacitySettings {
  if (typeof window === "undefined") return DEFAULT_CAPACITY_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAPACITY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      maxBanhosPerHour: Math.max(1, Number(parsed.maxBanhosPerHour) || DEFAULT_CAPACITY_SETTINGS.maxBanhosPerHour),
      maxTosasPerHour: Math.max(1, Number(parsed.maxTosasPerHour) || DEFAULT_CAPACITY_SETTINGS.maxTosasPerHour),
      maxGeralPerHour: Math.max(1, Number(parsed.maxGeralPerHour) || DEFAULT_CAPACITY_SETTINGS.maxGeralPerHour),
    };
  } catch {
    return DEFAULT_CAPACITY_SETTINGS;
  }
}

/**
 * Salva as configurações de capacidade pelo Painel Admin.
 */
export function saveCapacitySettings(settings: Partial<CapacitySettings>): CapacitySettings {
  const current = getCapacitySettings();
  const updated: CapacitySettings = {
    maxBanhosPerHour: Math.max(1, settings.maxBanhosPerHour ?? current.maxBanhosPerHour),
    maxTosasPerHour: Math.max(1, settings.maxTosasPerHour ?? current.maxTosasPerHour),
    maxGeralPerHour: Math.max(1, settings.maxGeralPerHour ?? current.maxGeralPerHour),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Dispara evento para sincronizar abas ativas em tempo real
    window.dispatchEvent(new CustomEvent("bigdog_capacity_updated", { detail: updated }));
  }

  return updated;
}

/**
 * Retorna o limite máximo de vagas para a categoria informada.
 */
export function getMaxCapacityForCategory(category: string, settings: CapacitySettings): number {
  const cat = (category || "").toLowerCase();
  if (cat === "banho") return settings.maxBanhosPerHour;
  if (cat === "tosa") return settings.maxTosasPerHour;
  return settings.maxGeralPerHour;
}

export interface AppointmentSlotItem {
  id: string;
  scheduled_at: string;
  status: string;
  services?: { category?: string | null } | null;
}

export interface SlotCapacityInfo {
  hour: string;
  isPast: boolean;
  currentCount: number;
  maxAllowed: number;
  isAtCapacity: boolean;
  remainingSlots: number;
  status: "available" | "exhausted" | "past";
}

/**
 * Verifica se um horário específico na data informada já passou.
 */
export function isPastSlot(date: string, hour: string): boolean {
  return new Date(`${date}T${hour}:00`).getTime() < Date.now();
}

/**
 * Conta quantos agendamentos existem em um determinado horário e data para a categoria dada.
 */
export function countAppointmentsInHour(
  dayAppointments: AppointmentSlotItem[] | undefined | null,
  date: string,
  hour: string,
  category: string
): number {
  if (!dayAppointments || dayAppointments.length === 0) return 0;

  const targetHourPrefix = `${date}T${hour}`;
  const targetCategory = (category || "").toLowerCase();

  return dayAppointments.filter((item) => {
    if (item.status === "cancelado") return false;
    if (!item.scheduled_at) return false;

    // Converte scheduled_at para checar se cai no mesmo dia e mesma hora
    const apptDate = new Date(item.scheduled_at);
    if (Number.isNaN(apptDate.getTime())) return false;

    // Formata YYYY-MM-DD e HH:MM locais
    const apptYear = apptDate.getFullYear();
    const apptMonth = String(apptDate.getMonth() + 1).padStart(2, "0");
    const apptDay = String(apptDate.getDate()).padStart(2, "0");
    const apptHour = String(apptDate.getHours()).padStart(2, "0");
    const apptDateStr = `${apptYear}-${apptMonth}-${apptDay}`;

    if (apptDateStr !== date) return false;

    const selectedHourNum = hour.split(":")[0];
    if (apptHour !== selectedHourNum) return false;

    // Se for categoria específica, filtra pela categoria do serviço
    if (targetCategory) {
      const itemCat = (item.services?.category || "").toLowerCase();
      if (itemCat && itemCat !== targetCategory) {
        return false;
      }
    }

    return true;
  }).length;
}

/**
 * Analisa a capacidade de um horário individual.
 */
export function evaluateSlotCapacity(
  hour: string,
  date: string,
  category: string,
  dayAppointments: AppointmentSlotItem[] | undefined | null,
  settings: CapacitySettings
): SlotCapacityInfo {
  const isPast = isPastSlot(date, hour);
  const maxAllowed = getMaxCapacityForCategory(category, settings);
  const currentCount = countAppointmentsInHour(dayAppointments, date, hour, category);
  const isAtCapacity = currentCount >= maxAllowed;
  const remainingSlots = Math.max(0, maxAllowed - currentCount);

  let status: "available" | "exhausted" | "past" = "available";
  if (isPast) {
    status = "past";
  } else if (isAtCapacity) {
    status = "exhausted";
  }

  return {
    hour,
    isPast,
    currentCount,
    maxAllowed,
    isAtCapacity,
    remainingSlots,
    status,
  };
}

/**
 * Encontra o próximo horário disponível posterior ao horário atual esgotado.
 */
export function findNextAvailableSlot(
  currentHour: string,
  date: string,
  category: string,
  allHours: string[],
  dayAppointments: AppointmentSlotItem[] | undefined | null,
  settings: CapacitySettings
): string | null {
  const currentIndex = allHours.indexOf(currentHour);
  if (currentIndex === -1) return null;

  for (let i = currentIndex + 1; i < allHours.length; i++) {
    const nextHour = allHours[i]!;
    if (isPastSlot(date, nextHour)) continue;

    const maxAllowed = getMaxCapacityForCategory(category, settings);
    const count = countAppointmentsInHour(dayAppointments, date, nextHour, category);
    if (count < maxAllowed) {
      return nextHour;
    }
  }

  return null;
}
