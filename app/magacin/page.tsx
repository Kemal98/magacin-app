import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajZahtjeve } from "@/lib/zahtjevi";

export const metadata = { title: "Magacin" };

const STAVKE = [
  { href: "/magacin/zahtjevi", naslov: "Zahtjevi objekata", opis: "Odobravanje i odbijanje" },
  { href: "/magacin/prijem", naslov: "Prijem robe", opis: "Unos robe od dobavljača" },
  { href: "/magacin/stanje", naslov: "Stanje magacina", opis: "Količine i vrijednost po artiklu" },
];

export default async function MagacinPocetna() {
  const korisnik = await zahtijevajUlogu("magacioner");
  const naCekanju = (await ucitajZahtjeve(["poslan"])).length;
  return (
    <Okvir korisnik={korisnik} naslov="Magacin prehrane">
      <Osvjezavac />
      <nav className="grid gap-4 sm:grid-cols-2">
        {STAVKE.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex min-h-32 flex-col justify-center gap-1 rounded-2xl border-2 border-zinc-300 p-5 active:bg-zinc-200"
          >
            <span className="text-2xl font-bold">
              {s.naslov}
              {s.href === "/magacin/zahtjevi" && naCekanju > 0 && (
                <span className="ml-3 rounded-full bg-red-700 px-3 py-1 text-xl text-white">{naCekanju}</span>
              )}
            </span>
            <span className="text-lg text-zinc-500">{s.opis}</span>
          </Link>
        ))}
      </nav>
    </Okvir>
  );
}
