import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { Plocica } from "@/app/_components/plocica";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajZahtjeve } from "@/lib/zahtjevi";

export const metadata = { title: "Magacin" };

export default async function MagacinPocetna() {
  const korisnik = await zahtijevajUlogu("magacioner");
  const naCekanju = (await ucitajZahtjeve(["poslan"])).length;
  return (
    <Okvir korisnik={korisnik} naslov="Magacin prehrane">
      <Osvjezavac />
      <nav className="grid gap-4 sm:grid-cols-2">
        <Plocica
          href="/magacin/zahtjevi"
          naslov="Zahtjevi objekata"
          opis="Odobravanje, odbijanje i izdavanje"
          ikona="zahtjevi"
          znacka={naCekanju}
        />
        <Plocica href="/magacin/prijem" naslov="Prijem robe" opis="Unos robe od dobavljača" ikona="paket" />
        <Plocica href="/magacin/popis" naslov="Popis magacina" opis="Brojanje i usklađivanje stanja" ikona="stanje" />
        <Plocica href="/magacin/otpis" naslov="Otpis robe" opis="Kvar, istek roka, lomljenje" ikona="upozorenje" />
        <Plocica href="/magacin/stanje" naslov="Stanje magacina" opis="Količine i vrijednost po artiklu" ikona="stanje" />
      </nav>
    </Okvir>
  );
}
