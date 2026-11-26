export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Opt-in pagination for public list endpoints (rule.md 4.8).
 * Returns null when the caller sent no `limit`, which keeps the historical
 * "return everything" behaviour that the live website relies on.
 * When `limit` is sent it is clamped to 1..MAX_PAGE_SIZE.
 */
export function parseOptionalPagination(searchParams: URLSearchParams): Pagination | null {
  const limitRaw = searchParams.get('limit');
  if (!limitRaw) return null;

  const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 20, 1), MAX_PAGE_SIZE);
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);

  return { page, limit, skip: (page - 1) * limit, take: limit };
}
