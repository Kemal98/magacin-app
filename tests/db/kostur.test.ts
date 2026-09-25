import { describe, expect, it } from "vitest";
import { uTransakciji } from "./helpers";

describe("kostur baze", () => {
  it("migracije su primijenjene i operacija u bazi odgovara", async () => {
    await uTransakciji(async (db) => {
      const { rows } = await db.query("select magacin.zdravlje() as odgovor");
      expect(rows[0].odgovor).toBe("ok");
    });
  });
});
