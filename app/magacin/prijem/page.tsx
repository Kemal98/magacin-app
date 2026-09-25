import Link from "next/link";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { Okvir } from "@/app/_components/okvir";
import { datumVrijeme, km } from "@/lib/format";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import type { ArtikalZaUnos } from "@/lib/bar-kod";
import { PrijemForma } from "./prijem-forma";
import { Nazad } from "@/app/_components/nazad";

export const metadata = { title: "Prijem robe" };

type ZadnjiPrijem = {
  id: string;
  vrijeme: string;
  dobavljac: string;
  ime: string;
  broj_stavki: number;
  vrijednost: string | number;
};

export default async function PrijemStranica({
  searchParams,
}: {
  searchParams: Promise<{ uneseno?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("magacioner");
  const { uneseno } = await searchParams;
  const supabase = await napraviServerKlijent();

  const [artikliRes, dobavljaciRes, zadnjiRes] = await Promise.all([
    supabase
      .from("artikal")
      .select("id, naziv, mjera, bar_kod, pakovanje(id, naziv, faktor, bar_kod)")
      .eq("vrsta", "prehrana")
      .eq("aktivan", true)
      .order("naziv"),
    supabase.from("dobavljac").select("id, naziv").eq("aktivan", true).order("naziv"),
    supabase.rpc("zadnji_prijemi", { p_limit: 10 }),
  ]);
  for (const r of [artikliRes, dobavljaciRes, zadnjiRes]) {
    if (r.error) throw new Error(`Učitavanje nije uspjelo: ${r.error.message}`);
  }

  const artikli: ArtikalZaUnos[] = artikliRes.data!.map((a) => ({
    id: a.id,
    naziv: a.naziv,
    mjera: a.mjera,
    bar_kod: a.bar_kod,
    pakovanja: a.pakovanje.map((p) => ({
      id: p.id,
      naziv: p.naziv,
      faktor: Number(p.faktor),
      bar_kod: p.bar_kod,
    })),
  }));

  return (
    <Okvir korisnik={korisnik} naslov="Prijem robe">
      <Nazad href="/magacin" />

      {uneseno && (
        <p role="status" className="rounded-2xl border border-green-700 bg-green-50 p-4 text-xl font-semibold shadow-sm">
          Prijem je snimljen.{" "}
          <Link href="/magacin/stanje" className="underline">
            Pogledaj stanje magacina
          </Link>
        </p>
      )}

      <PrijemForma artikli={artikli} dobavljaci={dobavljaciRes.data!} />

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Zadnji prijemi</h2>
        {(zadnjiRes.data as ZadnjiPrijem[]).length === 0 && <p className="text-xl text-zinc-500">Još nema prijema.</p>}
        <PretragaListe placeholder="Traži dobavljača, osobu…">
        <ul className="flex flex-col gap-2">
          {(zadnjiRes.data as ZadnjiPrijem[]).map((p) => (
            <li data-red key={p.id} className="rounded-xl border-2 border-zinc-200 p-3 text-lg bg-white">
              <span className="font-semibold">{p.dobavljac}</span> · {p.broj_stavki} stavki · {km(Number(p.vrijednost))}
              <br />
              <span className="text-zinc-500">
                {p.ime}, {datumVrijeme(p.vrijeme)}
              </span>
            </li>
          ))}
        </ul>
        </PretragaListe>
      </section>
    </Okvir>
  );
}
