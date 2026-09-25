import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((putanja: string) => {
  throw new Error(`REDIRECT:${putanja}`);
});
vi.mock("next/navigation", () => ({ redirect }));

// Lažni klijenti: bilježe pozive i vraćaju ono što test odredi.
const admin = { rpc: vi.fn() };
const server = { auth: { signInWithPassword: vi.fn(), signOut: vi.fn() }, rpc: vi.fn() };
vi.mock("@/lib/supabase/admin", () => ({ napraviAdminKlijent: () => admin }));
vi.mock("@/lib/supabase/server", () => ({ napraviServerKlijent: async () => server }));

const ID = "11111111-1111-4111-8111-111111111111";

/** Odgovor admin.rpc po imenu funkcije. */
function adminOdgovara(odgovori: Record<string, unknown>) {
  admin.rpc.mockImplementation(async (ime: string) => ({ data: odgovori[ime] ?? null, error: null }));
}

beforeEach(() => {
  vi.clearAllMocks();
  server.rpc.mockResolvedValue({ error: null });
  server.auth.signOut.mockResolvedValue({});
});

const imena = () => admin.rpc.mock.calls.map((c) => c[0]);

describe("prijava PIN-om sa zaštitom od pogađanja", () => {
  it("ispravan PIN: prijava prolazi, brojač se poništava", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    adminOdgovara({});
    server.auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(prijaviPinom(ID, "482913")).rejects.toThrow("REDIRECT:/");
    expect(imena()).toEqual(["provjeri_zakljucavanje", "zabiljezi_uspjesnu_prijavu"]);
    expect(server.auth.signInWithPassword).toHaveBeenCalledWith({ email: `${ID}@korisnik.magacin.local`, password: "482913" });
  });

  it("pogrešan PIN: broji se pokušaj i javlja opšta poruka", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    adminOdgovara({ zabiljezi_neuspjeli_pokusaj: [{ neuspjesnih: 2, zakljucan_do: null }] });
    server.auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await prijaviPinom(ID, "482913")).toEqual({ greska: "Pogrešan PIN. Pokušajte ponovo." });
    expect(imena()).toEqual(["provjeri_zakljucavanje", "zabiljezi_neuspjeli_pokusaj"]);
  });

  it("peti pogrešan pokušaj: javlja da je račun zaključan", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    const do_ = new Date(Date.now() + 15 * 60_000).toISOString();
    adminOdgovara({ zabiljezi_neuspjeli_pokusaj: [{ neuspjesnih: 5, zakljucan_do: do_ }] });
    server.auth.signInWithPassword.mockResolvedValue({ error: { message: "x" } });
    const r = await prijaviPinom(ID, "482913");
    expect(r?.greska).toMatch(/privremeno zaključan.*za (14|15) min/);
  });

  it("zaključan račun: PIN se uopće ne provjerava, ni tačan ne prolazi", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    adminOdgovara({ provjeri_zakljucavanje: new Date(Date.now() + 10 * 60_000).toISOString() });
    server.auth.signInWithPassword.mockResolvedValue({ error: null }); // čak i da je PIN tačan
    const r = await prijaviPinom(ID, "482913");
    expect(r?.greska).toMatch(/privremeno zaključan/);
    expect(server.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(imena()).toEqual(["provjeri_zakljucavanje"]);
  });

  it("poruka o zaključavanju ne otkriva koliko je PIN blizu tačnog", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    const do_ = new Date(Date.now() + 15 * 60_000).toISOString();
    adminOdgovara({ zabiljezi_neuspjeli_pokusaj: [{ neuspjesnih: 5, zakljucan_do: do_ }] });
    server.auth.signInWithPassword.mockResolvedValue({ error: { message: "x" } });
    const zaBlizuTacnom = await prijaviPinom(ID, "482914");
    const zaDalekom = await prijaviPinom(ID, "907531");
    expect(zaBlizuTacnom?.greska).toBe(zaDalekom?.greska);
  });

  it("neispravan oblik PIN-a se odbija prije ikakvog brojanja", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    expect(await prijaviPinom(ID, "12ab")).toEqual({ greska: "Unesite šestocifreni PIN." });
    expect(await prijaviPinom("nije-id", "482913")).toEqual({ greska: "Unesite šestocifreni PIN." });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("isključen korisnik: sesija se zatvara i javlja da račun nije aktivan", async () => {
    const { prijaviPinom } = await import("../../app/actions/auth");
    adminOdgovara({});
    server.auth.signInWithPassword.mockResolvedValue({ error: null });
    server.rpc.mockResolvedValue({ error: { message: "Korisnik nije prijavljen", code: "28000" } });
    expect(await prijaviPinom(ID, "482913")).toEqual({ greska: "Ovaj račun nije aktivan. Obratite se menadžeru." });
    expect(server.auth.signOut).toHaveBeenCalled();
  });
});

describe("prijava menadžera sa zaštitom", () => {
  const forma = (email: string, lozinka: string) => {
    const f = new FormData();
    f.set("email", email);
    f.set("lozinka", lozinka);
    return f;
  };

  it("nepoznata e-adresa: ista poruka kao za pogrešnu lozinku, bez brojača", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    adminOdgovara({ korisnik_po_emailu: null });
    server.auth.signInWithPassword.mockResolvedValue({ error: { message: "x" } });
    expect(await prijaviMenadzera(undefined, forma("nema@magacin.local", "lozinka123"))).toEqual({ greska: "Pogrešan email ili lozinka." });
    expect(imena()).toEqual(["korisnik_po_emailu"]);
  });

  it("pogrešna lozinka poznatog menadžera se broji, a zaključan račun javlja razlog", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    adminOdgovara({ korisnik_po_emailu: ID, provjeri_zakljucavanje: new Date(Date.now() + 5 * 60_000).toISOString() });
    const r = await prijaviMenadzera(undefined, forma("sef@magacin.local", "pogresna123"));
    expect(r?.greska).toMatch(/privremeno zaključan/);
    expect(server.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("ispravna lozinka prolazi i poništava brojač", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    adminOdgovara({ korisnik_po_emailu: ID });
    server.auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(prijaviMenadzera(undefined, forma("sef@magacin.local", "menadzer123"))).rejects.toThrow("REDIRECT:/");
    expect(imena()).toEqual(["korisnik_po_emailu", "provjeri_zakljucavanje", "zabiljezi_uspjesnu_prijavu"]);
  });

  it("prazna polja se odbijaju", async () => {
    const { prijaviMenadzera } = await import("../../app/actions/auth");
    expect(await prijaviMenadzera(undefined, forma("", ""))).toEqual({ greska: "Unesite email i lozinku." });
  });
});
