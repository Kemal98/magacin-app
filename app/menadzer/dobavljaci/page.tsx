import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { AktivnostDugme } from "../_components/aktivnost-dugme";
import { NazivForma } from "../_components/naziv-forma";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Dobavljači" };

export default async function Stranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase
    .from("dobavljac")
    .select("id, naziv, aktivan")
    .order("naziv");
  if (error) throw new Error(`Učitavanje nije uspjelo: ${error.message}`);

  return (
    <Okvir korisnik={korisnik} naslov="Dobavljači">
      <Nazad href="/menadzer" />

      <section className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-4 shadow-sm bg-white">
        <h2 className="text-2xl font-semibold">Novi dobavljač</h2>
        <NazivForma vrsta="dobavljac" dugme="Dodaj" />
      </section>

      <PretragaListe placeholder="Traži po nazivu…">
      <ul className="flex flex-col gap-3">
        {data.length === 0 && <li className="text-xl text-zinc-500">Još nema unosa.</li>}
        {data.map((z) => (
          <li
            data-red
            data-trazi={`${z.naziv}${z.aktivan ? "" : " isključen"}`}
            key={z.id}
            className={`flex flex-wrap items-start gap-3 rounded-2xl border p-4 shadow-sm ${z.aktivan ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-100 text-zinc-500"}`}
          >
            <NazivForma vrsta="dobavljac" id={z.id} naziv={z.naziv} dugme="Snimi" />
            <Link
              href={`/menadzer/nabavka/${z.id}`}
              className="flex min-h-14 items-center rounded-xl border-2 border-zinc-300 bg-white px-5 text-lg font-semibold text-zinc-700 active:bg-zinc-200"
            >
              Nabavka
            </Link>
            <AktivnostDugme vrsta="dobavljac" id={z.id} aktivan={z.aktivan} />
            {!z.aktivan && <span className="self-center text-lg font-semibold">isključen</span>}
          </li>
        ))}
      </ul>
      </PretragaListe>
    </Okvir>
  );
}
