import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Pokreće test unutar transakcije koja se uvijek poništi, pa svaki test
 * počinje od praznog stanja i ne ostavlja tragove u bazi.
 */
export async function uTransakciji<T>(
  test: (db: Client) => Promise<T>,
): Promise<T> {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query("begin");
    return await test(db);
  } finally {
    // Ako je veza pukla, poništavanje ne smije prekriti pravu grešku testa.
    await db.query("rollback").catch(() => {});
    await db.end().catch(() => {});
  }
}
