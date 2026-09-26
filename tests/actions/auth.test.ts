import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((putanja: string) => {
  throw new Error(`REDIRECT:${putanja}`);
});
vi.mock("next/navigation", () => ({ redirect }));

const server = { auth: { signInWithPassword: vi.fn(), signOut: vi.fn() }, rpc: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ napraviServerKlijent: async () => server }));

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  server.rpc.mockResolvedValue({ error: null });
  server.auth.signOut.mockResolvedValue({});
});

describe("prijava PIN-om", () => {
  it("ispravan PIN: prijava prolazi", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    server.auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(prijaviPinom(ID, "482913")).rejects.toThrow("REDIRECT:/");
    expect(server.auth.signInWithPassword).toHaveBeenCalledWith({ email: `${ID}@korisnik.magacin.local`, password: "482913" });
  });

  it("pogrešan PIN: opšta poruka, bez zaključavanja", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    server.auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    for (let i = 0; i < 10; i++) {
      expect(await prijaviPinom(ID, "482913")).toEqual({ greska: "Pogrešan PIN. Pokušajte ponovo." });
    }
  });

  it("PIN mora imati šest cifara, inače se ne poziva prijava", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    expect(await prijaviPinom(ID, "12ab")).toEqual({ greska: "Unesite šestocifreni PIN." });
    expect(await prijaviPinom("nije-id", "482913")).toEqual({ greska: "Unesite šestocifreni PIN." });
    expect(server.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("isključen račun: sesija se zatvara i javlja se razlog", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    server.auth.signInWithPassword.mockResolvedValue({ error: null });
    server.rpc.mockResolvedValue({ error: { message: "x" } });
    expect(await prijaviPinom(ID, "482913")).toEqual({ greska: "Ovaj račun nije aktivan. Obratite se menadžeru." });
    expect(server.auth.signOut).toHaveBeenCalled();
  });
});

describe("prijava menadžera", () => {
  const forma = (email: string, lozinka: string) => {
    const f = new FormData();
    f.set("email", email);
    f.set("lozinka", lozinka);
    return f;
  };

  it("ispravni podaci: prijava prolazi", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    server.auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(prijaviMenadzera(undefined, forma("sef@magacin.local", "lozinka123"))).rejects.toThrow("REDIRECT:/");
  });

  it("pogrešni podaci: opšta poruka", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    server.auth.signInWithPassword.mockResolvedValue({ error: { message: "x" } });
    expect(await prijaviMenadzera(undefined, forma("sef@magacin.local", "pogresna"))).toEqual({ greska: "Pogrešan email ili lozinka." });
  });

  it("prazno polje: ne poziva prijavu", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    expect(await prijaviMenadzera(undefined, forma("", ""))).toEqual({ greska: "Unesite email i lozinku." });
    expect(server.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
