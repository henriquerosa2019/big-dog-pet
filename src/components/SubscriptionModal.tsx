import { useState, useEffect } from "react";
import { Check, MessageCircle, PackageOpen, Sparkles, Star, ExternalLink, ShieldCheck } from "lucide-react";
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

  const openWhatsApp = (msg: string) => {
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/5511993793746?text=${encoded}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-8 bg-card border-border shadow-2xl">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            <PackageOpen className="size-3.5" /> Planos Oficiais Big Dog Pet
          </div>
          <DialogTitle className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
            {isExpired
              ? "Seu período de teste grátis de 7 dias expirou"
              : isExpiringSoon
              ? "Seu teste grátis expira amanhã!"
              : "Escolha o melhor plano para o seu pet"}
          </DialogTitle>
          <DialogDescription className="max-w-xl mx-auto text-sm sm:text-base text-muted-foreground mt-1.5">
            {isExpired
              ? "Para continuar aproveitando agendamentos de banho, tosa, veterinária e comodidades exclusivas, ative sua assinatura via Mercado Pago com Pix ou Cartão."
              : "Mantenha a saúde, beleza e bem-estar do seu amigo o mês inteiro com vantagens exclusivas e atendimento prioritário."}
          </DialogDescription>
        </DialogHeader>

        {isExpired && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm font-semibold text-destructive flex items-center justify-center gap-2">
            <span>⚠️</span> O acesso aos novos agendamentos está pausado. Efetue o pagamento de um plano para continuar usando o app!
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
                    <Sparkles className="size-3" /> Mais Escolhido
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
                        <span>{feature}</span>
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
                    <span>Pagar com Mercado Pago</span>
                    <ExternalLink className="size-3.5" />
                  </Button>

                  <button
                    type="button"
                    onClick={() => openWhatsApp(plan.whatsappMessage)}
                    className="w-full text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-1 transition-colors"
                  >
                    <MessageCircle className="size-3 text-[#25D366]" />
                    <span>Dúvidas? Fale no WhatsApp</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground flex items-center gap-3">
          <ShieldCheck className="size-6 text-primary shrink-0" />
          <div>
            <strong className="text-foreground font-bold">Pagamento 100% Seguro via Mercado Pago:</strong>{" "}
            Aceitamos Pix com liberação imediata, Cartão de Crédito e Boleto. Após o pagamento, seu plano é ativado automaticamente.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
