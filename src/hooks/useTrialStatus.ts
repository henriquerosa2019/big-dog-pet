import { useEffect, useState, useCallback } from "react";
import { useAuth, useIsAdmin } from "./useAuth";

export interface TrialStatus {
  isTrialActive: boolean;
  isExpiringSoon: boolean; // 1 dia restante (D-1)
  isExpired: boolean;      // período expirou (D-0 / bloqueio)
  isBlocked: boolean;      // bloqueado pelo admin
  isSubscriber: boolean;   // plano pago ativo
  planName: string;
  daysRemaining: number;
  totalDays: number;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  isAdmin: boolean;
  simulateTrialStatus: (mode: "active" | "expiring" | "expired") => void;
  resetSimulation: () => void;
}

const TRIAL_DAYS = 7;
const SIMULATION_KEY = "bigdog_trial_simulation";
const MASTER_OVERRIDES_KEY = "bigdog_master_user_overrides";

export function useTrialStatus(): TrialStatus {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id, user?.email);

  const [simulation, setSimulation] = useState<"active" | "expiring" | "expired" | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SIMULATION_KEY);
      if (stored === "active" || stored === "expiring" || stored === "expired") {
        return stored;
      }
    }
    return null;
  });

  const [overridesVersion, setOverridesVersion] = useState(0);

  useEffect(() => {
    const handleStorageChange = () => {
      setOverridesVersion((v) => v + 1);
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("bigdog_overrides_updated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("bigdog_overrides_updated", handleStorageChange);
    };
  }, []);

  const simulateTrialStatus = useCallback((mode: "active" | "expiring" | "expired") => {
    setSimulation(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(SIMULATION_KEY, mode);
    }
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulation(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SIMULATION_KEY);
    }
  }, []);

  // 1. Admin Master (bigdog@gmail.com ou role admin)
  const isMasterUser = isAdmin || user?.email?.toLowerCase() === "bigdog@gmail.com";
  if (isMasterUser) {
    return {
      isTrialActive: true,
      isExpiringSoon: false,
      isExpired: false,
      isBlocked: false,
      isSubscriber: true,
      planName: "👑 MASTER",
      daysRemaining: 999,
      totalDays: TRIAL_DAYS,
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isAdmin: true,
      simulateTrialStatus,
      resetSimulation,
    };
  }

  // 2. Simulação explícita (para testes rápidos em tela)
  if (simulation) {
    if (simulation === "expired") {
      return {
        isTrialActive: false,
        isExpiringSoon: false,
        isExpired: true,
        isBlocked: false,
        isSubscriber: false,
        planName: "⏳ TESTE EXPIRADO",
        daysRemaining: 0,
        totalDays: TRIAL_DAYS,
        trialStartDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        isAdmin: false,
        simulateTrialStatus,
        resetSimulation,
      };
    }
    if (simulation === "expiring") {
      return {
        isTrialActive: true,
        isExpiringSoon: true,
        isExpired: false,
        isBlocked: false,
        isSubscriber: false,
        planName: "⏳ TESTE (EXPIRA AMANHÃ)",
        daysRemaining: 1,
        totalDays: TRIAL_DAYS,
        trialStartDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        trialEndDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        isAdmin: false,
        simulateTrialStatus,
        resetSimulation,
      };
    }
    return {
      isTrialActive: true,
      isExpiringSoon: false,
      isExpired: false,
      isBlocked: false,
      isSubscriber: false,
      planName: "⏳ TESTE 7 DIAS",
      daysRemaining: 5,
      totalDays: TRIAL_DAYS,
      trialStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      isAdmin: false,
      simulateTrialStatus,
      resetSimulation,
    };
  }

  // 3. Checagem de overrides do Painel Master
  let userOverride: any = null;
  if (typeof window !== "undefined" && user?.email) {
    try {
      const all = JSON.parse(localStorage.getItem(MASTER_OVERRIDES_KEY) || "{}");
      userOverride = all[user.email.toLowerCase().trim()];
    } catch (e) {}
  }

  const isBlocked = userOverride?.status === "bloqueado";
  const overridePlan = userOverride?.plano;

  if (overridePlan && overridePlan !== "trial") {
    // É assinante ativo!
    const planDisplayNames: Record<string, string> = {
      vitalicio: "⚡ VITALÍCIO",
      starter: "⚡ PLANO STARTER (R$ 97)",
      pro: "⭐ PLANO PRO (R$ 167)",
      master_vip: "💎 PLANO MASTER VIP (R$ 247)",
      essencial: "⚡ PLANO STARTER",
      melhor_amigo: "⭐ PLANO PRO",
      completo_vip: "💎 PLANO MASTER VIP",
    };
    return {
      isTrialActive: true,
      isExpiringSoon: false,
      isExpired: false,
      isBlocked,
      isSubscriber: true,
      planName: planDisplayNames[overridePlan] || "⚡ ASSINANTE ATIVO",
      daysRemaining: 30,
      totalDays: 30,
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isAdmin: false,
      simulateTrialStatus,
      resetSimulation,
    };
  }

  // 4. Período de Teste Real (7 dias)
  const userCreatedAt = user?.created_at;
  const trialStart = userOverride?.trial_start
    ? new Date(userOverride.trial_start)
    : userCreatedAt
    ? new Date(userCreatedAt)
    : new Date();

  const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const isExpired = !!user && (daysRemaining <= 0 || diffMs <= 0);
  const isExpiringSoon = !!user && !isExpired && daysRemaining <= 1;
  const isTrialActive = !!user && !isExpired;

  return {
    isTrialActive,
    isExpiringSoon,
    isExpired,
    isBlocked,
    isSubscriber: false,
    planName: isExpired ? "⏳ TESTE EXPIRADO" : "⏳ TESTE 7 DIAS",
    daysRemaining: user ? daysRemaining : TRIAL_DAYS,
    totalDays: TRIAL_DAYS,
    trialStartDate: trialStart,
    trialEndDate: trialEnd,
    isAdmin: false,
    simulateTrialStatus,
    resetSimulation,
  };
}
