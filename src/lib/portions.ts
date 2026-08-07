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
