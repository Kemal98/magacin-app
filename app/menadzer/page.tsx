import { Okvir } from "@/app/_components/okvir";
import { Plocica } from "@/app/_components/plocica";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajIspodMinimuma } from "@/lib/minimum";

export const metadata = { title: "Menadžer" };

export default async function MenadzerPocetna() {
  const korisnik = await zahtijevajUlogu("menadzer");
  const ispodMinimuma = (await ucitajIspodMinimuma()).length;
  return (
    <Okvir korisnik={korisnik} naslov="Pregled">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-500">Nadzor</h2>
        <nav className="grid gap-4 sm:grid-cols-2">
          <Plocica
            href="/menadzer/naruciti"
            naslov="Za naručivanje"
            opis="Artikli ispod minimuma"
            ikona="upozorenje"
            znacka={ispodMinimuma}
          />
          <Plocica href="/menadzer/izvjestaji" naslov="Izvještaji" opis="Trošak, potrošnja, izdato po objektu i periodu" ikona="stanje" />
          <Plocica href="/menadzer/smjene" naslov="Smjene i potrošnja" opis="Trošak po smjeni, upozorenja" ikona="sat" />
          <Plocica href="/menadzer/nabavka" naslov="Nabavka" opis="Dobavljači: koliko dolaze, šta i po kojoj cijeni" ikona="dobavljaci" />
          <Plocica href="/menadzer/razlike" naslov="Razlike pri prijemu" opis="Poslano i stiglo se ne poklapa" ikona="upozorenje" />
          <Plocica href="/menadzer/popisi" naslov="Popisi magacina" opis="Razlike brojanog i sistemskog" ikona="zahtjevi" />
          <Plocica href="/menadzer/storno" naslov="Storno" opis="Poništi pogrešan prijem, izdavanje, otpis" ikona="nazad" />
          <Plocica href="/menadzer/otpis" naslov="Otpis magacina" opis="Šta je i zašto otpisano" ikona="upozorenje" />
          <Plocica href="/menadzer/stanje" naslov="Stanje magacina" opis="Količine i vrijednost zaliha" ikona="stanje" />
        </nav>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-zinc-500">Šifrarnik</h2>
        <nav className="grid gap-4 sm:grid-cols-2">
          <Plocica href="/menadzer/korisnici" naslov="Korisnici" opis="Magacioneri, osoblje objekata, PIN-ovi, zaključani računi" ikona="artikli" />
          <Plocica href="/menadzer/artikli" naslov="Artikli" opis="Mjere, pakovanja, bar kodovi, minimum" ikona="artikli" />
          <Plocica href="/menadzer/objekti" naslov="Objekti" opis="Popis artikala i smjene po objektu" ikona="objekti" />
          <Plocica href="/menadzer/dobavljaci" naslov="Dobavljači" opis="Firme od kojih se nabavlja" ikona="dobavljaci" />
          <Plocica href="/menadzer/uvoz" naslov="Uvoz iz Excela" opis="Jednokratni uvoz šifrarnika" ikona="uvoz" />
        </nav>
      </section>
    </Okvir>
  );
}
