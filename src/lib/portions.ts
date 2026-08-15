/** Bread-type categories are sold by the piece, not as full/half plates. */
const BREAD_WORDS = [
  "roti", "rotis", "chapati", "chapatti", "paratha", "parantha", "parathas",
  "bread", "breads", "naan", "kulcha", "puri", "poori", "tandoor", "rumali",
  "phulka", "missi",
];

/** Snacks / fast food that are always priced per piece, never full/half plate. */
const PER_PIECE_WORDS = [
  "pizza", "burger", "sandwich", "sandwhich", "roll", "wrap", "momo", "momos",
  "samosa", "kachori", "patty", "puff", "pastry", "pastries", "shake", "frankie",
  "hot dog", "hotdog", "bun", "pav", "vada", "idli", "dosa", "uttapam", "cutlet",
  "egg", "omelette", "omelet", "spring roll", "nugget", "fries",
];


/** Cake categories are sold by pound (½ lb / 1 lb / 2 lb). */
export function isCakeCategory(categoryName?: string | null): boolean {
  const n = (categoryName ?? "").toLowerCase();
  if (!n) return false;
  // "cake" always wins, even in mixed names like "Cakes & Pastries".
  if (n.includes("cake")) return true;
  return false;
}

export function isPieceCategory(categoryName?: string | null): boolean {
  const n = (categoryName ?? "").toLowerCase();
  if (!n) return false;
  if (isCakeCategory(n)) return false;
  return BREAD_WORDS.some((w) => n.includes(w)) || PER_PIECE_WORDS.some((w) => n.includes(w));
}

/** Thali categories are sold as one fixed plate — no full/half split. */
export function isThaliCategory(categoryName?: string | null): boolean {
  const n = (categoryName ?? "").toLowerCase();
  return n.includes("thali") || n.includes("thaali");
}

/** True when the category has one single price (no half plate). */
export function isSinglePriceCategory(categoryName?: string | null): boolean {
  return isPieceCategory(categoryName) || isThaliCategory(categoryName);
}

/** Sweet-shop categories are sold by weight (1 kg / 500 g / 250 g) or per piece. */
export function isSweetCategory(categoryName?: string | null): boolean {
  const n = (categoryName ?? "").toLowerCase();
  if (!n) return false;
  if (isCakeCategory(n)) return false;
  return ["sweet", "sweets", "mithai", "mithaai", "misthan", "dessert", "desserts", "halwai"]
    .some((w) => n.includes(w));
}

export const PORTION_LABELS: Record<string, string> = {
  full: "Full", half: "Half", kg: "1 kg", g500: "500 g", g250: "250 g", piece: "Per piece",
  lb_half: "½ pound", lb: "1 pound", lb2: "2 pound",
};


/** Handi dishes are slow-cooked — restaurants need extra prep time. */
export function isHandiCategory(categoryName?: string | null): boolean {
  return (categoryName ?? "").toLowerCase().includes("handi");
}

export const HANDI_PREP_NOTE =
  "Non-veg Handi is slow-cooked fresh — the restaurant needs about 2.5 hours to prepare it.";

/** True when the cart contains a non-veg handi dish. */
export function cartHasHandiNonVeg(items: { name: string; veg_type: "veg" | "nonveg" }[]): boolean {
  return items.some((i) => i.veg_type === "nonveg" && i.name.toLowerCase().includes("handi"));
}
