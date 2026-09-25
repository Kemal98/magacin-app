import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { Osvjezavac } from "@/app/_components/osvjezavac";
import { RazlikePrikaz } from "@/app/_components/razlike-prikaz";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajRazlike } from "@/lib/razlike";

export const metadata = { title: "Razlike pri prijemu" };

export default async function RazlikeStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  return (
    <Okvir korisnik={korisnik} naslov="Razlike pri prijemu">
      <Osvjezavac sekundi={15} />
      <Link href="/menadzer" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>
      <RazlikePrikaz razlike={await ucitajRazlike()} />
    </Okvir>
  );
}
