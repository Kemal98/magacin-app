// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const snimljeno = vi.fn();
vi.mock("@/app/actions/popis-objekta", () => ({
  sacuvajPopis: async (objekatId: string, _s: unknown, forma: FormData) => {
    snimljeno(objekatId, forma.getAll("artikal"));
    return undefined;
  },
  predloziIzExcela: async () => ({
    prijedlog: {
      brojUtrosaka: 7,
      nepoznati: ["Stari sok"],
      artikli: [
        { id: "b", naziv: "Bravo", brojUtrosaka: 5 },
        { id: "c", naziv: "Citro", brojUtrosaka: 2 },
      ],
    },
  }),
}));

import { PopisArtikala } from "../../app/menadzer/objekti/[id]/artikli/popis-artikala";

const artikli = [
  { id: "a", naziv: "Alfa", mjera: "kg", vrsta: "prehrana" },
  { id: "b", naziv: "Bravo", mjera: "l", vrsta: "prehrana" },
  { id: "c", naziv: "Citro", mjera: "kom", vrsta: "materijal" },
];

afterEach(() => {
  cleanup();
  snimljeno.mockClear();
});

describe("popis artikala objekta", () => {
  it("prikazuje ranije zadane artikle kao označene", () => {
    render(<PopisArtikala objekatId="obj" artikli={artikli} izabrani={["a"]} />);
    expect(screen.getByText("Na popisu: 1 artikala")).toBeTruthy();
    expect((screen.getByLabelText(/Alfa/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Bravo/) as HTMLInputElement).checked).toBe(false);
  });

  it("dodavanje i uklanjanje artikla mijenja ono što se snima", async () => {
    const u = userEvent.setup();
    render(<PopisArtikala objekatId="obj" artikli={artikli} izabrani={["a"]} />);
    await u.click(screen.getByLabelText(/Bravo/)); // dodaj
    await u.click(screen.getByLabelText(/Alfa/)); // ukloni
    await u.click(screen.getByRole("button", { name: "Snimi popis" }));
    expect(snimljeno).toHaveBeenCalledWith("obj", ["b"]);
  });

  it("pretraga skriva artikle, ali skriveni označeni ostaju na popisu", async () => {
    const u = userEvent.setup();
    render(<PopisArtikala objekatId="obj" artikli={artikli} izabrani={["a"]} />);
    await u.type(screen.getByLabelText("Traži artikal"), "cit");
    expect(screen.queryByLabelText(/Alfa/)).toBeNull();
    await u.click(screen.getByLabelText(/Citro/));
    await u.click(screen.getByRole("button", { name: "Snimi popis" }));
    expect(snimljeno.mock.calls[0][1].sort()).toEqual(["a", "c"]);
  });

  it("prijedlog iz Excela može zamijeniti popis", async () => {
    const u = userEvent.setup();
    render(<PopisArtikala objekatId="obj" artikli={artikli} izabrani={["a"]} />);
    await u.click(screen.getByRole("button", { name: "Nađi prijedlog" }));
    expect(await screen.findByText(/7 utrošaka u 2 različitih artikala/)).toBeTruthy();
    expect(screen.getByText(/Stari sok/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Zamijeni popis prijedlogom" }));
    expect(screen.getByText("Na popisu: 2 artikala")).toBeTruthy();
    expect((screen.getByLabelText(/Alfa/) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("5 utrošaka")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Snimi popis" }));
    expect(snimljeno.mock.calls[0][1].sort()).toEqual(["b", "c"]);
  });

  it("prijedlog se može i dodati na postojeći popis", async () => {
    const u = userEvent.setup();
    render(<PopisArtikala objekatId="obj" artikli={artikli} izabrani={["a"]} />);
    await u.click(screen.getByRole("button", { name: "Nađi prijedlog" }));
    await u.click(await screen.findByRole("button", { name: "Dodaj prijedlog na popis" }));
    expect(screen.getByText("Na popisu: 3 artikala")).toBeTruthy();
  });
});
