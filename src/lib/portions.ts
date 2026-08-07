/** Bread-type categories are sold by the piece, not as full/half plates. */
const BREAD_WORDS = [
  "roti", "rotis", "chapati", "chapatti", "paratha", "parantha", "parathas",
  "bread", "breads", "naan", "kulcha", "puri", "poori", "tandoor", "rumali",
  "phulka", "missi",
];

export function isPieceCategory(categoryName?: string | null): boolean {
  const n = (categoryName ?? "").toLowerCase();
  if (!n) return false;
  return BREAD_WORDS.some((w) => n.includes(w));
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
