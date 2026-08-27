import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Loja Big Dog Pet | Ração, higiene e acessórios para pets" },
      {
        name: "description",
        content:
          "Compre ração, medicamentos, produtos de higiene e acessórios para cães e gatos na loja do Big Dog Pet, em Franco da Rocha.",
      },
      { property: "og:title", content: "Loja Big Dog Pet | Produtos para cães e gatos" },
      {
        property: "og:description",
        content: "Monte seu pedido e finalize pelo WhatsApp do Big Dog Pet.",
      },
    ],
  }),
  component: Loja,
});

const categories = [
  { value: "todos", label: "Todos" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "higiene", label: "Higiene" },
  { value: "medicamentos", label: "Medicamentos" },
  { value: "acessorios", label: "Acessórios" },
];

function Loja() {
  const [category, setCategory] = useState("todos");
  const [term, setTerm] = useState("");
  const { add } = useCart();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, category, price_cents, stock")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (products ?? []).filter(
    (p) =>
      (category === "todos" || p.category === category) &&
      p.name.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <div className="p-4">
      <h1 className="font-display text-2xl">Loja Big Dog Pet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Monte seu pedido e finalize pelo WhatsApp com a nossa equipe.
      </p>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value.slice(0, 60))}
          placeholder="Buscar produto"
          className="h-11 rounded-2xl pl-9"
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              category === c.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Carregando produtos...</p>}

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {filtered.map((product) => (
          <li
            key={product.id}
            className="flex flex-col rounded-2xl bg-card p-3 shadow-card"
          >
            <div className="grid h-20 place-items-center rounded-xl surface-paper font-display text-2xl text-primary">
              {product.name.charAt(0)}
            </div>
            <h2 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-tight">
              {product.name}
            </h2>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
              {product.description}
            </p>
            <p className="mt-2 font-display text-base text-primary">
              {formatBRL(product.price_cents)}
            </p>
            <Button
              size="sm"
              className="mt-2 h-9 rounded-xl"
              disabled={product.stock <= 0}
              onClick={() => {
                add({ id: product.id, name: product.name, priceCents: product.price_cents });
                toast.success("Adicionado ao carrinho");
              }}
            >
              <Plus className="h-4 w-4" />
              {product.stock <= 0 ? "Sem estoque" : "Adicionar"}
            </Button>
          </li>
        ))}
      </ul>

      {!isLoading && filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </p>
      )}
    </div>
  );
}
