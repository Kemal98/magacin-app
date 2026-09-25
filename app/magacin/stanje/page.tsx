import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { ucitajStanje } from "@/app/_components/stanje-podaci";
import { StanjeTabela } from "@/app/_components/stanje-tabela";
import { zahtijevajUlogu } from "@/lib/korisnik";

export const metadata = { title: "Stanje magacina" };

export default async function StanjeStranica() {
  const korisnik = await zahtijevajUlogu("magacioner");
  return (
    <Okvir korisnik={korisnik} naslov="Stanje magacina prehrane">
      <Link href="/magacin" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>
      <StanjeTabela redovi={await ucitajStanje()} />
    </Okvir>
  );
}
