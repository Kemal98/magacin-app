// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { NabavkaDobavljac, NabavkaPregled, datumTekst, kadaTekst, ucestalost } from "../../app/_components/nabavka-prikaz";
import type { ArtikalDobavljaca, DobavljacNabavka, Isporuka } from "../../lib/nabavka-tipovi";
import { danasSarajevo } from "../../lib/period";

afterEach(cleanup);

describe("pomoćni tekstovi", () => {
  it("kada je bilo", () => {
    expect(kadaTekst("2026-09-25", "2026-09-25")).toBe("danas");
    expect(kadaTekst("2026-09-24", "2026-09-25")).toBe("jučer");
    expect(kadaTekst("2026-09-15", "2026-09-25")).toBe("prije 10 dana");
  });

  it("datum u našem zapisu", () => {
    expect(datumTekst("2026-09-05")).toBe("5. 9. 2026.");
    expect(datumTekst("2026-12-31T10:00:00")).toBe("31. 12. 2026.");
  });

  it("učestalost dolaska", () => {
    expect(ucestalost(null)).toMatch(/premalo isporuka/);
    expect(ucestalost(5)).toBe("u prosjeku svakih 5 dana");
    expect(ucestalost(1)).toBe("u prosjeku svakih 1 dan");
    expect(ucestalost(4.55)).toBe("u prosjeku svakih 4,6 dana");
  });
});

const danas = danasSarajevo();
const d = (p: Partial<DobavljacNabavka> & { dobavljac_id: string; naziv: string }): DobavljacNabavka => ({
  aktivan: true, broj_isporuka: 3, ukupna_vrijednost: 300, prosjecna_vrijednost: 100, prosjecan_razmak_dana: 5,
  zadnja_isporuka: danas, stornirano: 0, ...p,
});

describe("pregled nabavke po dobavljačima", () => {
  const redovi = [
    d({ dobavljac_id: "a", naziv: "Pekara Mlin", ukupna_vrijednost: 1200.5, broj_isporuka: 6, prosjecan_razmak_dana: 3.5 }),
    d({ dobavljac_id: "b", naziv: "Mesnica Gora", broj_isporuka: 0, ukupna_vrijednost: 0, prosjecan_razmak_dana: null, zadnja_isporuka: null }),
    d({ dobavljac_id: "c", naziv: "Šećerana", aktivan: false, stornirano: 2 }),
  ];

  it("pokazuje ukupnu nabavku, broj isporuka i koliko dobavljača je isporučivalo", () => {
    render(<NabavkaPregled osnova="/menadzer/nabavka" redovi={redovi} od="2026-06-28" do="2026-09-25" />);
    expect(screen.getByText("1.500,50 KM")).toBeTruthy(); // 1200,50 + 0 + 300
    expect(screen.getByText("9 isporuka, 2 dobavljača je isporučivalo")).toBeTruthy();
  });

  it("za svakog dobavljača: učestalost, zadnja isporuka i vrijednost", () => {
    render(<NabavkaPregled osnova="/menadzer/nabavka" redovi={redovi} od="2026-06-28" do="2026-09-25" />);
    const mlin = screen.getByText("Pekara Mlin").closest("li")!;
    expect(within(mlin).getByText(/6 isporuka, u prosjeku svakih 3,5 dana/)).toBeTruthy();
    expect(within(mlin).getByText(/danas/)).toBeTruthy();
    const mesnica = screen.getByText("Mesnica Gora").closest("li")!;
    expect(within(mesnica).getByText("Nije isporučivao u ovom periodu")).toBeTruthy();
    expect(within(mesnica).getByText("Još nikad nije isporučio")).toBeTruthy();
    const secerana = screen.getByText("Šećerana").closest("li")!;
    expect(secerana.textContent).toMatch(/isključen/);
    expect(secerana.textContent).toMatch(/poništenih: 2/);
  });

  it("veza vodi na dobavljača i zadržava period", () => {
    render(<NabavkaPregled osnova="/magacin/nabavka" redovi={redovi} od="2026-06-28" do="2026-09-25" />);
    expect(screen.getByText("Pekara Mlin").closest("a")!.getAttribute("href")).toBe("/magacin/nabavka/a?od=2026-06-28&do=2026-09-25");
  });

  it("ima izvoz u Excel s istim periodom i pretragu po nazivu (bez kvačica)", async () => {
    const u = userEvent.setup();
    render(<NabavkaPregled osnova="/menadzer/nabavka" redovi={redovi} od="2026-06-28" do="2026-09-25" />);
    expect(screen.getByRole("link", { name: "Izvezi u Excel" }).getAttribute("href")).toBe("/izvoz/nabavka?od=2026-06-28&do=2026-09-25");
    await u.type(screen.getByLabelText("Traži dobavljača…"), "secerana");
    expect((screen.getByText("Šećerana").closest("li") as HTMLElement).hidden).toBe(false);
    expect((screen.getByText("Pekara Mlin").closest("li") as HTMLElement).hidden).toBe(true);
  });
});

const isporuke: Isporuka[] = [
  {
    id: "i1", datum_isporuke: "2026-09-24", vrijeme: "2026-09-25T08:30:00+02:00", dokument: "OTP-1", napomena: "Došlo kamionom",
    ime: "Amra", vrijednost: 40, razmak_dana: 5, stornirano: false, storno_razlog: null, storno_ime: null, storno_vrijeme: null,
    stavke: [
      { artikal: "Brašno", mjera: "kg", kolicina: 30, cijena: 1, vrijednost: 30, pakovanje: "vreća", kolicina_pakovanja: 1.2 },
      { artikal: "Kvasac", mjera: "kg", kolicina: 2, cijena: 5, vrijednost: 10, pakovanje: null, kolicina_pakovanja: null },
    ],
  },
  {
    id: "i2", datum_isporuke: "2026-09-19", vrijeme: "2026-09-19T09:00:00+02:00", dokument: null, napomena: null,
    ime: "Amra", vrijednost: 99, razmak_dana: null, stornirano: true, storno_razlog: "Uneseno dvaput", storno_ime: "Šef", storno_vrijeme: "2026-09-20T10:00:00+02:00",
    stavke: [{ artikal: "Sol", mjera: "kg", kolicina: 99, cijena: 1, vrijednost: 99, pakovanje: null, kolicina_pakovanja: null }],
  },
];
const artikli: ArtikalDobavljaca[] = [
  { artikal_id: "a1", artikal: "Brašno", mjera: "kg", broj_isporuka: 2, kolicina: 60, vrijednost: 55, zadnja_cijena: 1, najnizja_cijena: 0.9, najvisa_cijena: 1.1, prosjecna_cijena: 0.9167, zadnja_isporuka: "2026-09-24" },
  { artikal_id: "a2", artikal: "Kvasac", mjera: "kg", broj_isporuka: 1, kolicina: 2, vrijednost: 10, zadnja_cijena: 5, najnizja_cijena: 5, najvisa_cijena: 5, prosjecna_cijena: 5, zadnja_isporuka: "2026-09-24" },
];

describe("nabavka jednog dobavljača", () => {
  const prikazi = () =>
    render(
      <NabavkaDobavljac
        osnova="/menadzer/nabavka"
        id="a"
        dobavljac={d({ dobavljac_id: "a", naziv: "Pekara Mlin", broj_isporuka: 2, ukupna_vrijednost: 55, prosjecan_razmak_dana: 5, zadnja_isporuka: "2026-09-24" })}
        isporuke={isporuke}
        artikli={artikli}
        od="2026-06-28"
        do="2026-09-25"
      />,
    );

  it("brojke: isporuke, vrijednost, koliko često dolazi i zadnja isporuka", () => {
    prikazi();
    expect(screen.getByText("Isporuka u periodu")).toBeTruthy();
    expect(screen.getAllByText("55,00 KM").length).toBeGreaterThan(0); // brojka i red artikla
    expect(screen.getByText("svakih 5 dana")).toBeTruthy();
    expect(screen.getAllByText("24. 9. 2026.").length).toBeGreaterThan(0); // brojka i datum isporuke
  });

  it("artikli: zadnja, najniža, najviša i prosječna cijena", () => {
    prikazi();
    const red = screen.getByText("Brašno", { selector: "td" }).closest("tr")!;
    expect(red.textContent).toMatch(/1,00 KM.*0,90 KM.*1,10 KM.*0,92 KM/);
  });

  it("isporuka: dokument, primalac, napomena, stavke s pakovanjem i razmak od prethodne", () => {
    prikazi();
    const i = screen.getByText(/OTP-1/).closest("li")!;
    expect(i.textContent).toMatch(/primio: Amra/);
    expect(i.textContent).toMatch(/5 dana poslije prethodne isporuke/);
    expect(i.textContent).toMatch(/Napomena: Došlo kamionom/);
    expect(i.textContent).toMatch(/Brašno: 30 kg \(1,2 vreća\) po 1,00 KM\/kg = 30,00 KM/);
    expect(i.textContent).toMatch(/Kvasac: 2 kg po 5,00 KM\/kg = 10,00 KM/);
  });

  it("poništena isporuka je vidljiva s oznakom, razlogom i imenom", () => {
    prikazi();
    const i = screen.getByText(/PONIŠTENO: Uneseno dvaput/).closest("li")!;
    expect(i.textContent).toMatch(/Šef/);
    expect(i.textContent).toMatch(/Sol: 99 kg/);
  });

  it("pretraga isporuka po artiklu, dokumentu ili napomeni", async () => {
    const u = userEvent.setup();
    prikazi();
    await u.type(screen.getByLabelText("Traži artikal, broj otpremnice, napomenu, osobu…"), "kamionom");
    expect((screen.getByText(/OTP-1/).closest("li") as HTMLElement).hidden).toBe(false);
    expect((screen.getByText(/PONIŠTENO/).closest("li") as HTMLElement).hidden).toBe(true);
  });

  it("izvoz je za ovog dobavljača", () => {
    prikazi();
    expect(screen.getByRole("link", { name: "Izvezi u Excel" }).getAttribute("href")).toBe(
      "/izvoz/nabavka?od=2026-06-28&do=2026-09-25&dobavljac=a",
    );
  });
});
