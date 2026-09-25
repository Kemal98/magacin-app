import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";

export const metadata = { title: "Menadžer" };

const STAVKE = [
  { href: "/menadzer/stanje", naslov: "Stanje magacina", opis: "Količine i vrijednost zaliha" },
  { href: "/menadzer/artikli", naslov: "Artikli", opis: "Mjere, pakovanja, bar kodovi, minimum" },
  { href: "/menadzer/objekti", naslov: "Objekti", opis: "Kuhinje, šankovi, hoteli" },
  { href: "/menadzer/dobavljaci", naslov: "Dobavljači", opis: "Firme od kojih se nabavlja" },
  { href: "/menadzer/uvoz", naslov: "Uvoz iz Excela", opis: "Jednokratni uvoz šifrarnika" },
];

export default async function MenadzerPocetna() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Pregled">
      <h2 className="text-2xl font-semibold">Šifrarnik</h2>
      <nav className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAVKE.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex min-h-32 flex-col justify-center gap-1 rounded-2xl border-2 border-zinc-300 p-5 active:bg-zinc-200"
          >
            <span className="text-2xl font-bold">{s.naslov}</span>
            <span className="text-lg text-zinc-500">{s.opis}</span>
          </Link>
        ))}
      </nav>
    </Okvir>
  );
}
