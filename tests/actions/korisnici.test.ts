import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, zahtijevajUlogu, adminAuth, server } = vi.hoisted(() => ({
  redirect: vi.fn((putanja: string) => {
    throw new Error(`REDIRECT:${putanja}`);
  }),
  zahtijevajUlogu: vi.fn(async () => ({ id: "sef", ime: "Šef", uloga: "menadzer" })),
  adminAuth: { createUser: vi.fn(), deleteUser: vi.fn(), updateUserById: vi.fn() },
  server: { rpc: vi.fn() },
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/korisnik", () => ({ zahtijevajUlogu }));
vi.mock("@/lib/supabase/admin", () => ({ napraviAdminKlijent: () => ({ auth: { admin: adminAuth } }) }));
vi.mock("@/lib/supabase/server", () => ({ napraviServerKlijent: async () => server }));

import { dodajKorisnika, izmijeniKorisnika, otkljucajKorisnika, promijeniAktivnostKorisnika } from "../../app/actions/korisnici";

const OBJEKAT = "44444444-4444-4444-8444-444444444444";
const KORISNIK = "22222222-2222-4222-8222-222222222222";

const forma = (polja: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(polja)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  adminAuth.createUser.mockResolvedValue({ error: null });
  adminAuth.deleteUser.mockResolvedValue({ error: null });
  adminAuth.updateUserById.mockResolvedValue({ error: null });
  server.rpc.mockResolvedValue({ error: null });
  zahtijevajUlogu.mockResolvedValue({ id: "sef", ime: "Šef", uloga: "menadzer" });
});

describe("dodavanje korisnika", () => {
  it("magacioner: pravi račun s PIN-om na tehničkoj adresi, pa ga upisuje u magacin", async () => {
    await expect(dodajKorisnika(undefined, forma({ ime: " Amra Hodžić ", uloga: "magacioner", pin: "482913" }))).rejects.toThrow(
      "REDIRECT:/menadzer/korisnici",
    );
    const napravljen = adminAuth.createUser.mock.calls[0][0];
    expect(napravljen).toMatchObject({ password: "482913", email_confirm: true });
    expect(napravljen.email).toBe(`${napravljen.id}@korisnik.magacin.local`);
    expect(server.rpc).toHaveBeenCalledWith("dodaj_korisnika", {
      p_id: napravljen.id,
      p_ime: "Amra Hodžić",
      p_uloga: "magacioner",
      p_objekat: null,
    });
    expect(adminAuth.deleteUser).not.toHaveBeenCalled();
  });

  it("osoblje objekta: veže se za izabrani objekat", async () => {
    await expect(
      dodajKorisnika(undefined, forma({ ime: "Šank osoblje", uloga: "objekat", pin: "907531", objekat: OBJEKAT })),
    ).rejects.toThrow("REDIRECT");
    expect(server.rpc).toHaveBeenCalledWith("dodaj_korisnika", expect.objectContaining({ p_uloga: "objekat", p_objekat: OBJEKAT }));
  });

  it("osoblje objekta bez objekta se odbija prije pravljenja računa", async () => {
    const r = await dodajKorisnika(undefined, forma({ ime: "Osoblje", uloga: "objekat", pin: "907531" }));
    expect(r).toEqual({ greska: "Izaberite objekat za osoblje objekta." });
    expect(adminAuth.createUser).not.toHaveBeenCalled();
  });

  it("menadžer: e-adresa i lozinka, bez objekta", async () => {
    await expect(
      dodajKorisnika(undefined, forma({ ime: "Drugi šef", uloga: "menadzer", email: "Drugi@Magacin.local", lozinka: "dovoljno-duga" })),
    ).rejects.toThrow("REDIRECT");
    expect(adminAuth.createUser.mock.calls[0][0]).toMatchObject({ email: "drugi@magacin.local", password: "dovoljno-duga" });
    expect(server.rpc).toHaveBeenCalledWith("dodaj_korisnika", expect.objectContaining({ p_uloga: "menadzer", p_objekat: null }));
  });

  it("previše jednostavan PIN i kratka lozinka se odbijaju bez pravljenja računa", async () => {
    expect((await dodajKorisnika(undefined, forma({ ime: "A", uloga: "magacioner", pin: "123456" })))?.greska).toMatch(/jednostavan/);
    expect((await dodajKorisnika(undefined, forma({ ime: "A", uloga: "magacioner", pin: "12" })))?.greska).toMatch(/šest cifara/);
    expect((await dodajKorisnika(undefined, forma({ ime: "A", uloga: "menadzer", email: "a@b.ba", lozinka: "kratka" })))?.greska).toMatch(/8 znakova/);
    expect((await dodajKorisnika(undefined, forma({ ime: "A", uloga: "menadzer", email: "nije-adresa", lozinka: "dovoljno-duga" })))?.greska).toMatch(/e-adresu/);
    expect(adminAuth.createUser).not.toHaveBeenCalled();
  });

  it("bez imena ili s nepoznatom ulogom se odbija", async () => {
    expect(await dodajKorisnika(undefined, forma({ ime: " ", uloga: "magacioner", pin: "482913" }))).toEqual({ greska: "Upišite ime." });
    expect(await dodajKorisnika(undefined, forma({ ime: "A", uloga: "admin", pin: "482913" }))).toEqual({ greska: "Izaberite ulogu." });
    expect(adminAuth.createUser).not.toHaveBeenCalled();
  });

  it("ako upis u magacin ne uspije (npr. ime već postoji), račun se briše i javlja razlog", async () => {
    server.rpc.mockResolvedValue({ error: { code: "23505", message: "Korisnik s tim imenom već postoji" } });
    const r = await dodajKorisnika(undefined, forma({ ime: "Amra", uloga: "magacioner", pin: "482913" }));
    expect(r).toEqual({ greska: "Korisnik s tim imenom već postoji" });
    expect(adminAuth.deleteUser).toHaveBeenCalledWith(adminAuth.createUser.mock.calls[0][0].id);
  });

  it("tehnička greška baze se ne prikazuje korisniku, ali se račun ipak briše", async () => {
    server.rpc.mockResolvedValue({ error: { code: "XX000", message: "interna greška baze s detaljima" } });
    const r = await dodajKorisnika(undefined, forma({ ime: "Amra", uloga: "magacioner", pin: "482913" }));
    expect(r?.greska).toBe("Radnja nije uspjela. Pokušajte ponovo.");
    expect(adminAuth.deleteUser).toHaveBeenCalled();
  });

  it("e-adresa koja već postoji daje jasnu poruku", async () => {
    adminAuth.createUser.mockResolvedValue({ error: { message: "A user with this email address has already been registered" } });
    const r = await dodajKorisnika(undefined, forma({ ime: "Šef 2", uloga: "menadzer", email: "sef@magacin.local", lozinka: "dovoljno-duga" }));
    expect(r).toEqual({ greska: "Ta e-adresa se već koristi." });
    expect(server.rpc).not.toHaveBeenCalled();
  });

  it("ulogu provjerava prije svega: ne-menadžer ne dolazi do pravljenja računa", async () => {
    zahtijevajUlogu.mockRejectedValue(new Error("REDIRECT:/magacin"));
    await expect(dodajKorisnika(undefined, forma({ ime: "A", uloga: "magacioner", pin: "482913" }))).rejects.toThrow("REDIRECT:/magacin");
    expect(adminAuth.createUser).not.toHaveBeenCalled();
  });
});

describe("izmjena korisnika", () => {
  it("mijenja ime bez diranja PIN-a kad je polje prazno", async () => {
    await expect(izmijeniKorisnika(KORISNIK, "magacioner", undefined, forma({ ime: "Amra H.", pin: "" }))).rejects.toThrow("REDIRECT");
    expect(server.rpc).toHaveBeenCalledWith("izmijeni_korisnika", { p_id: KORISNIK, p_ime: "Amra H.", p_objekat: null });
    expect(adminAuth.updateUserById).not.toHaveBeenCalled();
  });

  it("novi PIN mijenja lozinku računa i otključava ga", async () => {
    await expect(izmijeniKorisnika(KORISNIK, "magacioner", undefined, forma({ ime: "Amra", pin: "907531" }))).rejects.toThrow("REDIRECT");
    expect(adminAuth.updateUserById).toHaveBeenCalledWith(KORISNIK, { password: "907531" });
    expect(server.rpc).toHaveBeenCalledWith("otkljucaj_korisnika", { p_korisnik: KORISNIK });
  });

  it("neispravan novi PIN se odbija prije ikakve izmjene", async () => {
    const r = await izmijeniKorisnika(KORISNIK, "magacioner", undefined, forma({ ime: "Amra", pin: "111111" }));
    expect(r?.greska).toMatch(/jednostavan/);
    expect(server.rpc).not.toHaveBeenCalled();
    expect(adminAuth.updateUserById).not.toHaveBeenCalled();
  });

  it("osoblje objekta: objekat je obavezan", async () => {
    expect((await izmijeniKorisnika(KORISNIK, "objekat", undefined, forma({ ime: "Osoblje" })))?.greska).toMatch(/objekat/);
    await expect(izmijeniKorisnika(KORISNIK, "objekat", undefined, forma({ ime: "Osoblje", objekat: OBJEKAT }))).rejects.toThrow("REDIRECT");
    expect(server.rpc).toHaveBeenCalledWith("izmijeni_korisnika", { p_id: KORISNIK, p_ime: "Osoblje", p_objekat: OBJEKAT });
  });

  it("menadžer: nova lozinka mora imati 8 znakova", async () => {
    expect((await izmijeniKorisnika(KORISNIK, "menadzer", undefined, forma({ ime: "Šef", lozinka: "kratka" })))?.greska).toMatch(/8 znakova/);
    await expect(izmijeniKorisnika(KORISNIK, "menadzer", undefined, forma({ ime: "Šef", lozinka: "dovoljno-duga" }))).rejects.toThrow("REDIRECT");
    expect(adminAuth.updateUserById).toHaveBeenCalledWith(KORISNIK, { password: "dovoljno-duga" });
  });

  it("greška baze (ime zauzeto) se prikazuje i PIN se ne mijenja", async () => {
    server.rpc.mockResolvedValue({ error: { code: "23505", message: "Korisnik s tim imenom već postoji" } });
    const r = await izmijeniKorisnika(KORISNIK, "magacioner", undefined, forma({ ime: "Sead", pin: "907531" }));
    expect(r).toEqual({ greska: "Korisnik s tim imenom već postoji" });
    expect(adminAuth.updateUserById).not.toHaveBeenCalled();
  });

  it("ako promjena PIN-a ne uspije, javlja da je ime sačuvano", async () => {
    adminAuth.updateUserById.mockResolvedValue({ error: { message: "x" } });
    const r = await izmijeniKorisnika(KORISNIK, "magacioner", undefined, forma({ ime: "Amra", pin: "907531" }));
    expect(r?.greska).toMatch(/Ime je sačuvano, ali PIN nije promijenjen/);
  });
});

describe("isključivanje i otključavanje", () => {
  it("isključuje i uključuje korisnika kroz funkciju u bazi", async () => {
    await promijeniAktivnostKorisnika(KORISNIK, false);
    expect(server.rpc).toHaveBeenCalledWith("postavi_aktivnost_korisnika", { p_id: KORISNIK, p_aktivan: false });
    await promijeniAktivnostKorisnika(KORISNIK, true);
    expect(server.rpc).toHaveBeenLastCalledWith("postavi_aktivnost_korisnika", { p_id: KORISNIK, p_aktivan: true });
  });

  it("odbijanje baze (npr. isključivanje samog sebe) se prijavljuje", async () => {
    server.rpc.mockResolvedValue({ error: { code: "22023", message: "Ne možete isključiti sami sebe" } });
    await expect(promijeniAktivnostKorisnika(KORISNIK, false)).rejects.toThrow("Ne možete isključiti sami sebe");
  });

  it("otključava račun", async () => {
    await otkljucajKorisnika(KORISNIK);
    expect(server.rpc).toHaveBeenCalledWith("otkljucaj_korisnika", { p_korisnik: KORISNIK });
  });

  it("neispravan identifikator se ignoriše", async () => {
    await promijeniAktivnostKorisnika("nije-id", false);
    await otkljucajKorisnika("nije-id");
    expect(server.rpc).not.toHaveBeenCalled();
  });
});
