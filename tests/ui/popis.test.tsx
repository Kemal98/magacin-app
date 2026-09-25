// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PopisMagacina, RedPregleda } from "../../lib/popis-tipovi";

const pregledano = vi.fn();
const potvrdjeno = vi.fn();
let odgovorPregleda: { redovi: RedPregleda[] } | { greska: string } = { redovi: [] };

vi.mock("@/app/actions/popis", () => ({
  pregledajPopis: async (_s: unknown, f: FormData) => {
    pregledano(Object.fromEntries([...f.entries()]));
    return odgovorPregleda;
  },
  potvrdiPopis: async (_s: unknown, f: FormData) => {
    potvrdjeno(Object.fromEntries([...f.entries()]));
    return undefined;
  },
}));
vi.mock("@/app/_components/kamera-skener", () => ({
  KameraSkener: ({ onKod, onZatvori }: { onKod: (k: string) => void; onZatvori: () => void }) => (
    <div role="dialog">
      <button type="button" onClick={() => { onKod("3850001"); onZatvori(); }}>lažni-sken</button>
    </div>
  ),
}));

import { PopisiPrikaz } from "../../app/_components/popisi-prikaz";
import { PopisForma } from "../../app/magacin/popis/popis-forma";

const A1 = "11111111-1111-4111-8111-111111111111";
const A2 = "33333333-3333-4333-8333-333333333333";
const artikli = [
  { id: A1, naziv: "Kafa", mjera: "kg", bar_kod: "3850001", pakovanja: [] },
  { id: A2, naziv: "Mlijeko", mjera: "l", bar_kod: null, pakovanja: [] },
];
const red = (p: Partial<RedPregleda> & { artikal_id: string; naziv: string }): RedPregleda => ({
  mjera: "kg", sistem: 10, brojano: 8, razlika: -2, cijena: 4, vrijednost_razlike: -8, treba_cijenu: false, ...p,
});

afterEach(() => {
  cleanup();
  pregledano.mockClear();
  potvrdjeno.mockClear();
});

describe("popis: brojanje", () => {
  it("dugme za pregled je isključeno dok ništa nije izbrojano", () => {
    render(<PopisForma artikli={artikli} />);
    expect((screen.getByRole("button", { name: "Pregled razlika" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("skeniranje bar koda pronalazi artikal i prebacuje fokus na izbrojanu količinu, bez slanja forme", async () => {
    const u = userEvent.setup();
    render(<PopisForma artikli={artikli} />);
    await u.click(screen.getByLabelText("Skenirajte bar kod"));
    await u.keyboard("3850001{Enter}");
    await waitFor(() => expect(document.activeElement?.id).toBe(`brojano-${A1}`));
    expect(pregledano).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Izbrojano Mlijeko")).toBeNull(); // lista je sužena na pronađeni artikal
  });

  it("nepoznat bar kod javlja da nije pronađen", async () => {
    const u = userEvent.setup();
    render(<PopisForma artikli={artikli} />);
    await u.click(screen.getByLabelText("Skenirajte bar kod"));
    await u.keyboard("9999999999{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/Bar kod 9999999999 nije pronađen/);
  });

  it("sistemsko stanje se ne prikazuje tokom brojanja", () => {
    render(<PopisForma artikli={artikli} />);
    expect(screen.queryByText(/sistem/i)).toBeNull();
  });

  it("šalje samo artikle koji su izbrojani", async () => {
    const u = userEvent.setup();
    odgovorPregleda = { redovi: [red({ artikal_id: A1, naziv: "Kafa" })] };
    render(<PopisForma artikli={artikli} />);
    await u.type(screen.getByLabelText("Izbrojano Kafa"), "8");
    expect(screen.getByText("Izbrojano artikala: 1")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Pregled razlika" }));
    await screen.findByText("Pregled razlika");
    expect(pregledano).toHaveBeenCalledWith({ [`brojano_${A1}`]: "8", [`brojano_${A2}`]: "" });
  });
});

describe("popis: pregled razlika i potvrda", () => {
  const izbroji = async (u: ReturnType<typeof userEvent.setup>) => {
    await u.type(screen.getByLabelText("Izbrojano Kafa"), "8");
    await u.type(screen.getByLabelText("Izbrojano Mlijeko"), "30");
    await u.click(screen.getByRole("button", { name: "Pregled razlika" }));
    await screen.findByText(/Ništa još nije upisano/);
  };

  it("prikazuje sistem, brojano, razliku i vrijednost, i ništa ne upisuje", async () => {
    const u = userEvent.setup();
    odgovorPregleda = {
      redovi: [
        red({ artikal_id: A1, naziv: "Kafa" }),
        red({ artikal_id: A2, naziv: "Mlijeko", mjera: "l", sistem: 20, brojano: 30, razlika: 10, cijena: 1.5, vrijednost_razlike: 15 }),
      ],
    };
    render(<PopisForma artikli={artikli} />);
    await izbroji(u);
    const kafa = screen.getByText("Kafa").closest("tr")!;
    expect(within(kafa).getByText(/-2 kg/)).toBeTruthy();
    expect(within(kafa).getByText("-8,00 KM")).toBeTruthy();
    const mlijeko = screen.getByText("Mlijeko").closest("tr")!;
    expect(within(mlijeko).getByText(/\+10 l/)).toBeTruthy();
    expect(screen.getByText("7,00 KM")).toBeTruthy(); // ukupno: -8 + 15
    expect(potvrdjeno).not.toHaveBeenCalled();
  });

  it("potvrda šalje brojano i stanje viđeno u pregledu", async () => {
    const u = userEvent.setup();
    odgovorPregleda = { redovi: [red({ artikal_id: A1, naziv: "Kafa" }), red({ artikal_id: A2, naziv: "Mlijeko", mjera: "l", sistem: 20, brojano: 30, razlika: 10 })] };
    render(<PopisForma artikli={artikli} />);
    await izbroji(u);
    await u.click(screen.getByRole("button", { name: "Potvrdi popis i uskladi stanje" }));
    expect(potvrdjeno).toHaveBeenCalledWith(
      expect.objectContaining({
        [`brojano_${A1}`]: "8", [`sistem_${A1}`]: "10",
        [`brojano_${A2}`]: "30", [`sistem_${A2}`]: "20",
      }),
    );
  });

  it("višak bez poznate cijene traži cijenu prije potvrde", async () => {
    const u = userEvent.setup();
    odgovorPregleda = { redovi: [red({ artikal_id: A1, naziv: "Kafa", sistem: 0, brojano: 8, razlika: 8, cijena: null, vrijednost_razlike: 0, treba_cijenu: true })] };
    render(<PopisForma artikli={artikli} />);
    await u.type(screen.getByLabelText("Izbrojano Kafa"), "8");
    await u.click(screen.getByRole("button", { name: "Pregled razlika" }));
    await screen.findByText(/nema poznate cijene/);
    await u.click(screen.getByRole("button", { name: "Potvrdi popis i uskladi stanje" }));
    expect(potvrdjeno).not.toHaveBeenCalled(); // cijena je obavezna
    await u.type(screen.getByLabelText("Cijena za Kafa"), "2,5");
    await u.click(screen.getByLabelText(/početno stanje/));
    await u.click(screen.getByRole("button", { name: "Potvrdi popis i uskladi stanje" }));
    expect(potvrdjeno).toHaveBeenCalledWith(expect.objectContaining({ [`cijena_${A1}`]: "2,5", pocetno: "on" }));
  });

  it("nazad na brojanje čuva unesene količine", async () => {
    const u = userEvent.setup();
    odgovorPregleda = { redovi: [red({ artikal_id: A1, naziv: "Kafa" })] };
    render(<PopisForma artikli={artikli} />);
    await u.type(screen.getByLabelText("Izbrojano Kafa"), "8");
    await u.click(screen.getByRole("button", { name: "Pregled razlika" }));
    await screen.findByText(/Ništa još nije upisano/);
    await u.click(screen.getByRole("button", { name: "Nazad na brojanje" }));
    expect((screen.getByLabelText("Izbrojano Kafa") as HTMLInputElement).value).toBe("8");
  });

  it("greška iz pregleda se prikazuje i ostaje se na brojanju", async () => {
    const u = userEvent.setup();
    odgovorPregleda = { greska: "Izbrojana količina mora biti broj, nula ili veći." };
    render(<PopisForma artikli={artikli} />);
    await u.type(screen.getByLabelText("Izbrojano Kafa"), "x");
    await u.click(screen.getByRole("button", { name: "Pregled razlika" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/mora biti broj/);
    expect(screen.getByLabelText("Izbrojano Kafa")).toBeTruthy();
  });
});

describe("prikaz popisa (menadžer)", () => {
  const popis: PopisMagacina = {
    id: "p1",
    vrijeme: new Date().toISOString(),
    ime: "Amra",
    pocetno: true,
    vrijednost_razlike: -8,
    stavke: [
      { artikal: "Kafa", mjera: "kg", sistem: 10, brojano: 8, razlika: -2, cijena: 4, vrijednost_razlike: -8 },
      { artikal: "Čaj", mjera: "kom", sistem: 5, brojano: 5, razlika: 0, cijena: 1, vrijednost_razlike: 0 },
    ],
  };

  it("prikazuje ko je popisivao, razlike i vrijednost, a artikle bez razlike ne izlistava", () => {
    render(<PopisiPrikaz popisi={[popis]} />);
    expect(screen.getByText(/Popisao: Amra/)).toBeTruthy();
    expect(screen.getByText("početno stanje")).toBeTruthy();
    expect(screen.getByText(/-2 kg/)).toBeTruthy();
    expect(screen.queryByText("Čaj")).toBeNull();
    expect(screen.getByText(/Razlika: -8,00 KM/)).toBeTruthy();
  });

  it("bez razlika javlja da se stanje poklapalo", () => {
    render(<PopisiPrikaz popisi={[{ ...popis, pocetno: false, vrijednost_razlike: 0, stavke: [popis.stavke[1]] }]} />);
    expect(screen.getByText(/nije bilo razlika/)).toBeTruthy();
  });

  it("bez popisa javlja da ih još nema", () => {
    render(<PopisiPrikaz popisi={[]} />);
    expect(screen.getByText("Još nema popisa.")).toBeTruthy();
  });
});
