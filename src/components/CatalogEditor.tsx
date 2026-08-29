import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

    onSubmit({
      name: trimmedName,
      description: description.trim(),
      category: trimmedCategory,
      priceCents,
      durationMin: parsedDuration,
      stock: parsedStock,
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
          <div>
            <Label htmlFor={`${listId}-estoque`}>Estoque</Label>
            <Input
              id={`${listId}-estoque`}
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="mt-1 h-10 rounded-xl"
            />
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
