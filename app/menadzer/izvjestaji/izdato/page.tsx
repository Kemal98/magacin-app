import { Nazad } from "@/app/_components/nazad";
import { PretragaListe } from "@/app/_components/pretraga-liste";
import { IzvozDugme } from "@/app/_components/izvoz-dugme";
import { Okvir } from "@/app/_components/okvir";
import { km, kolicina as fmt } from "@/lib/format";
import { ucitajIzvjestaj, ucitajObjekte } from "@/lib/izvjestaji";
import { poObjektu } from "@/lib/izvjestaji-tipovi";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { danasSarajevo, periodIzParametara } from "@/lib/period";
import { IzvjestajFilter, IzvjestajKartice } from "../filter";

export const metadata = { title: "Izdato, potrošeno, zaliha" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function IzdatoStranica({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string; objekat?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const q = await searchParams;
  const { od, do: kraj } = periodIzParametara(q.od, q.do, danasSarajevo());
  const objekat = q.objekat && UUID.test(q.objekat) ? q.objekat : undefined;
  const [redovi, objekti] = await Promise.all([ucitajIzvjestaj(od, kraj, objekat), ucitajObjekte()]);
  const izvoz = `/izvoz/izvjestaj?od=${od}&do=${kraj}${objekat ? `&objekat=${objekat}` : ""}`;

  return (
    <Okvir korisnik={korisnik} naslov="Izvještaji">
      <Nazad href="/menadzer" />
      <IzvjestajKartice aktivno="izdato" od={od} do={kraj} objekat={objekat} />
      <IzvozDugme href={izvoz} />
      <IzvjestajFilter putanja="/menadzer/izvjestaji/izdato" od={od} do={kraj} objekat={objekat} objekti={objekti} />
      <p className="text-lg text-zinc-600">
        Razlika je izdato minus potrošeno u izabranom periodu. Zaliha objekta je stanje sada (izdata roba koja još nije
        potrošena; nije trošak dok se ne potroši).
      </p>

      {redovi.length === 0 ? (
        <p className="text-xl text-zinc-500">Nema podataka za izabrani period i objekat.</p>
      ) : (
        <PretragaListe placeholder="Traži objekat ili artikal…" grupa="[data-grupa]">
        {poObjektu(redovi).map((g) => (
          <section data-grupa key={g.objekat_id} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-bold">{g.objekat}</h2>
              <p className="text-lg text-zinc-600">Izdato u vrijednosti {km(g.zbir.vrijednost_izdatog)}</p>
            </div>
            <table className="w-full text-left text-lg">
              <thead>
                <tr className="border-b-2 border-zinc-300">
                  <th className="py-1">Artikal</th>
                  <th className="py-1 text-right">Izdato</th>
                  <th className="py-1 text-right">Potrošeno</th>
                  <th className="py-1 text-right">Razlika</th>
                  <th className="py-1 text-right">Zaliha objekta</th>
                </tr>
              </thead>
              <tbody>
                {[...g.redovi]
                  .sort((a, b) => a.artikal.localeCompare(b.artikal, "bs"))
                  .map((r) => (
                    <tr data-red data-trazi={`${g.objekat} ${r.artikal}`} key={r.artikal_id} className="border-b border-zinc-200 align-top">
                      <td className="py-1">
                        {r.artikal}
                        {(r.izuzeci > 0 || r.manjak > 0 || r.visak > 0) && (
                          <span className="block text-base text-zinc-500">
                            {r.izuzeci > 0 && `izuzeci ${fmt(r.izuzeci)} `}
                            {r.manjak > 0 && `manjak pri prijemu ${fmt(r.manjak)} `}
                            {r.visak > 0 && `višak ${fmt(r.visak)}`}
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right">
                        {fmt(r.izdato)} {r.mjera}
                      </td>
                      <td className="py-1 text-right">
                        {fmt(r.potroseno)} {r.mjera}
                      </td>
                      <td className="py-1 text-right font-semibold">
                        {fmt(r.razlika)} {r.mjera}
                      </td>
                      <td className="py-1 text-right font-semibold">
                        {fmt(r.zaliha_sada)} {r.mjera}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
        </PretragaListe>
      )}
    </Okvir>
  );
}
