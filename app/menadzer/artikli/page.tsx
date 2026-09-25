import Link from "next/link";
import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { AktivnostDugme } from "../_components/aktivnost-dugme";

export const metadata = { title: "Artikli" };

const VRSTA = { prehrana: "Prehrana", materijal: "Materijal" } as const;

export default async function ArtikliStranica() {
  const korisnik = await zahtijevajUlogu("menadzer");
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase
    .from("artikal")
    .select("id, naziv, mjera, bar_kod, vrsta, aktivan, pakovanje(id, naziv, faktor)")
    .order("naziv");
  if (error) throw new Error(`Učitavanje nije uspjelo: ${error.message}`);

  return (
    <Okvir korisnik={korisnik} naslov="Artikli">
      <div className="flex items-center justify-between gap-4">
        <Link href="/menadzer" className="text-xl font-semibold text-zinc-600 underline">
          ← Nazad
        </Link>
        <Link
          href="/menadzer/artikli/novi"
          className="flex min-h-16 items-center rounded-2xl bg-zinc-900 px-6 text-xl font-semibold text-white active:bg-zinc-700"
        >
          Novi artikal
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {data.length === 0 && <li className="text-xl text-zinc-500">Još nema artikala.</li>}
        {data.map((a) => (
          <li
            key={a.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4 ${a.aktivan ? "border-zinc-300" : "border-zinc-200 bg-zinc-100 text-zinc-500"}`}
          >
            <Link href={`/menadzer/artikli/${a.id}`} className="flex flex-1 flex-col gap-1">
              <span className="text-2xl font-semibold">{a.naziv}</span>
              <span className="text-lg text-zinc-500">
                {a.mjera} · {VRSTA[a.vrsta as keyof typeof VRSTA]}
                {a.bar_kod ? ` · ${a.bar_kod}` : ""}
                {a.pakovanje.length > 0 &&
                  ` · ${a.pakovanje.map((p) => `1 ${p.naziv} = ${Number(p.faktor)} ${a.mjera}`).join(", ")}`}
                {!a.aktivan && " · isključen"}
              </span>
            </Link>
            <AktivnostDugme vrsta="artikal" id={a.id} aktivan={a.aktivan} />
          </li>
        ))}
      </ul>
    </Okvir>
  );
}
