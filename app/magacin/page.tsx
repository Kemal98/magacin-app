import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";

export const metadata = { title: "Magacin" };

const STAVKE = [
  { href: "/magacin/prijem", naslov: "Prijem robe", opis: "Unos robe od dobavljača" },
  { href: "/magacin/stanje", naslov: "Stanje magacina", opis: "Količine i vrijednost po artiklu" },
];

export default async function MagacinPocetna() {
  const korisnik = await zahtijevajUlogu("magacioner");
  return (
    <Okvir korisnik={korisnik} naslov="Magacin prehrane">
      <nav className="grid gap-4 sm:grid-cols-2">
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
