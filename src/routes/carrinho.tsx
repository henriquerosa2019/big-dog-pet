import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Gift, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import { CLINIC, formatBRL, whatsappLink } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  async function handleCheckout() {
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados");
      return;
    }
    if (items.length === 0) return;
    setSending(true);
    try {
      if (user) {
        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            total_cents: totalCents,
            customer_name: parsed.data.name,
            phone: parsed.data.phone,
            notes: [
              parsed.data.notes,
              birthdayCoupon ? `Cupom de aniversário: ${birthdayCoupon} (20% de desconto)` : "",
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
      const message = [
        `Olá, ${CLINIC.name}! Quero fazer um pedido:`,
        lines,
        `Total: ${formatBRL(totalCents)}`,
        `Nome: ${parsed.data.name}`,
        `Telefone: ${parsed.data.phone}`,
        birthdayCoupon ? `Cupom de aniversário: ${birthdayCoupon} (20% de desconto)` : "",
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
            Cupom <span className="font-mono font-bold text-gold">{birthdayCoupon}</span> — 20% de
            desconto de aniversário. A equipe confirma o valor com desconto pelo WhatsApp.
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

      <div className="mt-5 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-xl text-primary">{formatBRL(totalCents)}</span>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="name">Seu nome</Label>
            <Input
              id="name"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              inputMode="tel"
              value={form.phone}
              maxLength={20}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
