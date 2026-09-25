import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajStanjeZaZatvaranje } from "@/lib/smjene";
import { ZatvaranjeForma } from "./zatvaranje-forma";

export const metadata = { title: "Zatvaranje smjene" };

export default async function ZatvaranjeStranica() {
  const korisnik = await zahtijevajUlogu("objekat");
  const redovi = await ucitajStanjeZaZatvaranje();
  return (
    <Okvir korisnik={korisnik} naslov="Zatvaranje smjene">
      <Link href="/objekat" className="text-2xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>
      <ZatvaranjeForma redovi={redovi} />
    </Okvir>
  );
}
