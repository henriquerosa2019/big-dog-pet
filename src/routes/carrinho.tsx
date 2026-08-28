import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import {
  BIRTHDAY_DISCOUNT_PERCENT,
  capitalizeWords,
  CLINIC,
  formatBRL,
  maskPhoneBR,
  whatsappLink,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho | Loja Big Dog Pet" },
      {
        name: "description",
        content:
          "Revise os produtos escolhidos e finalize o pedido pelo WhatsApp do Big Dog Pet.",
      },
      { property: "og:title", content: "Carrinho | Loja Big Dog Pet" },
      { property: "og:description", content: "Finalize seu pedido pelo WhatsApp do Big Dog Pet." },
    ],
  }),
  component: Carrinho,
});

type DeliveryMethod = "retirar_na_loja" | "receber_em_casa";

const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  retirar_na_loja: "Retirar na loja",
  receber_em_casa: "Receber em casa",
};

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido")
    .max(20)
    .regex(/^[0-9()\-\s+]+$/, "Use apenas números e símbolos de telefone"),
  notes: z.string().trim().max(500).optional(),
});

function Carrinho() {
  const { items, totalCents, setQuantity, remove, clear, birthdayCoupon } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("retirar_na_loja");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const { data: addresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, label, street, number, district, is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price_cents, category")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const cartIds = new Set(items.map((i) => i.id));
  const crossSell = (products ?? []).filter((p) => !cartIds.has(p.id)).slice(0, 6);

  const selectedAddress = (addresses ?? []).find((a) => a.id === addressId) ?? null;

  async function handleCheckout() {
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados");
      return;
    }
    if (items.length === 0) return;
    if (deliveryMethod === "receber_em_casa" && user && !addressId) {
      toast.error("Escolha um endereço para entrega");
      return;
    }
    if (deliveryMethod === "receber_em_casa" && !user && !manualAddress.trim()) {
      toast.error("Informe o endereço para entrega");
      return;
    }
    setSending(true);
    try {
      const trimmedCoupon = couponCode.trim().toUpperCase() || null;
      if (user) {
        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            total_cents: totalCents,
            customer_name: parsed.data.name,
            phone: parsed.data.phone,
            delivery_method: deliveryMethod,
            address_id: deliveryMethod === "receber_em_casa" ? addressId : null,
            coupon_code: trimmedCoupon,
            notes: [
              parsed.data.notes,
              birthdayCoupon
                ? `Cupom de aniversário: ${birthdayCoupon} (${BIRTHDAY_DISCOUNT_PERCENT}% de desconto)`
                : "",
            ]
              .filter(Boolean)
              .join(" — ") || null,
          })
          .select("id")
          .single();
        if (error) throw error;

        const { error: itemsError } = await supabase.from("order_items").insert(
          items.map((item) => ({
            order_id: order.id,
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price_cents: item.priceCents,
          })),
        );
        if (itemsError) throw itemsError;
      }

      const lines = items
        .map((i) => `• ${i.quantity}x ${i.name} — ${formatBRL(i.priceCents * i.quantity)}`)
        .join("\n");
      const deliveryLine =
        deliveryMethod === "receber_em_casa"
          ? `\nEntrega: Receber em casa — ${
              user && selectedAddress
                ? `${selectedAddress.street}${selectedAddress.number ? `, ${selectedAddress.number}` : ""} - ${selectedAddress.district}`
                : manualAddress.trim()
            }`
          : `\nEntrega: Retirar na loja (${CLINIC.unit})`;
      const message = [
        `Olá, ${CLINIC.name}! Quero fazer um pedido:`,
        lines,
        `Total: ${formatBRL(totalCents)}`,
        `Nome: ${parsed.data.name}`,
        `Telefone: ${parsed.data.phone}`,
        deliveryLine,
        trimmedCoupon ? `Cupom informado: ${trimmedCoupon}` : "",
        birthdayCoupon
          ? `Cupom de aniversário: ${birthdayCoupon} (${BIRTHDAY_DISCOUNT_PERCENT}% de desconto)`
          : "",
        parsed.data.notes ? `Observações: ${parsed.data.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      window.open(whatsappLink(message), "_blank", "noopener,noreferrer");
      clear();
      toast.success("Pedido enviado! Continue a conversa no WhatsApp.");
      if (user) navigate({ to: "/conta" });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível registrar o pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <h1 className="font-display text-2xl">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore a loja e adicione produtos para o seu pet.
        </p>
        <Button asChild className="mt-6 h-11 rounded-2xl">
          <Link to="/loja">Ver produtos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl">Carrinho</h1>

      {birthdayCoupon && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-gold/50 bg-secondary p-3">
          <Gift className="h-4 w-4 shrink-0 text-gold" />
          <p className="text-xs text-muted-foreground">
            Cupom <span className="font-mono font-bold text-gold">{birthdayCoupon}</span> —{" "}
            {BIRTHDAY_DISCOUNT_PERCENT}% de desconto de aniversário. A equipe confirma o valor com
            desconto pelo WhatsApp.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight">{item.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatBRL(item.priceCents)} cada
                </p>
              </div>
              <button
                onClick={() => remove(item.id)}
                aria-label={`Remover ${item.name}`}
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(item.id, item.quantity - 1)}
                  aria-label="Diminuir quantidade"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-secondary-foreground"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                <button
                  onClick={() => setQuantity(item.id, item.quantity + 1)}
                  aria-label="Aumentar quantidade"
                  className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-secondary-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="font-display text-base text-primary">
                {formatBRL(item.priceCents * item.quantity)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {crossSell.length > 0 && (
        <section className="mt-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-gold" />
            Aproveite e leve também
          </h2>
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {crossSell.map((product) => (
              <div
                key={product.id}
                className="w-36 shrink-0 rounded-2xl bg-card p-3 shadow-card"
              >
                <p className="line-clamp-2 text-xs font-semibold leading-tight">{product.name}</p>
                <p className="mt-1 text-xs text-primary">{formatBRL(product.price_cents)}</p>
                <Link
                  to="/loja"
                  className="mt-2 block rounded-lg bg-secondary py-1.5 text-center text-[11px] font-semibold text-secondary-foreground"
                >
                  Ver na loja
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 rounded-2xl bg-card p-4 shadow-card">
        <div className="space-y-1 border-b border-border pb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {items.reduce((sum, i) => sum + i.quantity, 0)}{" "}
              {items.reduce((sum, i) => sum + i.quantity, 0) === 1 ? "item" : "itens"}
            </span>
            <span>Subtotal: {formatBRL(totalCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="font-display text-xl text-primary">{formatBRL(totalCents)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Entrega
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(deliveryMethodLabels) as DeliveryMethod[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryMethod(value)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold",
                    deliveryMethod === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {deliveryMethodLabels[value]}
                </button>
              ))}
            </div>

            {deliveryMethod === "receber_em_casa" && (
              <div className="mt-2">
                {user ? (
                  (addresses ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(addresses ?? []).map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setAddressId(address.id)}
                          className={cn(
                            "rounded-xl px-3 py-2 text-left text-xs font-semibold",
                            addressId === address.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {address.label}: {address.street}
                          {address.number ? `, ${address.number}` : ""} — {address.district}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Você ainda não tem endereço cadastrado.{" "}
                      <Link to="/agendar" className="underline">
                        Cadastre um endereço
                      </Link>{" "}
                      ou informe abaixo nas observações.
                    </p>
                  )
                ) : (
                  <Textarea
                    placeholder="Rua, número, bairro — endereço para entrega"
                    value={manualAddress}
                    maxLength={200}
                    onChange={(e) => setManualAddress(e.target.value)}
                    className="rounded-xl text-sm"
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="coupon">Cupom de desconto (opcional)</Label>
            <Input
              id="coupon"
              placeholder="Código do cupom"
              value={couponCode}
              maxLength={30}
              onChange={(e) => setCouponCode(e.target.value)}
              className="mt-1 h-11 rounded-xl uppercase"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              A equipe confere e aplica o desconto ao confirmar pelo WhatsApp.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dados para contato
            </p>
          </div>
          <div>
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: capitalizeWords(e.target.value) })}
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              inputMode="tel"
              value={form.phone}
              maxLength={16}
              onChange={(e) => setForm({ ...form, phone: maskPhoneBR(e.target.value) })}
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              maxLength={500}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 rounded-xl"
            />
          </div>
        </div>

        <Button
          onClick={handleCheckout}
          disabled={sending}
          className="mt-4 h-12 w-full rounded-2xl"
        >
          {sending ? "Enviando..." : "Finalizar pelo WhatsApp"}
        </Button>
        {!user && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="underline">
              Entre na sua conta
            </Link>{" "}
            para guardar o histórico dos seus pedidos.
          </p>
        )}
      </div>
    </div>
  );
}
