import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  veg_type: "veg" | "nonveg";
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  ready: boolean;
  add: (item: Omit<CartItem, "qty">) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  totalQty: number;
  subtotal: number;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "kgt_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, ready]);

  const add: CartCtx["add"] = (it) => {
    setItems((cur) => {
      const existing = cur.find((c) => c.id === it.id);
      if (existing) return cur.map((c) => c.id === it.id ? { ...c, qty: c.qty + 1 } : c);
      return [...cur, { ...it, qty: 1 }];
    });
  };
  const inc = (id: string) => setItems((cur) => cur.map((c) => c.id === id ? { ...c, qty: c.qty + 1 } : c));
  const dec = (id: string) => setItems((cur) =>
    cur.flatMap((c) => c.id === id ? (c.qty <= 1 ? [] : [{ ...c, qty: c.qty - 1 }]) : [c])
  );
  const remove = (id: string) => setItems((cur) => cur.filter((c) => c.id !== id));
  const clear = () => setItems([]);

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <Ctx.Provider value={{ items, ready, add, inc, dec, remove, clear, totalQty, subtotal }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}
