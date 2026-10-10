import { apiClient } from "./api-client";
import type { Paginated } from "./api-types";

export async function listAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = path;
  while (next) {
    const page: Paginated<T> = await apiClient<Paginated<T>>(next);
    items.push(...page.results);
    next = page.next ? `${path.split("?")[0]}${new URL(page.next, "http://localhost").search}` : null;
  }
  return items;
}
