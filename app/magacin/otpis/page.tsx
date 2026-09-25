import { Nazad } from "@/app/_components/nazad";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { Okvir } from "@/app/_components/okvir";
import { OtpisiPrikaz } from "@/app/_components/otpis-prikaz";
import type { ArtikalZaUnos } from "@/lib/bar-kod";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { ucitajOtpise } from "@/lib/otpis";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { OtpisForma } from "./otpis-forma";

export const metadata = { title: "Otpis" };

type RedStanja = { artikal_id: string; kolicina: number | string };

export default async function OtpisStranica({
  searchParams,
}: {
  searchParams: Promise<{ otpisano?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("magacioner");
  const { otpisano } = await searchParams;
  const supabase = await napraviServerKlijent();

  const [artikliRes, stanjeRes, otpisi] = await Promise.all([
    supabase
      .from("artikal")
      .select("id, naziv, mjera, bar_kod, pakovanje(id, naziv, faktor, bar_kod)")
      .eq("vrsta", "prehrana")
      .order("naziv"),
    supabase.rpc("stanje_magacina", { p_vrsta: "prehrana" }),
    ucitajOtpise(20),
  ]);
  for (const r of [artikliRes, stanjeRes]) {
    if (r.error) throw new Error(`Učitavanje nije uspjelo: ${r.error.message}`);
  }
  const naStanju = new Map((stanjeRes.data as RedStanja[]).map((r) => [r.artikal_id, Number(r.kolicina)]));
  const artikli: (ArtikalZaUnos & { naStanju: number })[] = artikliRes.data!.map((a) => ({
    id: a.id,
    naziv: a.naziv,
    mjera: a.mjera,
    bar_kod: a.bar_kod,
    naStanju: naStanju.get(a.id) ?? 0,
    pakovanja: a.pakovanje.map((p) => ({
      id: p.id,
      naziv: p.naziv,
      faktor: Number(p.faktor),
      bar_kod: p.bar_kod,
    })),
  }));

  return (
    <Okvir korisnik={korisnik} naslov="Otpis robe">
      <Nazad href="/magacin" />
      {otpisano && (
        <p role="status" className="rounded-2xl border-2 border-green-700 bg-green-50 p-4 text-xl font-semibold">
          Otpis je zabilježen i odmah ga vidi menadžer.
        </p>
      )}
      <OtpisForma artikli={artikli} />
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Zadnji otpisi</h2>
        <PretragaListe placeholder="Traži artikal, razlog, osobu…">
          <OtpisiPrikaz otpisi={otpisi} />
        </PretragaListe>
      </section>
    </Okvir>
  );
}
