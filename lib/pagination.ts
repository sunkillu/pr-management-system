export const PAGE_SIZE = 50;

export type PageQuery = Record<string, string | string[] | undefined>;

export function getPagination(pageParam?: string) {
  const parsedPage = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100_000) : 1;

  return {
    page,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  };
}
