import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  totalCents: number;
  count: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Código do cupom da campanha de aniversário (ver birthdayCouponCode em
   * lib/format.ts), guardado ao visitar /loja com ?campanha=niver&cupom=...
   * pra sobreviver até o checkout no carrinho mesmo que o tutor navegue por
   * outras páginas antes de finalizar o pedido. */
  birthdayCoupon: string | null;
  setBirthdayCoupon: (code: string | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "bigdog-cart-v1";
const COUPON_STORAGE_KEY = "bigdog-cart-coupon-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [birthdayCoupon, setBirthdayCouponState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
      setBirthdayCouponState(window.localStorage.getItem(COUPON_STORAGE_KEY));
    } catch {
      /* ignora carrinho/cupom inválido */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage indisponível */
    }
  }, [items]);

  const setBirthdayCoupon = useCallback((code: string | null) => {
    setBirthdayCouponState(code);
    try {
      if (code) window.localStorage.setItem(COUPON_STORAGE_KEY, code);
      else window.localStorage.removeItem(COUPON_STORAGE_KEY);
    } catch {
      /* storage indisponível */
    }
  }, []);

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.id === item.id);
      if (existing) {
        return current.map((i) =>
          i.id === item.id ? { ...i, quantity: Math.min(99, i.quantity + quantity) } : i,
        );
      }
      return [...current, { ...item, quantity }];
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((i) => i.id !== id)
        : current.map((i) => (i.id === id ? { ...i, quantity: Math.min(99, quantity) } : i)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setBirthdayCoupon(null);
  }, [setBirthdayCoupon]);

  const value = useMemo<CartContextValue>(() => {
    const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    return {
      items,
      totalCents,
      count,
      add,
      setQuantity,
      remove,
      clear,
      birthdayCoupon,
      setBirthdayCoupon,
    };
  }, [items, add, setQuantity, remove, clear, birthdayCoupon, setBirthdayCoupon]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}
