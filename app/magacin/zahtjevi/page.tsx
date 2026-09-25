import { Okvir } from "@/app/_components/okvir";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { RazlikePrikaz } from "@/app/_components/razlike-prikaz";
import { ZahtjevKartica } from "@/app/_components/zahtjev-prikaz";
import { ucitajRazlike } from "@/lib/razlike";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajZahtjeve } from "@/lib/zahtjevi";
import { ZahtjevIzdavanje } from "./zahtjev-izdavanje";
import { ZahtjevObrada } from "./zahtjev-obrada";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Zahtjevi" };

export default async function ZahtjeviStranica() {
  const korisnik = await zahtijevajUlogu("magacioner");
  const [naCekanju, zaIzdavanje, naDostavi, obradeni, razlike] = await Promise.all([
    ucitajZahtjeve(["poslan"]),
    ucitajZahtjeve(["odobren"]),
    ucitajZahtjeve(["na_dostavi"]),
    ucitajZahtjeve(["primljeno", "odbijen"], 20),
    ucitajRazlike(20),
  ]);
  // Najstariji čeka najduže, pa je prvi na redu.
  const poRedu = [...naCekanju].reverse();
  const zaIzdavanjePoRedu = [...zaIzdavanje].reverse();

  return (
    <Okvir korisnik={korisnik} naslov="Zahtjevi objekata">
      <Osvjezavac />
      <Nazad href="/magacin" />

      <PretragaListe placeholder="Traži objekat, artikal, osobu…" grupa="[data-grupa]">
      <section data-grupa className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Čekaju odluku ({naCekanju.length})</h2>
        {poRedu.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema novih zahtjeva.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {poRedu.map((z) => (
              <ZahtjevObrada key={z.id} z={z} />
            ))}
          </ul>
        )}
      </section>

      <section data-grupa className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Odobreni, čekaju izdavanje ({zaIzdavanje.length})</h2>
        {zaIzdavanjePoRedu.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema odobrenih zahtjeva za izdavanje.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {zaIzdavanjePoRedu.map((z) => (
              <ZahtjevIzdavanje key={z.id} z={z} />
            ))}
          </ul>
        )}
      </section>

      <section data-grupa className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Na dostavi ({naDostavi.length})</h2>
        {naDostavi.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema robe na putu.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {naDostavi.map((z) => (
              <ZahtjevKartica key={z.id} z={z} pokaziObjekat />
            ))}
          </ul>
        )}
      </section>

      <section data-grupa className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Razlike pri prijemu ({razlike.length})</h2>
        <RazlikePrikaz razlike={razlike} />
      </section>

      <section data-grupa className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Zadnje završeni (primljeni i odbijeni)</h2>
        {obradeni.length === 0 ? (
          <p className="text-xl text-zinc-500">Još nema obrađenih zahtjeva.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {obradeni.map((z) => (
              <ZahtjevKartica key={z.id} z={z} pokaziObjekat />
            ))}
          </ul>
        )}
      </section>
      </PretragaListe>
    </Okvir>
  );
}
