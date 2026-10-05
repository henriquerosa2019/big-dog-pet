import { useState, useEffect } from "react";
import {
  Check,
  MessageSquare,
  PackageOpen,
  Sparkles,
  Star,
  ExternalLink,
  ShieldCheck,
  Building2,
  BarChart3,
  Bot,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMercadoPagoPlans, type SubscriptionPlanConfig } from "@/lib/mercadoPagoConfig";

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export function SubscriptionModal({
  open,
  onOpenChange,
  isExpired = false,
  isExpiringSoon = false,
}: SubscriptionModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(() => getMercadoPagoPlans());

  useEffect(() => {
    const handleUpdate = () => {
      setPlans(getMercadoPagoPlans());
    };
    window.addEventListener("bigdog_plans_updated", handleUpdate);
    return () => window.removeEventListener("bigdog_plans_updated", handleUpdate);
  }, []);

  const openMercadoPago = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-8 bg-card border-border shadow-2xl">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            <Building2 className="size-3.5" /> Aluguel de Software para Petshops & Clínicas
          </div>
          <DialogTitle className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
            {isExpired
              ? "O período de teste de 7 dias do sistema expirou"
              : isExpiringSoon
              ? "O período de teste do seu petshop expira amanhã!"
              : "Escolha o plano ideal para gerenciar seu Petshop ou Clínica"}
          </DialogTitle>
          <DialogDescription className="max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground mt-1.5">
            {isExpired
              ? "Para manter sua agenda de atendimentos, cadastro de clientes, táxi pet e relatórios ativos na sua loja, ative sua assinatura mensal via Mercado Pago com liberação imediata."
              : "Automatize agendamentos de banho, tosa, veterinária, controle de táxi pet e relatórios Curva ABC com o sistema mais completo do mercado."}
          </DialogDescription>
        </DialogHeader>

        {isExpired && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm font-semibold text-destructive flex items-center justify-center gap-2">
            <span>⚠️</span> O acesso ao painel de gestão da sua loja está pausado. Assine um dos planos para continuar gerenciando seus atendimentos!
          </div>
        )}

        <div className="mt-4 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isPopular = plan.popular;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl border p-5 sm:p-6 transition-all duration-300 ${
                  isPopular
                    ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-2 ring-primary/30"
                    : "border-border/80 bg-card hover:border-primary/40 hover:shadow-lg"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-1 text-[11px] font-black tracking-wide text-white uppercase shadow-md flex items-center gap-1">
                    <Sparkles className="size-3" /> Mais Recomendado
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {plan.name}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isPopular
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-foreground">
                      {plan.formattedPrice}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {plan.detail}
                  </p>

                  <div className="my-4 border-t border-border/60" />

                  <ul className="space-y-2.5 text-xs text-muted-foreground">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="size-4 shrink-0 text-primary mt-0.5" />
                        <span className={feature.includes("Curva ABC") || feature.includes("Canal Próprio") ? "font-bold text-foreground" : ""}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 space-y-2">
                  <Button
                    onClick={() => openMercadoPago(plan.mercadoPagoUrl)}
                    className={`w-full font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                      isPopular
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    }`}
                  >
                    <span>Contratar no Mercado Pago</span>
                    <ExternalLink className="size-3.5" />
                  </Button>

                  <div className="w-full text-center text-[11px] font-semibold text-muted-foreground flex items-center justify-center gap-1.5 py-1">
                    <MessageSquare className="size-3 text-primary" />
                    <span>Suporte via Canal Próprio no App</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground flex items-center gap-3">
          <ShieldCheck className="size-6 text-primary shrink-0" />
          <div>
            <strong className="text-foreground font-bold">Assinatura de Software Segura via Mercado Pago:</strong>{" "}
            Aceitamos Pix com liberação automática na hora, Cartão de Crédito em até 12x e Boleto Bancário. Após o pagamento, o sistema da sua petshop é liberado imediatamente.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
