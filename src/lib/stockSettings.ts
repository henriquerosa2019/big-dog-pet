/**
 * Gerenciador de Limites de Estoque Crítico
 * Big Dog Pet - Franco da Rocha
 * 
 * Permite definir e consultar o limite mínimo de estoque por produto
 * e disparar alertas para produtos da Curva A com estoque crítico.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "bigdog_critical_stock_v1";
export const DEFAULT_CRITICAL_STOCK = 5;

/**
 * Retorna todos os limites configurados por ID de produto
 */
export function getAllCriticalStocks(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Retorna o limite de estoque crítico de um produto específico.
 * Se não houver configuração personalizada, retorna o padrão (5).
 */
export function getCriticalStock(productId?: string | null): number {
  if (!productId) return DEFAULT_CRITICAL_STOCK;
  const all = getAllCriticalStocks();
  const val = all[productId];
  return typeof val === "number" && !isNaN(val) ? val : DEFAULT_CRITICAL_STOCK;
}

/**
 * Salva o limite de estoque crítico de um produto
 */
export function setCriticalStock(productId: string, threshold: number): void {
  if (typeof window === "undefined" || !productId) return;
  try {
    const all = getAllCriticalStocks();
    all[productId] = Math.max(0, Math.floor(threshold));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    window.dispatchEvent(
      new CustomEvent("bigdog_critical_stock_change", {
        detail: { productId, threshold: all[productId] },
      })
    );
  } catch (err) {
    console.error("Erro ao salvar estoque crítico:", err);
  }
}

/**
 * Hook React para obter e sincronizar limites de estoque crítico
 */
export function useAllCriticalStocks() {
  const [stocks, setStocks] = useState<Record<string, number>>(() => getAllCriticalStocks());

  useEffect(() => {
    const handleUpdate = () => {
      setStocks(getAllCriticalStocks());
    };

    window.addEventListener("bigdog_critical_stock_change", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bigdog_critical_stock_change", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return stocks;
}

/**
 * Hook para um produto específico
 */
export function useProductCriticalStock(productId?: string | null) {
  const all = useAllCriticalStocks();
  return productId ? all[productId] ?? DEFAULT_CRITICAL_STOCK : DEFAULT_CRITICAL_STOCK;
}

export interface CriticalStockAlertItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  criticalLimit: number;
  abcClass: "A" | "B" | "C";
  alertText: string;
}

/**
 * Verifica e filtra produtos da Curva A que atingiram ou estão abaixo do estoque crítico
 */
export function findCurveACriticalProducts(
  products: Array<{
    id: string;
    name: string;
    category?: string | null;
    stock: number;
  }>,
  curveAProductIds: Set<string> | string[]
): CriticalStockAlertItem[] {
  const allLimits = getAllCriticalStocks();
  const aSet = Array.isArray(curveAProductIds) ? new Set(curveAProductIds) : curveAProductIds;
  const criticalItems: CriticalStockAlertItem[] = [];

  for (const prod of products) {
    const isCurveA = aSet.has(prod.id) || aSet.has(prod.name.trim().toLowerCase());
    if (!isCurveA) continue;

    const limit = allLimits[prod.id] ?? DEFAULT_CRITICAL_STOCK;
    if (prod.stock <= limit) {
      criticalItems.push({
        id: prod.id,
        name: prod.name,
        category: prod.category || "Geral",
        stock: prod.stock,
        criticalLimit: limit,
        abcClass: "A",
        alertText: `Produto ${prod.name} , Curva A em estoque crítico. Repor estoque!!!`,
      });
    }
  }

  return criticalItems;
}
