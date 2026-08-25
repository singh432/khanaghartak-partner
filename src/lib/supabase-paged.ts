/**
 * PostgREST caps every response at 1000 rows, so any `.select()` without an
 * explicit range silently truncates. These helpers page through the full set.
 */
const PAGE = 1000;

type Builder = {
  range: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>;
};

/** Fetch every row of a query by paging in 1000-row chunks. */
export async function fetchAll<T = any>(makeQuery: () => Builder, maxRows = 100000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
