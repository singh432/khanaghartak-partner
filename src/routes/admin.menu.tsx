import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Upload, X, Loader2 } from "lucide-react";
import { isCakeCategory, isPieceCategory, isThaliCategory, isSinglePriceCategory, isSweetCategory } from "@/lib/portions";
import { useFormDraft } from "@/hooks/useFormDraft";


export const Route = createFileRoute("/admin/menu")({ component: AdminMenu });

type Category = { id: string; name: string; priority: number };
type MenuItem = {
  id: string; category_id: string; name: string; description: string | null;
  price: number; half_price: number | null; image_url: string | null; veg_type: "veg" | "nonveg"; is_available: boolean;
  price_kg: number | null; price_500g: number | null; price_250g: number | null; price_piece: number | null;
  price_half_pound: number | null; price_pound: number | null; price_2pound: number | null;
};
type FormState = {
  id?: string; name: string; category_id: string; description: string;
  price: string; half_price: string; image_url: string; veg_type: "veg" | "nonveg"; is_available: boolean;
  price_kg: string; price_500g: string; price_250g: string; price_piece: string;
  price_half_pound: string; price_pound: string; price_2pound: string;
};
const EMPTY: FormState = { name: "", category_id: "", description: "", price: "", half_price: "", image_url: "", veg_type: "veg", is_available: true, price_kg: "", price_500g: "", price_250g: "", price_piece: "", price_half_pound: "", price_pound: "", price_2pound: "" };

function AdminMenu() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: r } = await supabase.from("restaurants").select("id").eq("owner_id", u.user.id).limit(1).maybeSingle();
    const rid = (r as any)?.id ?? null;
    setRestaurantId(rid);
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("categories").select("*").eq("restaurant_id", rid).order("priority"),
      supabase.from("menu_items").select("*").eq("restaurant_id", rid).order("name"),
    ]);
    setCategories((c ?? []) as Category[]);
    setItems((m ?? []) as MenuItem[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const draftKey = restaurantId ? `kgt-draft-menu-item-${restaurantId}` : null;

  // Restore an unfinished "add item" draft, and keep saving it as they type.
  const startAdd = () => {
    let base: FormState = { ...EMPTY, category_id: categories[0]?.id ?? "" };
    if (draftKey) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) base = { ...base, ...(JSON.parse(raw) as FormState), id: undefined };
      } catch { /* ignore */ }
    }
    setEditing(base);
  };

  useEffect(() => {
    if (!draftKey || !editing || editing.id) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(editing)); } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [editing, draftKey]);

  const clearItemDraft = () => {
    if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
  };

  const startEdit = (m: MenuItem) => setEditing({
    id: m.id, name: m.name, category_id: m.category_id, description: m.description ?? "",
    price: String(m.price), half_price: m.half_price == null ? "" : String(m.half_price), image_url: m.image_url ?? "", veg_type: m.veg_type, is_available: m.is_available,
    price_kg: m.price_kg == null ? "" : String(m.price_kg),
    price_500g: m.price_500g == null ? "" : String(m.price_500g),
    price_250g: m.price_250g == null ? "" : String(m.price_250g),
    price_piece: m.price_piece == null ? "" : String(m.price_piece),
    price_half_pound: m.price_half_pound == null ? "" : String(m.price_half_pound),
    price_pound: m.price_pound == null ? "" : String(m.price_pound),
    price_2pound: m.price_2pound == null ? "" : String(m.price_2pound),
  });


  const toggleAvailable = async (m: MenuItem) => {
    const { error } = await supabase.from("menu_items").update({ is_available: !m.is_available }).eq("id", m.id);
    if (error) toast.error(error.message);
    else toast.success(`${m.name} → ${!m.is_available ? "Available" : "Out of Stock"}`);
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !editing) return;
    if (!restaurantId) return toast.error("Restaurant not found");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
    setEditing({ ...editing, image_url: data.publicUrl });
    setUploading(false);
    toast.success("Image uploaded");
  };

  const save = async () => {
    if (!editing) return;
    if (editing.name.trim().length < 2) return toast.error("Name is required");
    if (!editing.category_id) return toast.error("Choose a category");
    const catName = categories.find((c) => c.id === editing.category_id)?.name;
    const cake = isCakeCategory(catName);
    const sweet = !cake && isSweetCategory(catName);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const kg = num(editing.price_kg), g500 = num(editing.price_500g), g250 = num(editing.price_250g), piece = num(editing.price_piece);
    const lbHalf = num(editing.price_half_pound), lb = num(editing.price_pound), lb2 = num(editing.price_2pound);
    let price = Number(editing.price);
    if (cake) {
      const any = [lbHalf, lb, lb2].filter((v) => v != null) as number[];
      if (any.length === 0 || any.some((v) => !(v > 0))) return toast.error("Enter at least one valid cake price (½ pound / 1 pound / 2 pound)");
      price = any[0];
    } else if (sweet) {
      const any = [kg, g500, g250, piece].filter((v) => v != null) as number[];
      if (any.length === 0 || any.some((v) => !(v > 0))) return toast.error("Enter at least one valid price (1 kg / 500 g / 250 g / per piece)");
      price = any[0];
    } else {
      if (!price || price <= 0) return toast.error("Enter a valid full plate price");
      if (editing.half_price.trim() !== "" && !(Number(editing.half_price) > 0)) return toast.error("Enter a valid half plate price");
    }

    setSaving(true);
    const payload: any = {
      name: editing.name.trim(), description: editing.description.trim() || null,
      price,
      half_price: sweet || editing.half_price.trim() === "" ? null : Number(editing.half_price),
      price_kg: sweet ? kg : null, price_500g: sweet ? g500 : null,
      price_250g: sweet ? g250 : null, price_piece: sweet ? piece : null,
      price_half_pound: cake ? lbHalf : null, price_pound: cake ? lb : null, price_2pound: cake ? lb2 : null,
      image_url: editing.image_url || null, veg_type: editing.veg_type,
      is_available: editing.is_available, category_id: editing.category_id,
    };
    if (!editing.id) payload.restaurant_id = restaurantId;
    const { error } = editing.id
      ? await supabase.from("menu_items").update(payload).eq("id", editing.id)
      : await supabase.from("menu_items").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (!editing.id) clearItemDraft();
    toast.success(editing.id ? "Item updated" : "Item added");

    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", deleteId);
    if (error) toast.error(error.message); else toast.success("Item deleted");
    setDeleteId(null);
  };

  const [addingCat, setAddingCat] = useState(false);
  const clearCatDraft = useFormDraft("kgt-draft-category", { newCat }, (d) => {
    if (d?.newCat) setNewCat(d.newCat);
  });
  const addCategory = async () => {
    const name = newCat.trim();
    if (name.length < 2) return toast.error("Category name must be at least 2 characters");
    if (!restaurantId) return toast.error("Create your restaurant profile first, then add categories");
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return toast.error("That category already exists");
    setAddingCat(true);
    const { error } = await supabase.from("categories").insert({ name, priority: categories.length, restaurant_id: restaurantId });
    setAddingCat(false);
    if (error) toast.error(error.message); else { toast.success("Category added"); setNewCat(""); clearCatDraft(); load(); }
  };


  const grouped = categories.map((c) => ({ cat: c, list: items.filter((i) => i.category_id === c.id) }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Menu Management</h1>
          <p className="text-sm text-muted-foreground">{items.length} items · {categories.length} categories</p>
        </div>
        <button onClick={startAdd} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add Menu Item
        </button>
      </header>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => <span key={c.id} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{c.name}</span>)}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={40}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
            placeholder="New category name"
            className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-ring" />
          <button onClick={addCategory} disabled={addingCat} className="inline-flex items-center rounded-xl bg-foreground px-4 text-sm font-bold text-background disabled:opacity-60">
            {addingCat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
          </button>
        </div>
      </div>

      {grouped.map(({ cat, list }) => (
        <section key={cat.id} className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{cat.name} · {list.length}</h2>
          {list.length === 0 && <p className="rounded-xl border border-dashed bg-card p-4 text-center text-xs text-muted-foreground">No items in this category yet.</p>}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {list.map((m) => (
              <article key={m.id} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-sm">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {m.image_url ? <img src={m.image_url} alt={m.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No image</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${m.veg_type === "veg" ? "border-success" : "border-destructive"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${m.veg_type === "veg" ? "bg-success" : "bg-destructive"}`} />
                    </span>
                    <h3 className="truncate font-semibold leading-tight">{m.name}</h3>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{m.description}</p>
                  {isCakeCategory(cat.name) ? (
                    <p className="mt-1 flex flex-wrap gap-x-2 text-sm font-bold">
                      {m.price_half_pound != null && <span>½ lb ₹{Number(m.price_half_pound).toFixed(0)}</span>}
                      {m.price_pound != null && <span>1 lb ₹{Number(m.price_pound).toFixed(0)}</span>}
                      {m.price_2pound != null && <span>2 lb ₹{Number(m.price_2pound).toFixed(0)}</span>}
                      {m.price_half_pound == null && m.price_pound == null && m.price_2pound == null && <span>₹{Number(m.price).toFixed(0)}</span>}
                    </p>
                  ) : isSweetCategory(cat.name) ? (
                    <p className="mt-1 flex flex-wrap gap-x-2 text-sm font-bold">
                      {m.price_kg != null && <span>1 kg ₹{Number(m.price_kg).toFixed(0)}</span>}
                      {m.price_500g != null && <span>500 g ₹{Number(m.price_500g).toFixed(0)}</span>}
                      {m.price_250g != null && <span>250 g ₹{Number(m.price_250g).toFixed(0)}</span>}
                      {m.price_piece != null && <span>1 pc ₹{Number(m.price_piece).toFixed(0)}</span>}
                      {m.price_kg == null && m.price_500g == null && m.price_250g == null && m.price_piece == null && <span>₹{Number(m.price).toFixed(0)}</span>}
                    </p>
                  ) : isPieceCategory(cat.name) ? (
                    <p className="mt-1 text-sm font-bold">₹{Number(m.price).toFixed(0)} <span className="font-semibold text-muted-foreground">/ piece</span></p>
                  ) : isThaliCategory(cat.name) ? (
                    <p className="mt-1 text-sm font-bold">₹{Number(m.price).toFixed(0)}</p>
                  ) : (
                    <p className="mt-1 text-sm font-bold">Full ₹{Number(m.price).toFixed(0)}{m.half_price != null && <span className="ml-2 font-semibold text-muted-foreground">Half ₹{Number(m.half_price).toFixed(0)}</span>}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <span className="relative inline-block h-5 w-9 rounded-full bg-secondary">
                        <input type="checkbox" className="peer sr-only" checked={m.is_available} onChange={() => toggleAvailable(m)} />
                        <span className="absolute inset-0 rounded-full transition-colors peer-checked:bg-success" />
                        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                      </span>
                      <span className={`text-[11px] font-semibold ${m.is_available ? "text-success" : "text-muted-foreground"}`}>
                        {m.is_available ? "Available" : "Out of Stock"}
                      </span>
                    </label>
                    <button onClick={() => startEdit(m)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteId(m.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {editing && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/60 p-0 sm:p-4 md:items-center" onClick={() => setEditing(null)}>
          <div className="flex max-h-[90vh] max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h3 className="text-base font-extrabold text-foreground">{editing.id ? "Edit menu item" : "Add menu item"}</h3>
              <button onClick={() => setEditing(null)} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y", overscrollBehavior: "contain" }}>
              <Field label="Product image">
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {editing.image_url ? <img src={editing.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No image</div>}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-accent/40 px-3 py-2 text-xs font-semibold text-primary">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading…" : "Upload image"}
                    <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
                  </label>
                </div>
              </Field>
              <Field label="Product name">
                <input className="ai" value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Category">
                <select className="ai" value={editing.category_id} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Description">
                <textarea className="ai" rows={2} maxLength={300} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </Field>
              {isCakeCategory(categories.find((c) => c.id === editing.category_id)?.name) ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="½ pound price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_half_pound} onChange={(e) => setEditing({ ...editing, price_half_pound: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <Field label="1 pound price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_pound} onChange={(e) => setEditing({ ...editing, price_pound: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <Field label="2 pound price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_2pound} onChange={(e) => setEditing({ ...editing, price_2pound: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                  </div>
                  <p className="-mt-1 text-[11px] text-muted-foreground">Cakes are sold by pound — fill only the sizes you bake. Pastries are sold per piece.</p>
                </>
              ) : isSweetCategory(categories.find((c) => c.id === editing.category_id)?.name) ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="1 kg price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_kg} onChange={(e) => setEditing({ ...editing, price_kg: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <Field label="500 g price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_500g} onChange={(e) => setEditing({ ...editing, price_500g: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <Field label="250 g price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_250g} onChange={(e) => setEditing({ ...editing, price_250g: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <Field label="Per piece price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.price_piece} onChange={(e) => setEditing({ ...editing, price_piece: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                  </div>
                  <p className="-mt-1 text-[11px] text-muted-foreground">Sweets are sold by weight or per piece — fill only the sizes you sell.</p>
                </>
              ) : isSinglePriceCategory(categories.find((c) => c.id === editing.category_id)?.name) ? (
                <>
                  <Field label={isPieceCategory(categories.find((c) => c.id === editing.category_id)?.name) ? "Price per piece (₹)" : "Price (₹)"}>
                    <input className="ai" inputMode="decimal" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/[^0-9.]/g, ""), half_price: "" })} />
                  </Field>
                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    {isPieceCategory(categories.find((c) => c.id === editing.category_id)?.name)
                      ? "Items like pizza, burger, sandwich, roti and paratha are sold per piece — no half plate."
                      : "Thali has a single fixed price — no full or half."}
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Full plate price (₹)">
                      <input className="ai" inputMode="decimal" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                    <Field label="Half plate price (₹)">
                      <input className="ai" inputMode="decimal" placeholder="Optional" value={editing.half_price} onChange={(e) => setEditing({ ...editing, half_price: e.target.value.replace(/[^0-9.]/g, "") })} />
                    </Field>
                  </div>
                  <p className="-mt-1 text-[11px] text-muted-foreground">Leave half plate empty if the dish is sold in full plate only.</p>
                </>
              )}
              <Field label="Type">
                <div className="flex gap-2">
                  {(["veg", "nonveg"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setEditing({ ...editing, veg_type: v })}
                      className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold capitalize ${editing.veg_type === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                      {v === "veg" ? "Veg" : "Non-Veg"}
                    </button>
                  ))}
                </div>
              </Field>
              <label className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
                <span className="text-sm font-semibold">Available for ordering</span>
                <input type="checkbox" checked={editing.is_available} onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })} className="h-4 w-4" />
              </label>
            </div>

            {/* Pinned Sticky Save Footer */}
            <div className="border-t bg-card px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => { clearItemDraft(); setEditing(null); }} className="rounded-xl bg-secondary py-3 text-sm font-bold text-foreground hover:bg-secondary/80">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={saving} className="inline-flex items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-60">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing.id ? "Update Item" : "Save Item"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">Delete this item?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Are you sure you want to delete this item? This cannot be undone.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-xl bg-secondary py-2.5 text-sm font-bold">Cancel</button>
              <button onClick={confirmDelete} className="rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground">Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.ai { width:100%; border-radius:12px; padding:10px 12px; background:var(--color-input); border:1px solid var(--color-border); font-size:14px; outline:none; } .ai:focus{ border-color: var(--color-ring);} `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
