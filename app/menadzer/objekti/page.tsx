import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { AktivnostDugme } from "../_components/aktivnost-dugme";
import { NazivForma } from "../_components/naziv-forma";

export const metadata = { title: "Objekti" };

export default async function Stranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase
    .from("objekat")
    .select("id, naziv, aktivan")
    .order("naziv");
  if (error) throw new Error(`Učitavanje nije uspjelo: ${error.message}`);

  return (
    <Okvir korisnik={korisnik} naslov="Objekti">
      <Link href="/menadzer" className="text-xl font-semibold text-zinc-600 underline">
        ← Nazad
      </Link>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-zinc-200 p-4">
        <h2 className="text-2xl font-semibold">Novi objekat</h2>
        <NazivForma vrsta="objekat" dugme="Dodaj" />
      </section>

      <ul className="flex flex-col gap-3">
        {data.length === 0 && <li className="text-xl text-zinc-500">Još nema unosa.</li>}
        {data.map((z) => (
          <li
            key={z.id}
            className={`flex flex-wrap items-start gap-3 rounded-2xl border-2 p-4 ${z.aktivan ? "border-zinc-300" : "border-zinc-200 bg-zinc-100 text-zinc-500"}`}
          >
            <NazivForma vrsta="objekat" id={z.id} naziv={z.naziv} dugme="Snimi" />
            <Link
              href={`/menadzer/objekti/${z.id}/artikli`}
              className="flex min-h-14 items-center rounded-xl border-2 border-zinc-300 px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
            >
              Artikli
            </Link>
            <AktivnostDugme vrsta="objekat" id={z.id} aktivan={z.aktivan} />
            {!z.aktivan && <span className="self-center text-lg font-semibold">isključen</span>}
          </li>
        ))}
      </ul>
    </Okvir>
  );
}
