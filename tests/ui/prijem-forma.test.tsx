// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtikalZaUnos } from "../../lib/bar-kod";

const posalji = vi.fn();
vi.mock("@/app/actions/prijem", () => ({
  unesiPrijem: async (_s: unknown, forma: FormData) => {
    posalji(Object.fromEntries([...forma.entries()]), forma.getAll("artikal"));
    return undefined;
  },
}));
vi.mock("@/app/_components/kamera-skener", () => ({
  KameraSkener: ({ onKod, onZatvori }: { onKod: (k: string) => void; onZatvori: () => void }) => (
    <div role="dialog">
      <button onClick={() => { onKod("3850099"); onZatvori(); }}>lažni-sken-pakovanja</button>
    </div>
  ),
}));

import { PrijemForma } from "../../app/magacin/prijem/prijem-forma";

const artikli: ArtikalZaUnos[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    naziv: "Kafa",
    mjera: "kg",
    bar_kod: "3850001",
    pakovanja: [{ id: "22222222-2222-4222-8222-222222222222", naziv: "kutija", faktor: 10, bar_kod: "3850099" }],
  },
  { id: "33333333-3333-4333-8333-333333333333", naziv: "Jabuka", mjera: "kg", bar_kod: null, pakovanja: [] },
];
const dobavljaci = [{ id: "44444444-4444-4444-8444-444444444444", naziv: "Pekara" }];

afterEach(() => {
  cleanup();
  posalji.mockClear();
});

const polje = () => screen.getAllByLabelText(/Artikal:/)[0] as HTMLInputElement;

describe("prijem: unos artikla skenerom", () => {
  it("skeniranje bar koda + Enter popunjava artikal i prelazi na količinu bez slanja forme", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    // Forma je inače spremna za slanje (dobavljač izabran), pa bi Enter u polju poslao prijem.
    await u.selectOptions(screen.getByLabelText("Dobavljač"), dobavljaci[0].id);
    await u.click(polje());
    await u.keyboard("3850001{Enter}");
    expect(polje().value).toBe("Kafa");
    expect(posalji).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("kolicina-0"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("bar kod pakovanja bira i pakovanje", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.click(polje());
    await u.keyboard("3850099{Enter}");
    expect(polje().value).toBe("Kafa");
    const jedinica = screen.getByLabelText("Jedinica") as HTMLSelectElement;
    expect(jedinica.value).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("nepoznat bar kod jasno javlja da nije pronađen", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.click(polje());
    await u.keyboard("9999999999{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/Bar kod 9999999999 nije pronađen/);
  });

  it("artikal bez bar koda se bira upisom naziva", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.type(polje(), "Jabuka");
    expect((screen.getByLabelText("Jedinica") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("nepoznat naziv javlja da artikal nije pronađen", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.click(polje());
    await u.keyboard("Banana{Enter}");
    expect(screen.getByRole("alert").textContent).toMatch(/Artikal nije pronađen/);
  });

  it("kamera kao rezerva popunjava red kao i skener", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.click(screen.getByRole("button", { name: "Kamera" }));
    await u.click(within(screen.getByRole("dialog")).getByText("lažni-sken-pakovanja"));
    expect(polje().value).toBe("Kafa");
    expect((screen.getByLabelText("Jedinica") as HTMLSelectElement).value).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("nakon skeniranja i unosa količine i cijene prikazuje preračun na osnovnu mjeru", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.click(polje());
    await u.keyboard("3850099{Enter}");
    await u.type(screen.getByLabelText("Količina"), "3");
    await u.type(screen.getByLabelText(/Cijena po/), "45");
    expect(screen.getByText(/= 30 kg po 4,50 KM\/kg/)).toBeTruthy();
  });

  it("dodavanje artikla otvara novi red s fokusom u polju za artikal, spreman za sken", async () => {
    const u = userEvent.setup();
    render(<PrijemForma artikli={artikli} dobavljaci={dobavljaci} />);
    await u.click(screen.getByRole("button", { name: "+ Dodaj artikal" }));
    expect(document.activeElement?.id).toBe("artikal-1");
  });
});
