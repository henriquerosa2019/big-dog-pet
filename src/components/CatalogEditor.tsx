import { useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Search, Sparkles, Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { searchProductImages } from "@/lib/productImageSuggestions";

/**
 * Formulário único de catálogo, usado tanto pra criar quanto pra editar um
 * serviço ou um produto. Os dois compartilham nome, descrição, categoria, preço
 * e ativo; o que muda é o campo próprio de cada um — duração (serviço) e
 * estoque (produto).
 */

export type CatalogKind = "services" | "products";

export type CatalogValues = {
  name: string;
  description: string;
  category: string;
  priceCents: number;
  /** Só serviços. */
  durationMin: number;
  /** Só produtos. */
  stock: number;
  criticalStock?: number | undefined;
  imageUrl?: string | undefined;
  active: boolean;
};

export function emptyCatalogValues(kind: CatalogKind): CatalogValues {
  return {
    name: "",
    description: "",
    category: kind === "services" ? "banho" : "geral",
    priceCents: 0,
    durationMin: 30,
    stock: 0,
    criticalStock: 5,
    imageUrl: "",
    active: true,
  };
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return null;
  return Math.round(parsed * 100);
}

function parseInteger(value: string, min: number): number | null {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < min) return null;
  return parsed;
}

export function CatalogForm({
  kind,
  initial,
  categories,
  submitLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  kind: CatalogKind;
  initial: CatalogValues;
  /** Categorias já usadas, oferecidas como sugestão sem travar valores novos. */
  categories: string[];
  submitLabel: string;
  isPending: boolean;
  onSubmit: (values: CatalogValues) => void;
  onCancel: () => void;
}) {
  const isService = kind === "services";
  const listId = `catalog-categorias-${kind}`;

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [price, setPrice] = useState(centsToInput(initial.priceCents));
  const [durationMin, setDurationMin] = useState(String(initial.durationMin));
  const [stock, setStock] = useState(String(initial.stock));
  const [criticalStock, setCriticalStockInput] = useState(String(initial.criticalStock ?? 5));
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [showImageSuggestions, setShowImageSuggestions] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState(initial.name);
  const [active, setActive] = useState(initial.active);

  function handleSubmit() {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast.error(isService ? "Informe o nome do serviço" : "Informe o nome do produto");
      return;
    }
    const trimmedCategory = category.trim().toLowerCase();
    if (trimmedCategory.length < 2) {
      toast.error("Informe a categoria");
      return;
    }
    const priceCents = parsePrice(price);
    if (priceCents === null) {
      toast.error("Preço inválido");
      return;
    }
    const parsedDuration = isService ? parseInteger(durationMin, 5) : initial.durationMin;
    if (parsedDuration === null) {
      toast.error("Duração inválida — informe os minutos (mínimo 5)");
      return;
    }
    const parsedStock = isService ? initial.stock : parseInteger(stock, 0);
    if (parsedStock === null) {
      toast.error("Estoque inválido — informe um número inteiro");
      return;
    }
    const parsedCriticalStock = isService ? undefined : (parseInteger(criticalStock, 0) ?? 5);

    onSubmit({
      name: trimmedName,
      description: description.trim(),
      category: trimmedCategory,
      priceCents,
      durationMin: parsedDuration,
      stock: parsedStock,
      criticalStock: parsedCriticalStock,
      imageUrl: isService ? undefined : (imageUrl.trim() || undefined),
      active,
    });
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl surface-paper p-3">
      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div>
        <Label htmlFor={`${listId}-nome`}>Nome</Label>
        <Input
          id={`${listId}-nome`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isService ? "Banho + Tosa Higiênica" : "Ração Premium 3kg"}
          className="mt-1 h-10 rounded-xl"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${listId}-categoria`}>Categoria</Label>
          <Input
            id={`${listId}-categoria`}
            list={listId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={isService ? "banho" : "higiene"}
            className="mt-1 h-10 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor={`${listId}-preco`}>Preço (R$)</Label>
          <Input
            id={`${listId}-preco`}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 h-10 rounded-xl"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isService ? (
          <div>
            <Label htmlFor={`${listId}-duracao`}>Duração (minutos)</Label>
            <Input
              id={`${listId}-duracao`}
              inputMode="numeric"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="mt-1 h-10 rounded-xl"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`${listId}-estoque`}>Estoque Atual</Label>
              <Input
                id={`${listId}-estoque`}
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor={`${listId}-estoque-critico`}>Estoque Crítico (Curva A)</Label>
              <Input
                id={`${listId}-estoque-critico`}
                inputMode="numeric"
                value={criticalStock}
                onChange={(e) => setCriticalStockInput(e.target.value)}
                placeholder="Mín. 5"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>
        )}
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-full rounded-xl"
            onClick={() => setActive((v) => !v)}
          >
            {active ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor={`${listId}-descricao`}>Descrição (opcional)</Label>
        <Textarea
          id={`${listId}-descricao`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 rounded-xl"
        />
      </div>

      {!isService && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-3 border border-border/50">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`${listId}-imagem`} className="flex items-center gap-1.5 text-xs font-semibold">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Foto do Produto (Web / URL)
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 rounded-lg text-primary border-primary/30 hover:bg-primary/10"
              onClick={() => {
                setWebSearchQuery(name || category || "pet");
                setShowImageSuggestions((v) => !v);
              }}
            >
              <Globe className="h-3 w-3" />
              {showImageSuggestions ? "Fechar Sugestões" : "🔍 Buscar Foto na Web"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              id={`${listId}-imagem`}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://exemplo.com/foto-do-produto.jpg"
              className="h-10 rounded-xl text-xs flex-1"
            />
            {imageUrl ? (
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <img
                  src={imageUrl}
                  alt="Prévia"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80";
                  }}
                />
              </div>
            ) : null}
          </div>

          {showImageSuggestions && (
            <div className="mt-2 rounded-xl bg-card p-2.5 border border-primary/20 space-y-2 shadow-xs">
              <div className="flex items-center gap-1.5">
                <Input
                  value={webSearchQuery}
                  onChange={(e) => setWebSearchQuery(e.target.value)}
                  placeholder="Pesquisar foto na web (ex: ração cães, antipulgas, shampoo)..."
                  className="h-8 rounded-lg text-xs"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Toque em uma foto profissional abaixo para aplicar instantaneamente ao produto:
              </p>
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                {searchProductImages(webSearchQuery, category).map((img) => {
                  const isCurrent = imageUrl === img.url;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => {
                        setImageUrl(img.url);
                        toast.success(`Foto "${img.title}" selecionada!`);
                      }}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border text-left transition-all hover:ring-2 hover:ring-primary",
                        isCurrent ? "border-primary ring-2 ring-primary" : "border-border/60"
                      )}
                    >
                      <img
                        src={img.url}
                        alt={img.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] p-0.5 truncate text-center">
                        {img.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button className="h-10 flex-1 rounded-xl" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Salvando..." : submitLabel}
        </Button>
        <Button
          variant="secondary"
          className="h-10 rounded-xl"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
