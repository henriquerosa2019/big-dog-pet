export interface SubscriptionPlanConfig {
  id: "starter" | "pro" | "master_vip";
  name: string;
  badge: string;
  price: number; // em reais (ex: 97.00)
  formattedPrice: string;
  period: string; // "mês"
  detail: string;
  popular?: boolean;
  mercadoPagoUrl: string;
  features: string[];
  contactMessage: string;
}

const STORAGE_KEY = "bigdog_mercadopago_saas_plans_config_v2";

export const DEFAULT_PLANS: SubscriptionPlanConfig[] = [
  {
    id: "starter",
    name: "Plano Starter",
    badge: "Petshop Básico",
    price: 97.0,
    formattedPrice: "R$ 97,00",
    period: "mês",
    detail: "Ideal para petshops e profissionais de estética pet que desejam automatizar seus agendamentos.",
    popular: false,
    mercadoPagoUrl: "https://mpago.la/2r8B3ce",
    features: [
      "Agendamento online 24h para tutores",
      "Cadastro e histórico de clientes e pets",
      "Lembretes e avisos automáticos de retorno",
      "Painel administrativo com agenda visual",
      "Sem limite de pets cadastrados",
    ],
    contactMessage: "Olá! Gostaria de alugar o sistema no Plano Starter (R$ 97/mês) para o meu Petshop.",
  },
  {
    id: "pro",
    name: "Plano Pro",
    badge: "Mais Escolhido ⭐",
    price: 167.0,
    formattedPrice: "R$ 167,00",
    period: "mês",
    detail: "Sistema completo para estabelecimentos com atendimento veterinário e logística de transporte pet.",
    popular: true,
    mercadoPagoUrl: "https://mpago.la/25ZTwHu",
    features: [
      "Tudo do Plano Starter incluso",
      "Módulo Veterinário (prontuário clínico, vacinas e exames)",
      "Módulo Táxi Pet (gestão de rotas e rastreio de motoristas)",
      "Relatórios de faturamento, caixa e serviços mais lucrativos",
      "Painel Operacional com som de alerta de novos pedidos",
    ],
    contactMessage: "Olá! Gostaria de assinar o Plano Pro (R$ 167/mês) para a minha Clínica/Petshop.",
  },
  {
    id: "master_vip",
    name: "Plano Master VIP",
    badge: "Solução Completa 💎",
    price: 247.0,
    formattedPrice: "R$ 247,00",
    period: "mês",
    detail: "Para clínicas completas, hospitais e redes que precisam de estoque, relatórios avançados e canal próprio.",
    popular: false,
    mercadoPagoUrl: "https://mpago.la/1CdrLyf",
    features: [
      "Tudo do Plano Pro incluso",
      "Loja Online com controle de estoque e vendas",
      "Relatórios Curva ABC (melhores clientes e itens mais vendidos)",
      "Múltiplos atendentes com níveis de permissão",
      "Atendimento exclusivo via Canal Próprio integrado no app",
      "Personalização total com a marca da sua empresa (White-label)",
    ],
    contactMessage: "Olá! Gostaria de contratar o Plano Master VIP (R$ 247/mês) com Canal Próprio e Curva ABC.",
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
