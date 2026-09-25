import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export interface PaginationSearch {
  page?: number;
  limit?: number;
}

const pageSchema = z.coerce.number().int().min(1);
const limitSchema = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE);

function pick<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parsePaginationSearch(search: Record<string, unknown>): PaginationSearch {
  return { page: pick(pageSchema, search.page), limit: pick(limitSchema, search.limit) };
}

export function parseStringSearch(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function parseEnumSearch<const T extends readonly string[]>(values: T, value: unknown): T[number] | undefined {
  return values.includes(value as T[number]) ? (value as T[number]) : undefined;
}

export function withPaginationDefaults(search: PaginationSearch) {
  return { page: search.page ?? 1, limit: search.limit ?? DEFAULT_PAGE_SIZE };
}
