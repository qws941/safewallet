import type { DrizzleD1Database } from "drizzle-orm/d1";

/**
 * Execute multiple database operations atomically using D1's batch API.
 * D1 doesn't support traditional transactions, but db.batch() executes
 * all statements in a single round-trip with implicit transaction semantics.
 */
export async function dbBatch<T extends readonly unknown[]>(
  db: DrizzleD1Database<any>,
  operations: [...{ [K in keyof T]: Promise<T[K]> }],
): Promise<T> {
  const results = await (db as any).batch(operations);
  return results as T;
}
