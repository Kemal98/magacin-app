// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Otpis } from "../../lib/otpis";

const otpisano = vi.fn();
vi.mock("@/app/actions/otpis", () => ({
  otpisiRobu: async (_s: unknown, f: FormData) => {
    otpisano(Object.fromEntries([...f.entries()]));
    return undefined;
  },
}));
vi.mock("@/app/_components/kamera-skener", () => ({
  KameraSkener: ({ onKod, onZatvori }: { onKod: (k: string) => void; onZatvori: () => void }) => (
    <div role="dialog">
      <button type="button" onClick={() => { onKod("3850099"); onZatvori(); }}>lažni-sken</button>
    </div>
  ),
}));

import { OtpisiPrikaz } from "../../app/_components/otpis-prikaz";
import { OtpisForma } from "../../app/magacin/otpis/otpis-forma";

const artikli = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    naziv: "Kafa",
    mjera: "kg",
    bar_kod: "3850001",
    naStanju: 25,
    pakovanja: [{ id: "22222222-2222-4222-8222-222222222222", naziv: "kutija", faktor: 10, bar_kod: "3850099" }],
  },
  { id: "33333333-3333-4333-8333-333333333333", naziv: "Mlijeko", mjera: "l", bar_kod: null, naStanju: 4, pakovanja: [] },
];

afterEach(() => {
  cleanup();
  otpisano.mockClear();
});

const polje = () => screen.getByLabelText(/Artikal: skenirajte/) as HTMLInputElement;

describe("otpis magacina: forma", () => {
  it("skeniranje bar koda popunjava artikal i prikazuje stanje magacina", async () => {
    const u = userEvent.setup();
    render(<OtpisForma artikli={artikli} />);
    await u.click(polje());
    await u.keyboard("3850001{Enter}");
    expect(polje().value).toBe("Kafa");
    expect(screen.getByText(/25 kg/)).toBeTruthy();
    expect(otpisano).not.toHaveBeenCalled(); // Enter ne šalje formu
  });

  it("nepoznat bar kod javlja da nije pronađen", async () => {
    const u = userEvent.setup();
    render(<OtpisForma artikli={artikli} />);
    await u.click(polje());
    await u.keyboard("9999999999{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/Bar kod 9999999999 nije pronađen/);
  });

  it("dugme je isključeno dok artikal nije izabran", () => {
    render(<OtpisForma artikli={artikli} />);
    expect((screen.getByRole("button", { name: "Otpiši robu" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("šalje artikal, količinu i razlog iz brzog dugmeta", async () => {
    const u = userEvent.setup();
    render(<OtpisForma artikli={artikli} />);
    await u.type(polje(), "Mlijeko");
    await u.type(screen.getByLabelText("Količina"), "2");
    await u.click(screen.getByRole("button", { name: "Pokvareno" }));
    await u.click(screen.getByRole("button", { name: "Otpiši robu" }));
    expect(otpisano).toHaveBeenCalledWith({
      artikal: "33333333-3333-4333-8333-333333333333",
      pakovanje: "",
      kolicina: "2",
      razlog: "Pokvareno",
    });
  });

  it("bar kod pakovanja bira pakovanje, a preračun se poredi sa stanjem", async () => {
    const u = userEvent.setup();
    render(<OtpisForma artikli={artikli} />);
    await u.click(screen.getByRole("button", { name: "Kamera" }));
    await u.click(screen.getByText("lažni-sken"));
    expect((screen.getByLabelText("Jedinica") as HTMLSelectElement).value).toBe("22222222-2222-4222-8222-222222222222");
    await u.type(screen.getByLabelText("Količina"), "3"); // 3 × 10 kg = 30 > 25
    expect(screen.getByRole("alert").textContent).toMatch(/Na stanju je samo 25 kg, a otpisujete 30 kg/);
    expect((screen.getByRole("button", { name: "Otpiši robu" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("otpis iznad stanja ne može se poslati, a u granicama može", async () => {
    const u = userEvent.setup();
    render(<OtpisForma artikli={artikli} />);
    await u.type(polje(), "Mlijeko");
    const kol = screen.getByLabelText("Količina");
    await u.type(kol, "5");
    expect((screen.getByRole("button", { name: "Otpiši robu" }) as HTMLButtonElement).disabled).toBe(true);
    await u.clear(kol);
    await u.type(kol, "4");
    await u.type(screen.getByLabelText("Razlog (obavezno)"), "Isteklo");
    expect((screen.getByRole("button", { name: "Otpiši robu" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("otpis magacina: prikaz", () => {
  const otpisi: Otpis[] = [
    { vrijeme: new Date().toISOString(), artikal: "Mlijeko", mjera: "l", kolicina: 3, razlog: "Isteklo", cijena: 1.5, vrijednost: 4.5, ime: "Amra" },
  ];

  it("prikazuje razlog, vrijednost, ime osobe i cijenu", () => {
    render(<OtpisiPrikaz otpisi={otpisi} />);
    expect(screen.getByText(/Mlijeko: 3 l/)).toBeTruthy();
    expect(screen.getByText(/Razlog: Isteklo/)).toBeTruthy();
    expect(screen.getByText("4,50 KM")).toBeTruthy();
    expect(screen.getByText(/Amra/)).toBeTruthy();
  });

  it("bez otpisa javlja da ih još nema", () => {
    render(<OtpisiPrikaz otpisi={[]} />);
    expect(screen.getByText("Još nema otpisa.")).toBeTruthy();
  });
});
