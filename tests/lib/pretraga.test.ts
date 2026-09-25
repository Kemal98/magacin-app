import { describe, expect, it } from "vitest";
import { normaliziraj, poklapa } from "../../lib/pretraga";

describe("normalizacija za pretragu", () => {
  it("skida kvačice i mala/velika slova", () => {
    expect(normaliziraj("ŠEĆER Čaj ŽUTI Đevrek")).toBe("secer caj zuti devrek");
  });

  it("sabija razmake", () => {
    expect(normaliziraj("  Kafa   bosanska ")).toBe("kafa bosanska");
  });
});

describe("pretraga po tekstu", () => {
  it("prazan upit poklapa sve", () => {
    expect(poklapa("Kafa", "")).toBe(true);
    expect(poklapa("Kafa", "   ")).toBe(true);
  });

  it("nalazi dio riječi, bez obzira na velika slova i kvačice", () => {
    expect(poklapa("Šećer u kockama", "secer")).toBe(true);
    expect(poklapa("Šećer u kockama", "SEĆ")).toBe(true);
    expect(poklapa("Čaj menta", "caj")).toBe(true);
    expect(poklapa("Đumbir", "dumb")).toBe(true);
  });

  it("više riječi: moraju biti sve, bilo kojim redom", () => {
    expect(poklapa("Kafa bosanska 100gr", "bosanska kafa")).toBe(true);
    expect(poklapa("Kafa bosanska 100gr", "kafa 100")).toBe(true);
    expect(poklapa("Kafa bosanska 100gr", "kafa espresso")).toBe(false);
  });

  it("ne poklapa ono čega nema", () => {
    expect(poklapa("Kafa", "mlijeko")).toBe(false);
  });

  it("radi i s brojevima i oznakama (bar kod, KM, mjera)", () => {
    expect(poklapa("Kafa · kg · 3850001", "3850001")).toBe(true);
    expect(poklapa("Vrijednost 12,50 KM", "12,50")).toBe(true);
  });
});
