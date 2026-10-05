export interface SubscriptionPlanConfig {
  id: "essencial" | "melhor_amigo" | "completo_vip";
  name: string;
  badge: string;
  price: number; // em reais (ex: 89.90)
  formattedPrice: string;
  period: string; // "mês"
  detail: string;
  popular?: boolean;
  mercadoPagoUrl: string;
  features: string[];
  whatsappMessage: string;
}

const STORAGE_KEY = "bigdog_mercadopago_plans_config";

export const DEFAULT_PLANS: SubscriptionPlanConfig[] = [
  {
    id: "essencial",
    name: "Plano Essencial",
    badge: "Rotina Básica",
    price: 89.9,
    formattedPrice: "R$ 89,90",
    period: "mês",
    detail: "Para manter a rotina de banho e higiene do seu pet sempre em dia.",
    popular: false,
    mercadoPagoUrl: "https://mpago.la/bigdog-essencial",
    features: [
      "Banhos regulares com produtos especiais",
      "Corte de unhas e limpeza auricular",
      "Lembretes e acompanhamento no WhatsApp",
      "Acesso completo a agendamentos online",
    ],
    whatsappMessage: "Olá! Gostaria de ativar meu *Plano Essencial* da Big Dog Pet.",
  },
  {
    id: "melhor_amigo",
    name: "Plano Melhor Amigo",
    badge: "Mais Popular ⭐",
    price: 149.9,
    formattedPrice: "R$ 149,90",
    period: "mês",
    detail: "O cuidado completo e contínuo que seu pet merece todos os meses com desconto.",
    popular: true,
    mercadoPagoUrl: "https://mpago.la/bigdog-melhor-amigo",
    features: [
      "Banho + Tosa higiênica e da raça",
      "Prioridade garantida nos agendamentos",
      "10% de desconto em toda a Loja Pet",
      "Check-up preventivo de pele e pelos",
      "Suporte exclusivo via WhatsApp",
    ],
    whatsappMessage: "Olá! Gostaria de assinar o *Plano Melhor Amigo* (Recomendado) da Big Dog Pet!",
  },
  {
    id: "completo_vip",
    name: "Plano Completo VIP",
    badge: "Cuidado VIP 💎",
    price: 229.9,
    formattedPrice: "R$ 229,90",
    period: "mês",
    detail: "Experiência premium completa com busca e entrega Táxi Pet inclusas.",
    popular: false,
    mercadoPagoUrl: "https://mpago.la/bigdog-vip",
    features: [
      "Pacote completo de banho, tosa e hidratação",
      "Táxi Pet Big Dog incluso (busca e entrega)",
      "Atendimento prioritário aos sábados",
      "15% de desconto em rações e produtos",
      "Kit de boas-vindas e brindes especiais",
    ],
    whatsappMessage: "Olá! Gostaria de assinar o *Plano Completo VIP* da Big Dog Pet com Táxi Pet incluso!",
  },
];

export function getMercadoPagoPlans(): SubscriptionPlanConfig[] {
  if (typeof window === "undefined") return DEFAULT_PLANS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLANS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error("Erro ao ler configuração do Mercado Pago:", err);
  }
  return DEFAULT_PLANS;
}

export function saveMercadoPagoPlans(plans: SubscriptionPlanConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    window.dispatchEvent(new Event("bigdog_plans_updated"));
  } catch (err) {
    console.error("Erro ao salvar planos do Mercado Pago:", err);
  }
}
