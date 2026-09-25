import Link from "next/link";
import { IzvozDugme } from "@/app/_components/izvoz-dugme";
import { PeriodFilter } from "@/app/_components/period-filter";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { datumVrijeme, km, kolicina as fmt } from "@/lib/format";
import type { ArtikalDobavljaca, DobavljacNabavka, Isporuka } from "@/lib/nabavka-tipovi";
import { daniOd, danasSarajevo } from "@/lib/period";

/** "danas", "jučer" ili "prije N dana". */
export function kadaTekst(datum: string, danas: string): string {
  const n = daniOd(datum, danas);
  return n === 0 ? "danas" : n === 1 ? "jučer" : `prije ${n} dana`;
}

/** Datum "GGGG-MM-DD" kao "25. 9. 2026." */
export function datumTekst(datum: string): string {
  const [g, m, d] = datum.slice(0, 10).split("-");
  return `${Number(d)}. ${Number(m)}. ${g}.`;
}

/** Na koliko dana dolazi, npr. "svakih 5 dana" ili "još nema dovoljno isporuka". */
export function ucestalost(razmak: number | null): string {
  if (razmak === null) return "premalo isporuka za prosjek";
  const zaokruzeno = Math.round(razmak * 10) / 10;
  return `u prosjeku svakih ${fmt(zaokruzeno)} ${zaokruzeno === 1 ? "dan" : "dana"}`;
}

/** Pregled svih dobavljača: koliko puta dolaze, koliko isporuče i kad su zadnji put došli. */
export function NabavkaPregled({
  osnova,
  redovi,
  od,
  do: do_,
}: {
  osnova: string;
  redovi: DobavljacNabavka[];
  od: string;
  do: string;
}) {
  const danas = danasSarajevo();
  const ukupno = redovi.reduce((z, r) => z + r.ukupna_vrijednost, 0);
  const isporuka = redovi.reduce((z, r) => z + r.broj_isporuka, 0);
  const dolazili = redovi.filter((r) => r.broj_isporuka > 0).length;
  const upit = new URLSearchParams({ od, do: do_ });

  return (
    <div className="flex flex-col gap-5">
      <IzvozDugme href={`/izvoz/nabavka?${upit}`} />
      <PeriodFilter putanja={osnova} od={od} do={do_} />

      <section className="rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <p className="text-lg text-zinc-600">
          Nabavka u periodu {datumTekst(od)} – {datumTekst(do_)}
        </p>
        <p className="text-4xl font-bold">{km(ukupno)}</p>
        <p className="text-xl text-zinc-700">
          {isporuka} isporuka, {dolazili} dobavljača je isporučivalo
        </p>
      </section>

      <PretragaListe placeholder="Traži dobavljača…">
        <ul className="flex flex-col gap-3">
          {redovi.map((r) => (
            <li key={r.dobavljac_id} data-red data-trazi={`${r.naziv}${r.aktivan ? "" : " isključen"}`}>
              <Link
                href={`${osnova}/${r.dobavljac_id}?${upit}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm active:bg-brand-soft"
              >
                <div className="min-w-56 flex-1">
                  <p className="text-2xl font-bold">
                    {r.naziv}
                    {!r.aktivan && <span className="ml-2 text-lg font-normal text-zinc-500">(isključen)</span>}
                  </p>
                  {r.broj_isporuka > 0 ? (
                    <p className="text-lg text-zinc-600">
                      {r.broj_isporuka} isporuka, {ucestalost(r.prosjecan_razmak_dana)}
                    </p>
                  ) : (
                    <p className="text-lg text-zinc-500">Nije isporučivao u ovom periodu</p>
                  )}
                  <p className="text-lg text-zinc-500">
                    {r.zadnja_isporuka
                      ? `Zadnja isporuka: ${datumTekst(r.zadnja_isporuka)} (${kadaTekst(r.zadnja_isporuka, danas)})`
                      : "Još nikad nije isporučio"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{km(r.ukupna_vrijednost)}</p>
                  {r.broj_isporuka > 0 && (
                    <p className="text-lg text-zinc-500">prosječno {km(r.prosjecna_vrijednost)} po isporuci</p>
                  )}
                  {r.stornirano > 0 && <p className="text-base text-red-700">poništenih: {r.stornirano}</p>}
                </div>
              </Link>
            </li>
          ))}
          {redovi.length === 0 && <li className="text-xl text-zinc-500">Nema dobavljača.</li>}
        </ul>
      </PretragaListe>
    </div>
  );
}

/** Jedan dobavljač: brojke, artikli s cijenama i sve pojedinačne isporuke. */
export function NabavkaDobavljac({
  osnova,
  dobavljac,
  isporuke,
  artikli,
  od,
  do: do_,
  id,
}: {
  osnova: string;
  dobavljac: DobavljacNabavka | undefined;
  isporuke: Isporuka[];
  artikli: ArtikalDobavljaca[];
  od: string;
  do: string;
  id: string;
}) {
  const danas = danasSarajevo();
  const upit = new URLSearchParams({ od, do: do_, dobavljac: id });

  return (
    <div className="flex flex-col gap-5">
      <IzvozDugme href={`/izvoz/nabavka?${upit}`} />
      <PeriodFilter putanja={`${osnova}/${id}`} od={od} do={do_} />

      {dobavljac && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { naslov: "Isporuka u periodu", vrijednost: String(dobavljac.broj_isporuka) },
            { naslov: "Ukupna vrijednost", vrijednost: km(dobavljac.ukupna_vrijednost) },
            { naslov: "Dolazi", vrijednost: dobavljac.prosjecan_razmak_dana === null ? "—" : `svakih ${fmt(Math.round(dobavljac.prosjecan_razmak_dana * 10) / 10)} dana` },
            {
              naslov: "Zadnja isporuka",
              vrijednost: dobavljac.zadnja_isporuka ? `${datumTekst(dobavljac.zadnja_isporuka)}` : "—",
              opis: dobavljac.zadnja_isporuka ? kadaTekst(dobavljac.zadnja_isporuka, danas) : undefined,
            },
          ].map((k) => (
            <div key={k.naslov} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-lg text-zinc-500">{k.naslov}</p>
              <p className="text-3xl font-bold">{k.vrijednost}</p>
              {k.opis && <p className="text-lg text-zinc-600">{k.opis}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Šta donosi i po kojim cijenama</h2>
        {artikli.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema isporuka u izabranom periodu.</p>
        ) : (
          <PretragaListe placeholder="Traži artikal…">
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <table className="w-full text-left text-lg">
                <thead>
                  <tr className="border-b-2 border-zinc-300">
                    <th className="py-1">Artikal</th>
                    <th className="py-1 text-right">Isporuka</th>
                    <th className="py-1 text-right">Količina</th>
                    <th className="py-1 text-right">Vrijednost</th>
                    <th className="py-1 text-right">Zadnja cijena</th>
                    <th className="py-1 text-right">Najniža</th>
                    <th className="py-1 text-right">Najviša</th>
                    <th className="py-1 text-right">Prosječna</th>
                  </tr>
                </thead>
                <tbody>
                  {artikli.map((a) => (
                    <tr key={a.artikal_id} data-red className="border-b border-zinc-200">
                      <td className="py-1">{a.artikal}</td>
                      <td className="py-1 text-right">{a.broj_isporuka}</td>
                      <td className="py-1 text-right">
                        {fmt(a.kolicina)} {a.mjera}
                      </td>
                      <td className="py-1 text-right font-semibold">{km(a.vrijednost)}</td>
                      <td className="py-1 text-right font-semibold">{km(a.zadnja_cijena)}</td>
                      <td className="py-1 text-right">{km(a.najnizja_cijena)}</td>
                      <td className="py-1 text-right">{km(a.najvisa_cijena)}</td>
                      <td className="py-1 text-right">{km(a.prosjecna_cijena)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="pt-2 text-base text-zinc-500">Cijene su po osnovnoj mjeri (kg, l, kom), u KM bez PDV-a.</p>
            </div>
          </PretragaListe>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Sve isporuke ({isporuke.length})</h2>
        {isporuke.length === 0 ? (
          <p className="text-xl text-zinc-500">Nema isporuka u izabranom periodu.</p>
        ) : (
          <PretragaListe placeholder="Traži artikal, broj otpremnice, napomenu, osobu…">
            <ul className="flex flex-col gap-3">
              {isporuke.map((i) => (
                <li
                  key={i.id}
                  data-red
                  className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-sm ${i.stornirano ? "border-zinc-300 bg-zinc-100" : "border-zinc-200 bg-white"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className={i.stornirano ? "text-zinc-500" : ""}>
                      <p className="text-2xl font-bold">
                        {datumTekst(i.datum_isporuke)}{" "}
                        <span className="text-lg font-normal text-zinc-500">({kadaTekst(i.datum_isporuke, danas)})</span>
                      </p>
                      <p className="text-lg">
                        {i.dokument ? `Otpremnica/račun: ${i.dokument} · ` : ""}
                        primio: {i.ime}, uneseno {datumVrijeme(i.vrijeme)}
                      </p>
                      {i.razmak_dana !== null && (
                        <p className="text-lg">
                          {i.razmak_dana === 0 ? "isti dan kao prethodna isporuka" : `${i.razmak_dana} dana poslije prethodne isporuke`}
                        </p>
                      )}
                    </div>
                    <p className={`text-2xl font-bold ${i.stornirano ? "text-zinc-500 line-through" : ""}`}>{km(i.vrijednost)}</p>
                  </div>
                  {i.napomena && <p className="text-lg text-zinc-700">Napomena: {i.napomena}</p>}
                  <ul className="flex flex-col gap-0.5 text-lg">
                    {i.stavke.map((s, n) => (
                      <li key={n}>
                        <span className="font-semibold">{s.artikal}</span>: {fmt(s.kolicina)} {s.mjera}
                        {s.pakovanje && s.kolicina_pakovanja !== null && ` (${fmt(s.kolicina_pakovanja)} ${s.pakovanje})`} po {km(s.cijena)}
                        /{s.mjera} = {km(s.vrijednost)}
                      </li>
                    ))}
                  </ul>
                  {i.stornirano && (
                    <p className="rounded-xl bg-white p-3 text-lg font-semibold text-red-800">
                      PONIŠTENO: {i.storno_razlog}
                      <span className="block text-base font-normal text-zinc-600">
                        {i.storno_ime}
                        {i.storno_vrijeme && `, ${datumVrijeme(i.storno_vrijeme)}`}
                      </span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </PretragaListe>
        )}
      </section>
    </div>
  );
}
