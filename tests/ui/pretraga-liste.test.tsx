// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { PretragaListe } from "../../app/_components/pretraga-liste";

afterEach(cleanup);

const vidljivo = (tekst: string) => {
  const el = screen.getByText(tekst).closest("[data-red]") as HTMLElement;
  return !el.hidden && el.style.display !== "none";
};

function Lista() {
  return (
    <PretragaListe placeholder="Traži artikal">
      <ul>
        <li data-red>Šećer u kockama</li>
        <li data-red>Kafa bosanska</li>
        <li data-red>Čaj menta</li>
      </ul>
    </PretragaListe>
  );
}

describe("pretraga po listi", () => {
  it("bez upita su svi redovi vidljivi i nema poruke", () => {
    render(<Lista />);
    expect(vidljivo("Šećer u kockama")).toBe(true);
    expect(vidljivo("Kafa bosanska")).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("upit sakriva redove koji se ne poklapaju i javlja koliko je prikazano", async () => {
    const u = userEvent.setup();
    render(<Lista />);
    await u.type(screen.getByLabelText("Traži artikal"), "kafa");
    expect(vidljivo("Kafa bosanska")).toBe(true);
    expect(vidljivo("Šećer u kockama")).toBe(false);
    expect(vidljivo("Čaj menta")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("Prikazano 1 od 3");
  });

  it("ne pravi razliku između slova s kvačicama i bez njih", async () => {
    const u = userEvent.setup();
    render(<Lista />);
    await u.type(screen.getByLabelText("Traži artikal"), "secer");
    expect(vidljivo("Šećer u kockama")).toBe(true);
    await u.clear(screen.getByLabelText("Traži artikal"));
    await u.type(screen.getByLabelText("Traži artikal"), "CAJ");
    expect(vidljivo("Čaj menta")).toBe(true);
    expect(vidljivo("Kafa bosanska")).toBe(false);
  });

  it("nema rezultata: jasna poruka", async () => {
    const u = userEvent.setup();
    render(<Lista />);
    await u.type(screen.getByLabelText("Traži artikal"), "banana");
    expect(screen.getByRole("status").textContent).toBe("Nema rezultata za ovu pretragu.");
  });

  it("dugme Očisti vraća sve redove", async () => {
    const u = userEvent.setup();
    render(<Lista />);
    await u.type(screen.getByLabelText("Traži artikal"), "kafa");
    await u.click(screen.getByRole("button", { name: "Očisti" }));
    expect(vidljivo("Šećer u kockama")).toBe(true);
    expect((screen.getByLabelText("Traži artikal") as HTMLInputElement).value).toBe("");
  });

  it("radi i nad tabelom", async () => {
    const u = userEvent.setup();
    render(
      <PretragaListe placeholder="Traži">
        <table>
          <tbody>
            <tr data-red><td>Kafa</td><td>12,50 KM</td></tr>
            <tr data-red><td>Mlijeko</td><td>1,50 KM</td></tr>
          </tbody>
        </table>
      </PretragaListe>,
    );
    await u.type(screen.getByLabelText("Traži"), "1,50");
    expect((screen.getByText("Mlijeko").closest("tr") as HTMLElement).hidden).toBe(false);
    expect((screen.getByText("Kafa").closest("tr") as HTMLElement).hidden).toBe(true);
  });

  it("za redove s poljima za unos traži po data-trazi, a ne po tekstu", async () => {
    const u = userEvent.setup();
    render(
      <PretragaListe placeholder="Traži">
        <ul>
          <li data-red data-trazi="Kuhinja"><input defaultValue="Kuhinja" /><button>Snimi</button></li>
          <li data-red data-trazi="Šank hotel"><input defaultValue="Šank hotel" /><button>Snimi</button></li>
        </ul>
      </PretragaListe>,
    );
    await u.type(screen.getByLabelText("Traži"), "sank");
    const redovi = screen.getAllByRole("listitem", { hidden: true });
    expect(redovi[0].hidden).toBe(true);
    expect(redovi[1].hidden).toBe(false);
  });

  it("odjeljak (grupa) se sakriva kad u njemu nema nijednog vidljivog reda", async () => {
    const u = userEvent.setup();
    render(
      <PretragaListe placeholder="Traži" grupa="[data-grupa]">
        <section data-grupa>
          <h3>ŠANK</h3>
          <ul><li data-red>Kafa</li></ul>
        </section>
        <section data-grupa>
          <h3>KUHINJA</h3>
          <ul><li data-red>Brašno</li></ul>
        </section>
      </PretragaListe>,
    );
    await u.type(screen.getByLabelText("Traži"), "brasno");
    expect((screen.getByText("ŠANK").closest("section") as HTMLElement).hidden).toBe(true);
    expect((screen.getByText("KUHINJA").closest("section") as HTMLElement).hidden).toBe(false);
  });

  it("Enter u polju za pretragu ne šalje formu na stranici", async () => {
    const u = userEvent.setup();
    let poslano = false;
    render(
      <form onSubmit={(e) => { e.preventDefault(); poslano = true; }}>
        <PretragaListe placeholder="Traži"><ul><li data-red>Kafa</li></ul></PretragaListe>
        <button type="submit">Pošalji</button>
      </form>,
    );
    await u.type(screen.getByLabelText("Traži"), "kafa{Enter}");
    expect(poslano).toBe(false);
  });

  it("novi redovi koji stignu poslije osvježavanja se također filtriraju", async () => {
    const u = userEvent.setup();
    const { container } = render(<Lista />);
    await u.type(screen.getByLabelText("Traži artikal"), "kafa");
    await act(async () => {
      const novi = document.createElement("li");
      novi.setAttribute("data-red", "");
      novi.textContent = "Mlijeko 2,8";
      container.querySelector("ul")!.appendChild(novi);
      await Promise.resolve();
    });
    expect(vidljivo("Mlijeko 2,8")).toBe(false); // ne poklapa se s "kafa"
    expect(screen.getByRole("status").textContent).toBe("Prikazano 1 od 4");
  });
});
